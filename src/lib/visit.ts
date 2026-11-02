// Dados de contacto de uma visita: link do imóvel e contacto do vendedor.

/** Link seguro para abrir: só http(s); sem esquema, assume https. Devolve '' se não for um link válido. */
export function normalizeLink(value: string) {
  const text = value.trim()
  if (!text) return ''
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(withScheme)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.') ? url.toString() : ''
  } catch {
    return ''
  }
}

/** Nome curto do site de um link, para mostrar em vez do endereço completo. */
export function linkLabel(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return link
  }
}

/** Se o contacto tiver um número de telefone, devolve o `tel:` para ligar com um clique. */
export function phoneHref(contact: string) {
  const match = /(\+?\d[\d\s.-]{7,}\d)/.exec(contact)
  if (!match) return ''
  const digits = match[1].replace(/[^\d+]/g, '')
  return digits.replace(/\D/g, '').length >= 9 ? `tel:${digits}` : ''
}
