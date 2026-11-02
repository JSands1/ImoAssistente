import { createContext, useContext } from 'react'

export type Account = { uid: string; email: string; name: string; isAdmin: boolean }

// Fornecido pelo AuthGate. Sem Firebase configurado (modo só localStorage) não há conta.
export const AccountContext = createContext<Account | null>(null)

export const useAccount = () => useContext(AccountContext)
