import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Configuração do projeto Firebase (valores em .env, com prefixo VITE_). Sem ela a app continua a funcionar só com o
// localStorage, por isso nada daqui deve ser importado fora das páginas que realmente usem o Firebase.
const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId)

// Chave do site do reCAPTCHA Enterprise (Fraud Defense) do projeto, registada em Firebase > App Check. Com ela, o Firebase só aceita pedidos (por exemplo à IA) vindos desta app.
const appCheckSiteKey: string | undefined = import.meta.env.VITE_APPCHECK_SITE_KEY

export function firebaseApp() {
  if (!firebaseConfigured) throw new Error('O Firebase não está configurado: faltam as variáveis VITE_FIREBASE_* no ficheiro .env.')
  if (getApps().length > 0) return getApp()
  const app = initializeApp(config)
  if (appCheckSiteKey) {
    // Em localhost o reCAPTCHA não valida: o browser mostra na consola um token de depuração, a registar em App Check > Apps.
    if (import.meta.env.DEV) (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = true
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true })
  }
  return app
}

export const firebaseAuth = () => getAuth(firebaseApp())
export const firestore = () => getFirestore(firebaseApp())
