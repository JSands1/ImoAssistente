import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backupKey, clearSyncedKeys, createUploader, hydrate, installStorageSync, ownerKey, type SyncRemote } from './cloud-sync'

class FakeStorage {
  data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, String(value)) }
  removeItem(key: string) { this.data.delete(key) }
}

function fakeRemote(initial: Record<string, string> = {}) {
  const cloud = new Map(Object.entries(initial))
  const saves: [string, string | null][] = []
  const remote: SyncRemote & { fail: boolean } = {
    fail: false,
    load: async () => Object.fromEntries(cloud),
    save: async (key, value) => {
      if (remote.fail) throw new Error('sem rede')
      saves.push([key, value])
      if (value === null) cloud.delete(key)
      else cloud.set(key, value)
    },
  }
  return { remote, cloud, saves }
}

const keys = ['k-a', 'k-b']

describe('hydrate', () => {
  it('traz os dados da nuvem para o browser', async () => {
    const storage = new FakeStorage()
    const { remote } = fakeRemote({ 'k-a': '[1]' })
    const result = await hydrate('u1', storage, remote, keys)
    expect(storage.getItem('k-a')).toBe('[1]')
    expect(result.pulled).toBe(1)
    expect(storage.getItem(ownerKey)).toBe('u1')
  })

  it('migra para a nuvem os dados locais que ainda não existem lá', async () => {
    const storage = new FakeStorage()
    storage.setItem('k-b', '{"x":1}')
    const { remote, cloud } = fakeRemote()
    const result = await hydrate('u1', storage, remote, keys)
    expect(cloud.get('k-b')).toBe('{"x":1}')
    expect(result.pushed).toBe(1)
    expect(storage.getItem('k-b')).toBe('{"x":1}')
  })

  it('a nuvem manda, mas guarda cópia do valor local diferente', async () => {
    const storage = new FakeStorage()
    storage.setItem('k-a', 'local')
    const { remote } = fakeRemote({ 'k-a': 'nuvem' })
    const result = await hydrate('u1', storage, remote, keys)
    expect(storage.getItem('k-a')).toBe('nuvem')
    expect(result.backedUp).toEqual(['k-a'])
    expect(JSON.parse(storage.getItem(backupKey) ?? '{}').values).toEqual({ 'k-a': 'local' })
  })

  it('não cria cópia quando o valor local é igual ao da nuvem', async () => {
    const storage = new FakeStorage()
    storage.setItem('k-a', 'igual')
    const { remote } = fakeRemote({ 'k-a': 'igual' })
    const result = await hydrate('u1', storage, remote, keys)
    expect(result.backedUp).toEqual([])
    expect(storage.getItem(backupKey)).toBeNull()
  })

  it('não passa dados de uma conta para outra no mesmo browser', async () => {
    const storage = new FakeStorage()
    storage.setItem(ownerKey, 'u1')
    storage.setItem('k-a', 'dados da conta 1')
    const { remote, cloud } = fakeRemote()
    await hydrate('u2', storage, remote, keys)
    expect(storage.getItem('k-a')).toBeNull()
    expect(cloud.has('k-a')).toBe(false)
    expect(storage.getItem(ownerKey)).toBe('u2')
  })

  it('falha sem alterar a conta quando a nuvem não responde', async () => {
    const storage = new FakeStorage()
    const remote: SyncRemote = { load: async () => { throw new Error('offline') }, save: async () => {} }
    await expect(hydrate('u1', storage, remote, keys)).rejects.toThrow('offline')
    expect(storage.getItem(ownerKey)).toBeNull()
  })
})

describe('clearSyncedKeys', () => {
  it('limpa só as chaves sincronizadas e o dono', () => {
    const storage = new FakeStorage()
    storage.setItem('k-a', '1')
    storage.setItem('outra', '2')
    storage.setItem(ownerKey, 'u1')
    clearSyncedKeys(storage, keys)
    expect(storage.getItem('k-a')).toBeNull()
    expect(storage.getItem(ownerKey)).toBeNull()
    expect(storage.getItem('outra')).toBe('2')
  })
})

describe('createUploader', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('junta escritas seguidas e envia só o último valor', async () => {
    const { remote, saves } = fakeRemote()
    const uploader = createUploader(remote, new Map(), { delay: 100 })
    uploader.schedule('k-a', '1')
    uploader.schedule('k-a', '2')
    uploader.schedule('k-a', '3')
    await vi.advanceTimersByTimeAsync(150)
    expect(saves).toEqual([['k-a', '3']])
  })

  it('não envia valores iguais ao último sincronizado', async () => {
    const { remote, saves } = fakeRemote()
    const uploader = createUploader(remote, new Map([['k-a', 'igual']]), { delay: 100 })
    uploader.schedule('k-a', 'igual')
    await vi.advanceTimersByTimeAsync(150)
    expect(saves).toEqual([])
    expect(uploader.pendingCount()).toBe(0)
  })

  it('cancela o envio quando o valor volta ao que já estava sincronizado', async () => {
    const { remote, saves } = fakeRemote()
    const uploader = createUploader(remote, new Map([['k-a', 'base']]), { delay: 100 })
    uploader.schedule('k-a', 'novo')
    uploader.schedule('k-a', 'base')
    await vi.advanceTimersByTimeAsync(150)
    expect(saves).toEqual([])
  })

  it('envia remoções como null', async () => {
    const { remote, saves } = fakeRemote({ 'k-a': '1' })
    const uploader = createUploader(remote, new Map([['k-a', '1']]), { delay: 100 })
    uploader.schedule('k-a', null)
    await uploader.flush()
    expect(saves).toEqual([['k-a', null]])
  })

  it('flush envia já, sem esperar pelo atraso', async () => {
    const { remote, saves } = fakeRemote()
    const uploader = createUploader(remote, new Map(), { delay: 10_000 })
    uploader.schedule('k-b', 'x')
    await uploader.flush()
    expect(saves).toEqual([['k-b', 'x']])
    expect(uploader.pendingCount()).toBe(0)
  })

  it('mantém o que falhou e tenta outra vez', async () => {
    const { remote, saves } = fakeRemote()
    const statuses: string[] = []
    const uploader = createUploader(remote, new Map(), { delay: 100, retryDelay: 1000, onStatus: (s) => statuses.push(s) })
    remote.fail = true
    uploader.schedule('k-a', 'v')
    await vi.advanceTimersByTimeAsync(150)
    expect(statuses.at(-1)).toBe('error')
    expect(uploader.pendingCount()).toBe(1)

    remote.fail = false
    await vi.advanceTimersByTimeAsync(1100)
    expect(saves).toEqual([['k-a', 'v']])
    expect(statuses.at(-1)).toBe('idle')
  })

  it('uma escrita nova durante a falha não é substituída pelo valor antigo', async () => {
    const { remote, saves } = fakeRemote()
    const uploader = createUploader(remote, new Map(), { delay: 100, retryDelay: 1000 })
    remote.fail = true
    uploader.schedule('k-a', 'velho')
    await vi.advanceTimersByTimeAsync(150)
    uploader.schedule('k-a', 'novo')
    remote.fail = false
    await vi.advanceTimersByTimeAsync(1100)
    expect(saves).toEqual([['k-a', 'novo']])
  })
})

describe('installStorageSync', () => {
  it('avisa as escritas e remoções das chaves sincronizadas e nada mais', () => {
    class Store extends FakeStorage {}
    const mine = new Store()
    const other = new Store()
    const calls: [string, string | null][] = []
    const uninstall = installStorageSync(Store.prototype, (s) => s === mine, keys, (k, v) => calls.push([k, v]))

    mine.setItem('k-a', '1')
    mine.setItem('fora', '2')
    mine.removeItem('k-a')
    other.setItem('k-b', '3')
    expect(calls).toEqual([['k-a', '1'], ['k-a', null]])
    expect(mine.getItem('fora')).toBe('2')

    uninstall()
    mine.setItem('k-b', '4')
    expect(calls).toHaveLength(2)
    expect(mine.getItem('k-b')).toBe('4')
  })
})
