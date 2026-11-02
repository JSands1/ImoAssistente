type HostWindow = { screenX: number; screenY: number; outerWidth: number; outerHeight: number }

// Janela pequena encostada ao canto superior direito da janela da app, para a plataforma continuar visível.
export function popupFeatures(host: HostWindow, size = { width: 520, height: 780 }) {
  const width = Math.min(size.width, Math.max(360, host.outerWidth - 80))
  const height = Math.min(size.height, Math.max(480, host.outerHeight - 80))
  const left = Math.round(host.screenX + host.outerWidth - width - 16)
  const top = Math.round(host.screenY + 48)
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`
}

let portalWindow: Window | null = null

// Abre o endereço numa janela pequena. Cliques seguintes reutilizam a mesma janela, para não acumular janelas.
// Se o browser bloquear a janela, abre um separador normal.
export function openInPopup(url: string) {
  if (portalWindow && !portalWindow.closed) {
    portalWindow.location.href = url
    portalWindow.focus()
    return
  }
  const popup = window.open('about:blank', 'casanexa-portal', popupFeatures(window))
  if (!popup) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  // O portal não deve poder aceder à nossa página através de window.opener.
  popup.opener = null
  popup.location.href = url
  portalWindow = popup
  popup.focus()
}

// Cliques com Ctrl, Cmd, Shift ou botão do meio mantêm o comportamento normal do browser (separador novo).
export function shouldUsePopup(event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; button: number }) {
  return !(event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0)
}
