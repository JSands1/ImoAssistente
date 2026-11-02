const appointmentsKey = 'casanexa-appointments'
const extrasKey = 'casanexa-search-extras'

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

function isAppointmentOf(clientId: string, item: unknown) {
  return Boolean(item) && typeof item === 'object' && (item as { clientId?: unknown }).clientId === clientId
}

// Quantas marcações da agenda pertencem a este cliente (para avisar antes de apagar).
export function clientAppointmentCount(clientId: string) {
  const list = readJson(appointmentsKey)
  return Array.isArray(list) ? list.filter((item) => isAppointmentOf(clientId, item)).length : 0
}

// Ao apagar um cliente, remove também o que depende dele noutras páginas: as marcações da agenda e os dados
// específicos da procura. Sem isto ficariam visitas a apontar para "Cliente removido".
export function purgeClientTraces(clientId: string) {
  try {
    const appointments = readJson(appointmentsKey)
    if (Array.isArray(appointments)) {
      localStorage.setItem(appointmentsKey, JSON.stringify(appointments.filter((item) => !isAppointmentOf(clientId, item))))
    }
    const extras = readJson(extrasKey)
    if (extras && typeof extras === 'object' && !Array.isArray(extras) && clientId in extras) {
      const rest = { ...(extras as Record<string, unknown>) }
      delete rest[clientId]
      localStorage.setItem(extrasKey, JSON.stringify(rest))
    }
  } catch {
    // Sem armazenamento disponível: não há nada a limpar.
  }
}

export function deleteConfirmation(name: string, appointmentCount: number) {
  const label = name.trim() || 'este cliente'
  const removed = ['a ficha', 'as visitas e notas', 'a compra']
  if (appointmentCount > 0) removed.push(`${appointmentCount} ${appointmentCount === 1 ? 'marcação' : 'marcações'} na agenda`)
  return `Apagar ${label}?\n\nVai ser removido: ${removed.join(', ')} e as preferências de procura.\n\nNão dá para desfazer. Se quiseres guardar uma cópia, descarrega-a primeiro no Histórico.`
}
