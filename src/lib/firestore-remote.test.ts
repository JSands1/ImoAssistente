// @vitest-environment node
/// <reference types="node" />
// Teste de integração com os emuladores do Firebase (as regras reais de firestore.rules). Só corre dentro de:
//   npx firebase emulators:exec --only auth,firestore --project demo-imoassistenteai "npx vitest run src/lib/firestore-remote.test.ts"
import { describe, expect, it, vi } from 'vitest'
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth'
import { addDoc, collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'
import { firestoreRemote } from './firestore-remote'
import { createUploader, hydrate, type StorageLike } from './cloud-sync'

const emulator = process.env.FIRESTORE_EMULATOR_HOST
const suite = emulator ? describe : describe.skip

const app = initializeApp({ projectId: 'demo-imoassistenteai', apiKey: 'demo' })
const auth = getAuth(app)
const db = getFirestore(app)
if (emulator) {
  const [host, port] = emulator.split(':')
  connectFirestoreEmulator(db, host, Number(port))
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`, { disableWarnings: true })
}

vi.mock('./firebase', () => ({ firestore: () => db }))

class MemoryStorage implements StorageLike {
  data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
}

async function signUp(email: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, 'segredo123')
  return credential.user.uid
}

suite('firestoreRemote com as regras reais', () => {
  it('guarda, lê e apaga os dados da própria conta', async () => {
    const uid = await signUp('a@example.com')
    const remote = firestoreRemote(uid)
    await remote.save('casanexa-history', '[{"id":"k1"}]')
    await remote.save('casanexa-consultant', '{"name":"Ana"}')
    expect(await remote.load()).toEqual({ 'casanexa-history': '[{"id":"k1"}]', 'casanexa-consultant': '{"name":"Ana"}' })
    await remote.save('casanexa-consultant', null)
    expect(Object.keys(await remote.load())).toEqual(['casanexa-history'])
  })

  it('migra o localStorage, sincroniza alterações e a segunda conta não vê nada', async () => {
    await signOut(auth)
    const uid = await signUp('b@example.com')
    const remote = firestoreRemote(uid)
    const storage = new MemoryStorage()
    storage.setItem('casanexa-properties', '[{"id":"real-1"}]')

    const result = await hydrate(uid, storage, remote)
    expect(result.pushed).toBe(1)

    const uploader = createUploader(remote, result.baseline, { delay: 10 })
    uploader.schedule('casanexa-history', '[{"id":"k9"}]')
    await uploader.flush()

    // outro dispositivo da mesma conta
    const other = new MemoryStorage()
    await hydrate(uid, other, remote)
    expect(other.getItem('casanexa-properties')).toBe('[{"id":"real-1"}]')
    expect(other.getItem('casanexa-history')).toBe('[{"id":"k9"}]')

    // outra conta
    await signOut(auth)
    const stranger = await signUp('c@example.com')
    const strangerStorage = new MemoryStorage()
    await hydrate(stranger, strangerStorage, firestoreRemote(stranger))
    expect(strangerStorage.getItem('casanexa-properties')).toBeNull()
  })

  it('as regras negam o acesso aos dados de outra conta', async () => {
    const mine = await signUp('d@example.com')
    await firestoreRemote(mine).save('casanexa-history', '[]')
    await signOut(auth)
    await signUp('e@example.com')
    await expect(getDoc(doc(db, 'users', mine, 'data', 'history'))).rejects.toThrow(/permission|false for/i)
    await expect(setDoc(doc(db, 'users', mine, 'data', 'history'), { value: 'x' })).rejects.toThrow(/permission|false for/i)
    await expect(firestoreRemote(mine).load()).rejects.toThrow(/permission|false for/i)
  })

  it('sem login as regras negam tudo', async () => {
    await signOut(auth)
    await expect(firestoreRemote('qualquer').load()).rejects.toThrow(/permission|false for/i)
  })
})

// O emulador de Auth aceita um "id token" do Google em JSON, o que permite escolher o email e se está verificado.
async function signInAs(sub: string, email: string, verified = true) {
  await signOut(auth)
  const credential = GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: verified }))
  return (await signInWithCredential(auth, credential)).user.uid
}

const usage = (uid: string, patch: Record<string, unknown> = {}) => ({ uid, kind: 'report', model: 'm', inputTokens: 10, outputTokens: 5, ok: true, at: serverTimestamp(), ...patch })
const denied = /permission|false for|null value/i
const adminEmail = 'joaoareias123@gmail.com'

suite('regras de usage e stats (painel de administração)', () => {
  it('cada conta só cria registos de uso com o seu uid e com o formato certo', async () => {
    const uid = await signInAs('regras-u1', 'u1@example.com')
    await addDoc(collection(db, 'usage'), usage(uid))
    await expect(addDoc(collection(db, 'usage'), usage('outra-conta'))).rejects.toThrow(denied)
    await expect(addDoc(collection(db, 'usage'), usage(uid, { extra: 1 }))).rejects.toThrow(denied)
    await expect(addDoc(collection(db, 'usage'), usage(uid, { kind: 'outro' }))).rejects.toThrow(denied)
    await expect(addDoc(collection(db, 'usage'), usage(uid, { inputTokens: -1 }))).rejects.toThrow(denied)
    await expect(addDoc(collection(db, 'usage'), usage(uid, { inputTokens: 1.5 }))).rejects.toThrow(denied)
    await expect(addDoc(collection(db, 'usage'), usage(uid, { at: new Date(2020, 0, 1) }))).rejects.toThrow(denied)
  })

  it('uma conta normal não lê os registos de uso, nem altera os existentes', async () => {
    const uid = await signInAs('regras-u2', 'u2@example.com')
    const ref = await addDoc(collection(db, 'usage'), usage(uid))
    await expect(getDocs(collection(db, 'usage'))).rejects.toThrow(denied)
    await expect(setDoc(ref, usage(uid, { inputTokens: 0 }))).rejects.toThrow(denied)
  })

  // Corre antes do teste do administrador: o emulador não aceita o mesmo email com e sem verificação.
  it('o mesmo email sem verificação não é administrador', async () => {
    await signInAs('regras-falso', adminEmail, false)
    await expect(getDocs(collection(db, 'usage'))).rejects.toThrow(denied)
    await expect(getDocs(collection(db, 'stats'))).rejects.toThrow(denied)
  })

  it('o administrador com email verificado lê todos os registos e fichas', async () => {
    const uid = await signInAs('regras-u3', 'u3@example.com')
    await addDoc(collection(db, 'usage'), usage(uid))
    await setDoc(doc(db, 'stats', uid), { email: 'u3@example.com', name: 'U3', clients: 2, properties: 1, appointments: 0, lastSeenAt: serverTimestamp() })

    await signInAs('regras-admin', adminEmail)
    expect((await getDocs(collection(db, 'usage'))).size).toBeGreaterThan(0)
    expect((await getDocs(collection(db, 'stats'))).docs.some((item) => item.id === uid)).toBe(true)
  })

  it('cada conta só escreve a sua ficha e não lê as dos outros', async () => {
    const mine = await signInAs('regras-u4', 'u4@example.com')
    const card = { email: 'u4@example.com', name: 'U4', clients: 0, properties: 0, appointments: 0, lastSeenAt: serverTimestamp() }
    await setDoc(doc(db, 'stats', mine), card)
    expect((await getDoc(doc(db, 'stats', mine))).exists()).toBe(true)
    await expect(setDoc(doc(db, 'stats', 'outra-conta'), card)).rejects.toThrow(denied)
    await expect(setDoc(doc(db, 'stats', mine), { ...card, extra: true })).rejects.toThrow(denied)
    await expect(setDoc(doc(db, 'stats', mine), { ...card, clients: 'muitos' })).rejects.toThrow(denied)

    await signInAs('regras-u5', 'u5@example.com')
    await expect(getDoc(doc(db, 'stats', mine))).rejects.toThrow(denied)
  })
})
