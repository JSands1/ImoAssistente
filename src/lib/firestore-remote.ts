import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { firestore } from './firebase'
import type { SyncRemote } from './cloud-sync'

const prefix = 'casanexa-'
// Um documento do Firestore tem no máximo 1 MiB.
const maxValueLength = 900_000

// Cada chave vira um documento em users/{uid}/data/{chave sem prefixo}, com o JSON guardado como texto em `value`.
// As regras do Firestore só deixam cada conta aceder ao seu próprio users/{uid}.
export function firestoreRemote(uid: string): SyncRemote {
  const db = firestore()
  const ref = (key: string) => doc(db, 'users', uid, 'data', key.startsWith(prefix) ? key.slice(prefix.length) : key)

  return {
    async load() {
      const snapshot = await getDocs(collection(db, 'users', uid, 'data'))
      const values: Record<string, string> = {}
      snapshot.forEach((item) => {
        const value: unknown = item.data().value
        if (typeof value === 'string') values[`${prefix}${item.id}`] = value
      })
      return values
    },
    async save(key, value) {
      if (value === null) return deleteDoc(ref(key))
      if (value.length > maxValueLength) throw new Error(`Os dados de "${key}" são demasiado grandes para guardar na nuvem.`)
      return setDoc(ref(key), { value, updatedAt: serverTimestamp() })
    },
  }
}
