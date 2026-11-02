// Sincronização dos dados da app com a nuvem. As páginas continuam a ler e a escrever no localStorage; esta camada
// copia para o Firestore tudo o que muda nas chaves abaixo e, ao entrar, traz de lá os dados da conta.
// A lógica fica separada do Firebase (o destino é um `SyncRemote`) para poder ser testada sem rede.

// Dados do consultor. As preferências só deste ecrã (blocos recolhidos) ficam de fora de propósito.
export const syncedKeys = [
  'casanexa-history',
  'casanexa-signature',
  'casanexa-properties',
  'casanexa-appointments',
  'casanexa-consultant',
  'casanexa-search-extras',
  'casanexa-free-search',
  'casanexa-client-searches',
  'casanexa-video-motion',
  'casanexa-video-music',
  'casanexa-video-ad-details',
  'casanexa-analysis-history',
  'casanexa-message-templates',
  'casanexa-property-analysis',
] as const

export const ownerKey = 'casanexa-sync-owner'
export const backupKey = 'casanexa-sync-backup'

export type SyncRemote = {
  load(): Promise<Record<string, string>>
  save(key: string, value: string | null): Promise<void>
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type SyncStatus = 'idle' | 'saving' | 'error'

export type HydrateResult = {
  pulled: number
  pushed: number
  backedUp: string[]
  baseline: Map<string, string | null>
}

export function clearSyncedKeys(storage: StorageLike, keys: readonly string[] = syncedKeys) {
  for (const key of keys) storage.removeItem(key)
  storage.removeItem(ownerKey)
}

// Ao entrar: os dados da nuvem mandam. Se este browser tem dados locais ainda não sincronizados (primeira entrada, antes da
// migração), sobem para a conta. Valores locais que diferem dos da nuvem ficam guardados em `backupKey` antes de serem trocados.
// Se o browser pertencia a outra conta, os dados locais dessa conta são retirados (já estão na nuvem) para não passarem para esta.
export async function hydrate(uid: string, storage: StorageLike, remote: SyncRemote, keys: readonly string[] = syncedKeys): Promise<HydrateResult> {
  const owner = storage.getItem(ownerKey)
  if (owner && owner !== uid) clearSyncedKeys(storage, keys)

  const remoteData = await remote.load()
  const baseline = new Map<string, string | null>()
  const backups: Record<string, string> = {}
  let pulled = 0
  const uploads: Promise<void>[] = []

  for (const key of keys) {
    const local = storage.getItem(key)
    const cloud = remoteData[key]
    if (cloud !== undefined) {
      if (local !== null && local !== cloud) backups[key] = local
      if (local !== cloud) {
        storage.setItem(key, cloud)
        pulled++
      }
      baseline.set(key, cloud)
    } else if (local !== null) {
      uploads.push(remote.save(key, local))
      baseline.set(key, local)
    } else {
      baseline.set(key, null)
    }
  }
  await Promise.all(uploads)

  const backedUp = Object.keys(backups)
  if (backedUp.length) storage.setItem(backupKey, JSON.stringify({ at: new Date().toISOString(), values: backups }))
  storage.setItem(ownerKey, uid)
  return { pulled, pushed: uploads.length, backedUp, baseline }
}

type UploaderOptions = {
  delay?: number
  retryDelay?: number
  onStatus?: (status: SyncStatus) => void
}

// Junta as escritas rápidas (cada tecla pode gravar no localStorage) e envia só o que mudou desde o último envio.
export function createUploader(remote: SyncRemote, baseline: Map<string, string | null>, { delay = 800, retryDelay = 5000, onStatus }: UploaderOptions = {}) {
  const known = new Map(baseline)
  const pending = new Map<string, string | null>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined

  function setTimer(ms: number) {
    clearTimeout(timer)
    timer = setTimeout(() => { void flush() }, ms)
  }

  function schedule(key: string, value: string | null) {
    if (known.get(key) === value) pending.delete(key)
    else pending.set(key, value)
    if (pending.size) {
      onStatus?.('saving')
      setTimer(delay)
    } else if (!running) {
      clearTimeout(timer)
      onStatus?.('idle')
    }
  }

  function flush(): Promise<void> {
    clearTimeout(timer)
    if (running) return running.then(() => (pending.size ? flush() : undefined))
    const batch = [...pending]
    if (!batch.length) return Promise.resolve()
    pending.clear()
    onStatus?.('saving')
    running = (async () => {
      let failed = false
      await Promise.all(batch.map(async ([key, value]) => {
        try {
          await remote.save(key, value)
          known.set(key, value)
        } catch {
          failed = true
          if (!pending.has(key)) pending.set(key, value)
        }
      }))
      running = undefined
      if (failed) {
        onStatus?.('error')
        setTimer(retryDelay)
      } else {
        onStatus?.(pending.size ? 'saving' : 'idle')
        if (pending.size) setTimer(delay)
      }
    })()
    return running
  }

  return { schedule, flush, pendingCount: () => pending.size }
}

type StorageProto = { setItem(key: string, value: string): void; removeItem(key: string): void }

// `localStorage.setItem = …` criaria um item chamado "setItem", por isso o gancho vai no protótipo de Storage.
// Devolve a função que retira o gancho. As escritas da própria sincronização têm de acontecer sem o gancho instalado.
export function installStorageSync(
  proto: StorageProto,
  appliesTo: (storage: unknown) => boolean,
  keys: readonly string[],
  onChange: (key: string, value: string | null) => void,
) {
  const originalSet = proto.setItem
  const originalRemove = proto.removeItem
  proto.setItem = function (this: unknown, key: string, value: string) {
    originalSet.call(this, key, value)
    if (appliesTo(this) && keys.includes(key)) onChange(key, String(value))
  }
  proto.removeItem = function (this: unknown, key: string) {
    originalRemove.call(this, key)
    if (appliesTo(this) && keys.includes(key)) onChange(key, null)
  }
  return () => {
    proto.setItem = originalSet
    proto.removeItem = originalRemove
  }
}
