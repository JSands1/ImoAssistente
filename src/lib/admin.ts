// Contas com acesso ao painel de administração. É só para mostrar o menu: quem pode mesmo ler as métricas é decidido
// pelas regras do Firestore (firestore.rules), que têm a mesma lista de emails.
const configured: string | undefined = import.meta.env.VITE_ADMIN_EMAILS

export const adminEmails = (configured ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email) && adminEmails.includes(String(email).toLowerCase())
}
