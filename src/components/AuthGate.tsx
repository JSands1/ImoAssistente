import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider, type User } from 'firebase/auth'
import { LogOut } from 'lucide-react'
import { firebaseAuth, firebaseConfigured } from '../lib/firebase'
import { firestoreRemote } from '../lib/firestore-remote'
import { clearSyncedKeys, createUploader, hydrate, installStorageSync, syncedKeys, type SyncStatus } from '../lib/cloud-sync'
import { AccountContext, type Account } from '../lib/account'
import { isAdminEmail } from '../lib/admin'
import { publishStats } from '../lib/usage'
import './AuthGate.css'

type State =
  | { status: 'loading' }
  | { status: 'out' }
  | { status: 'syncing'; user: User }
  | { status: 'error'; user: User }
  | { status: 'in'; user: User }

type Session = { flush: () => Promise<void>; pendingCount: () => number; uninstall: () => void }

const errorMessages: Record<string, string> = {
  'auth/popup-blocked': 'O browser bloqueou a janela de login. Permite pop-ups para este site e tenta outra vez.',
  'auth/network-request-failed': 'Sem ligação à internet. Verifica a rede e tenta outra vez.',
  'auth/unauthorized-domain': 'Este endereço ainda não está autorizado no Firebase (Authentication > Settings > Authorized domains).',
  'auth/operation-not-allowed': 'O login com Google ainda não está ativo no Firebase (Authentication > Sign-in method).',
}

function accountOf(user: User): Account {
  const email = user.email ?? ''
  return { uid: user.uid, email, name: user.displayName ?? email, isAdmin: isAdminEmail(email) }
}

const statsInterval = 60_000

const syncLabels: Record<SyncStatus, string> = {
  idle: 'Dados guardados na nuvem',
  saving: 'A guardar…',
  error: 'Não foi possível guardar. A tentar outra vez…',
}

function loginError(error: unknown) {
  const code = (error as { code?: string })?.code ?? ''
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return ''
  return errorMessages[code] ?? 'Não foi possível iniciar sessão. Tenta outra vez.'
}

// Exige login Google antes de mostrar o painel e, ao entrar, traz os dados da conta do Firestore para o localStorage
// (e envia para lá o que já existia neste browser). Sem as variáveis VITE_FIREBASE_* a app continua aberta, só com localStorage.
export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: firebaseConfigured ? 'loading' : 'out' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [attempt, setAttempt] = useState(0)
  const session = useRef<Session | null>(null)
  const user = useRef<User | null>(null)
  const lastStats = useRef(0)

  const stopSession = useCallback(() => {
    session.current?.uninstall()
    session.current = null
  }, [])

  useEffect(() => {
    if (!firebaseConfigured) return
    return onAuthStateChanged(firebaseAuth(), (next) => {
      user.current = next
      stopSession()
      setState(next ? { status: 'syncing', user: next } : { status: 'out' })
      setAttempt((count) => count + 1)
    })
  }, [stopSession])

  useEffect(() => {
    const current = user.current
    if (!current) return
    let cancelled = false
    const remote = firestoreRemote(current.uid)
    hydrate(current.uid, localStorage, remote)
      .then(({ baseline }) => {
        if (cancelled) return
        const account = accountOf(current)
        // A ficha da conta (contagens e última visita) para o administrador: ao entrar e, no máximo, uma vez por minuto ao guardar.
        const publish = () => { lastStats.current = Date.now(); void publishStats(account) }
        const uploader = createUploader(remote, baseline, {
          onStatus: (status) => {
            setSyncStatus(status)
            if (status === 'idle' && Date.now() - lastStats.current > statsInterval) publish()
          },
        })
        const uninstall = installStorageSync(Storage.prototype, (storage) => storage === localStorage, syncedKeys, uploader.schedule)
        session.current = { flush: uploader.flush, pendingCount: uploader.pendingCount, uninstall }
        publish()
        setSyncStatus('idle')
        setState({ status: 'in', user: current })
      })
      .catch(() => { if (!cancelled) setState({ status: 'error', user: current }) })
    return () => { cancelled = true }
  }, [attempt])

  // Envia o que ainda estiver por guardar quando o separador fica em segundo plano ou fecha.
  useEffect(() => {
    const flush = () => { void session.current?.flush() }
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  if (!firebaseConfigured) return <>{children}</>
  if (state.status === 'loading') return <div className="auth-screen" aria-busy="true" />

  async function logOut() {
    const active = session.current
    if (active) {
      await active.flush()
      stopSession()
      // Só limpa os dados deste browser se já estão todos na nuvem; senão ficam cá para não se perderem.
      if (active.pendingCount() === 0) clearSyncedKeys(localStorage)
    }
    await signOut(firebaseAuth())
  }

  if (state.status === 'syncing') {
    return <div className="auth-screen" aria-busy="true"><p className="auth-intro">A carregar os teus dados…</p></div>
  }

  if (state.status === 'error') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="auth-brand">Imo<span>Assistente</span>AI</p>
          <h1>Não foi possível carregar os dados</h1>
          <p className="auth-intro">Verifica a ligação à internet e tenta outra vez. Os dados deste browser não foram alterados.</p>
          <button className="auth-google" type="button" onClick={() => { setState({ status: 'syncing', user: state.user }); setAttempt((count) => count + 1) }}>Tentar outra vez</button>
          <button className="auth-back auth-link" type="button" onClick={() => { void logOut() }}>Terminar sessão</button>
        </div>
      </div>
    )
  }

  if (state.status === 'in') {
    const { user: account } = state
    return (
      <AccountContext.Provider value={accountOf(account)}>
        {children}
        <div className="auth-chip">
          <i className={`auth-sync is-${syncStatus}`} title={syncLabels[syncStatus]} role="status" aria-label={syncLabels[syncStatus]} />
          <span title={account.email ?? undefined}>{account.displayName ?? account.email}</span>
          <button type="button" onClick={() => { void logOut() }} aria-label="Terminar sessão" title="Terminar sessão">
            <LogOut size={14} />
          </button>
        </div>
      </AccountContext.Provider>
    )
  }

  const signIn = async () => {
    setBusy(true)
    setError('')
    try {
      await signInWithPopup(firebaseAuth(), new GoogleAuthProvider())
    } catch (e) {
      setError(loginError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <p className="auth-brand">Imo<span>Assistente</span>AI</p>
        <h1>Entra no teu painel</h1>
        <p className="auth-intro">Os teus clientes, visitas e imóveis ficam associados à tua conta e só tu lhes acedes.</p>
        <button className="auth-google" type="button" onClick={signIn} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
            <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          {busy ? 'A abrir o Google…' : 'Continuar com o Google'}
        </button>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <a className="auth-back" href="/">Voltar ao site</a>
      </div>
    </div>
  )
}
