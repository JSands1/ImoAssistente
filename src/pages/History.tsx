import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Check, Copy, Download, Mail, MessageCircle, Plus, Trash2, Upload, X } from 'lucide-react'
import {
  buildContactMessage,
  clientStatusLabel,
  contactSubject,
  describePurchase,
  emptyFilters,
  filterClients,
  formatDate,
  hasActiveFilters,
  historyTypologies,
  houseTypeOptions,
  interestOptions,
  isEmail,
  mailtoUrl,
  mergeClients,
  newClient,
  newPurchase,
  newVisit,
  parseBackup,
  parseHistory,
  serializeBackup,
  sortClients,
  statusOptions,
  todayIso,
  visitStats,
  type ContactKind,
  type HistoryClient,
  type HistoryFilters,
  type Purchase,
  type Visit,
} from '../lib/history'
import { clientAppointmentCount, deleteConfirmation, purgeClientTraces } from '../lib/client-cleanup'
import { whatsappNumber, whatsappUrl } from '../lib/portal-links'
import './VideoStudio.css'
import './History.css'

const storageKey = 'casanexa-history'
const signatureKey = 'casanexa-signature'

function readStorage(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Sem armazenamento disponível: o trabalho continua apenas em memória.
  }
}

function numberValue(event: ChangeEvent<HTMLInputElement>) {
  return event.target.value === '' ? null : Number(event.target.value)
}

export default function History({ initialClientId = '', onOpenPortfolio }: { initialClientId?: string; onOpenPortfolio?: (clientId: string) => void }) {
  const [clients, setClients] = useState<HistoryClient[]>(() => parseHistory(readStorage(storageKey)))
  const [selectedId, setSelectedId] = useState(() => (clients.some((item) => item.id === initialClientId) ? initialClientId : ''))
  const [filters, setFilters] = useState<HistoryFilters>(emptyFilters)
  const [signature, setSignature] = useState(() => {
    const saved = readStorage(signatureKey)
    return typeof saved === 'string' ? saved : ''
  })
  const [contactKind, setContactKind] = useState<ContactKind>(() => (clients.find((item) => item.id === initialClientId)?.status === 'comprou' ? 'vender' : 'retomar'))
  const [customMessage, setCustomMessage] = useState<string | null>(null)
  const [visitDraft, setVisitDraft] = useState<Visit>(() => newVisit(todayIso()))
  const [notice, setNotice] = useState('')
  // Cliente novo ainda por guardar: só entra no histórico quando se carrega em "Guardar cliente".
  const [draft, setDraft] = useState<HistoryClient | null>(null)
  const [draftBase, setDraftBase] = useState('')
  const [copied, setCopied] = useState(false)
  const backupInput = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => sortClients(filterClients(clients, filters)), [clients, filters])
  const client = draft ?? clients.find((item) => item.id === selectedId)
  const isDraft = draft !== null
  const isDirty = draft !== null && JSON.stringify(draft) !== draftBase
  const activeId = draft?.id ?? selectedId
  const stats = client ? visitStats(client) : null

  const detailRef = useRef<HTMLElement>(null)
  const scrollPending = useRef(false)

  useEffect(() => { writeStorage(storageKey, clients) }, [clients])

  function scrollToDetail() {
    const node = detailRef.current
    if (!node) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    node.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
  }

  // Depois de abrir o formulário novo (ou, em ecrãs estreitos, escolher um cliente), desce até à ficha e põe o cursor no primeiro campo.
  useEffect(() => {
    if (!scrollPending.current || !activeId) return
    scrollPending.current = false
    scrollToDetail()
  }, [activeId])
  useEffect(() => { writeStorage(signatureKey, signature) }, [signature])

  const autoMessage = client ? buildContactMessage(contactKind, client, signature) : ''
  const message = customMessage ?? autoMessage
  const phoneOk = client ? whatsappNumber(client.phone) !== '' : false
  const emailOk = client ? isEmail(client.email) : false

  function selectClient(id: string, scroll = false) {
    if (draft) {
      if (isDirty && !window.confirm('Tens um cliente novo por guardar. Descartá-lo? Os dados preenchidos perdem-se.')) return
      setDraft(null)
    }
    scrollPending.current = scroll
    setSelectedId(id)
    setCustomMessage(null)
    setCopied(false)
    setNotice('')
    setVisitDraft(newVisit(todayIso()))
    const next = clients.find((item) => item.id === id)
    setContactKind(next?.status === 'comprou' ? 'vender' : 'retomar')
  }

  // "Novo cliente" só abre o formulário vazio e leva-te até ele: nada é gravado até carregares em "Guardar cliente".
  function startNewClient() {
    setNotice('')
    if (draft) {
      scrollToDetail()
      return
    }
    const fresh = newClient(todayIso())
    setDraftBase(JSON.stringify(fresh))
    scrollPending.current = true
    setFilters(emptyFilters)
    setSelectedId('')
    setDraft(fresh)
  }

  function saveDraft() {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) {
      setNotice('Indica o nome do cliente para o guardar.')
      detailRef.current?.querySelector<HTMLInputElement>('input')?.focus()
      return
    }
    if (draft.wants.propertyTypes.length === 0) {
      setNotice('Escolhe pelo menos um tipo de casa que o cliente procura.')
      detailRef.current?.querySelector<HTMLInputElement>('[data-property-type]')?.focus()
      return
    }
    setClients((current) => [{ ...draft, name }, ...current])
    // Fica um formulário novo e vazio, pronto para o cliente seguinte.
    const fresh = newClient(todayIso())
    setDraftBase(JSON.stringify(fresh))
    setDraft(fresh)
    setNotice(`${name} foi guardado no histórico. Podes adicionar outro cliente.`)
    requestAnimationFrame(() => detailRef.current?.querySelector<HTMLInputElement>('input')?.focus())
  }

  function cancelDraft() {
    if (isDirty && !window.confirm('Descartar o cliente novo? Os dados preenchidos perdem-se.')) return
    setDraft(null)
    setNotice('')
  }

  function updateClient(patch: Partial<HistoryClient>) {
    if (draft) {
      setDraft({ ...draft, ...patch })
      return
    }
    if (!client) return
    setClients((current) => current.map((item) => item.id === client.id ? { ...item, ...patch } : item))
  }

  function changeStatus(status: HistoryClient['status']) {
    if (!client) return
    updateClient({ status, purchase: status === 'comprou' ? client.purchase ?? newPurchase(todayIso()) : client.purchase })
    setContactKind(status === 'comprou' ? 'vender' : 'retomar')
    setCustomMessage(null)
  }

  function updatePurchase(patch: Partial<Purchase>) {
    if (!client?.purchase) return
    updateClient({ purchase: { ...client.purchase, ...patch } })
  }

  function addVisit() {
    if (!client) return
    if (!visitDraft.property.trim() && !visitDraft.notes.trim()) {
      setNotice('Indica o imóvel visitado ou escreve uma nota para registar a visita.')
      return
    }
    setNotice('')
    updateClient({ visits: [...client.visits, { ...visitDraft, id: crypto.randomUUID() }] })
    setVisitDraft(newVisit(todayIso()))
  }

  function updateVisit(id: string, patch: Partial<Visit>) {
    if (!client) return
    updateClient({ visits: client.visits.map((visit) => visit.id === id ? { ...visit, ...patch } : visit) })
  }

  function removeVisit(id: string) {
    if (!client) return
    updateClient({ visits: client.visits.filter((visit) => visit.id !== id) })
  }

  function removeClient() {
    if (!client || !window.confirm(deleteConfirmation(client.name, clientAppointmentCount(client.id)))) return
    purgeClientTraces(client.id)
    setClients((current) => current.filter((item) => item.id !== client.id))
    setSelectedId('')
  }

  function markContacted() {
    updateClient({ lastContactAt: todayIso() })
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setNotice('Não foi possível copiar automaticamente. Seleciona o texto e copia manualmente.')
    }
  }

  function downloadBackup() {
    const blob = new Blob([serializeBackup(clients)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `historico-imoassistenteai-${todayIso()}.json`
    link.style.display = 'none'
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function loadBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const { clients: imported, error } = parseBackup(await file.text())
    if (error) {
      setNotice(error)
      return
    }
    const { merged, added, updated } = mergeClients(clients, imported)
    if (!window.confirm(`Importar ${imported.length} clientes (${added} novos, ${updated} já existentes que serão substituídos)?`)) return
    setClients(merged)
    setNotice(`Cópia carregada: ${added} novos e ${updated} atualizados.`)
  }

  function setFilter<K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className="history-page">
      <header className="history-heading">
        <div><span className="eyebrow">HISTÓRICO</span><h2>Histórico de clientes</h2><p>Regista o início de cada cliente, as visitas e as notas de cada uma, e a casa que comprou. Pesquisa por período e tipo de casa para voltares a contactar quem comprou e saber se quer vender.</p></div>
        <div className="hx-actions">
          <button className="dash-button primary" type="button" onClick={startNewClient}><Plus size={14} /> Novo cliente</button>
          <button className="dash-button" type="button" disabled={clients.length === 0} onClick={downloadBackup}><Download size={14} /> Descarregar cópia</button>
          <button className="dash-button" type="button" onClick={() => backupInput.current?.click()}><Upload size={14} /> Carregar cópia</button>
          <input ref={backupInput} className="studio-file-input" type="file" accept="application/json,.json" onChange={loadBackup} aria-label="Carregar cópia do histórico" />
        </div>
      </header>

      <p className="hx-privacy">Os dados dos clientes ficam só neste browser, sem cópia de segurança automática: descarrega uma cópia de vez em quando. Confirma que tens autorização do cliente para o contactares para estes fins (RGPD).</p>
      {notice && <p className="hx-notice" role="status">{notice} <button className="inline-link" type="button" onClick={() => setNotice('')}>Fechar</button></p>}

      <section className="hx-card dash-panel">
        <div className="hx-card-heading"><div><span className="eyebrow">PESQUISAR</span><h3>Filtrar o histórico</h3></div>{hasActiveFilters(filters) && <button className="dash-button quiet" type="button" onClick={() => setFilters(emptyFilters)}><X size={14} /> Limpar filtros</button>}</div>
        <div className="hx-filters">
          <label className="studio-field hx-span-2">Nome, email, telefone ou notas<input value={filters.text} placeholder="Ex.: João, garagem, obras…" onChange={(event) => setFilter('text', event.target.value)} /></label>
          <label className="studio-field">Estado<select value={filters.status} onChange={(event) => setFilter('status', event.target.value as HistoryFilters['status'])}><option value="">Todos</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="studio-field">Compra a partir de<input type="date" value={filters.purchasedFrom} onChange={(event) => setFilter('purchasedFrom', event.target.value)} /></label>
          <label className="studio-field">Compra até<input type="date" value={filters.purchasedTo} onChange={(event) => setFilter('purchasedTo', event.target.value)} /></label>
          <label className="studio-field">Tipo de casa comprada<select value={filters.propertyType} onChange={(event) => setFilter('propertyType', event.target.value as HistoryFilters['propertyType'])}><option value="">Todos</option>{houseTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="studio-field">Tipologia<select value={filters.typology} onChange={(event) => setFilter('typology', event.target.value)}><option value="">Todas</option>{historyTypologies.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="studio-field">Localização da compra<input value={filters.location} placeholder="Ex.: Torres Vedras" onChange={(event) => setFilter('location', event.target.value)} /></label>
        </div>
        <p className="hx-hint">Os filtros de período, tipo, tipologia e localização aplicam-se à casa comprada, por isso só mostram clientes com estado "Comprou". {filtered.length} de {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}.</p>
      </section>

      <div className="hx-layout">
        <section className="hx-list dash-panel" aria-label="Clientes">
          {isDraft && (
            <div className="hx-row selected hx-row-draft"><span className="hx-row-top"><strong>{draft.name.trim() || 'Novo cliente'}</strong><span className="hx-tag">Por guardar</span></span><small>Preenche a ficha ao lado e carrega em "Guardar cliente".</small></div>
          )}
          {clients.length === 0 ? (
            isDraft ? null : <div className="hx-empty">Ainda não há clientes. Carrega em "Novo cliente" para registares o primeiro.</div>
          ) : filtered.length === 0 ? (
            <div className="hx-empty">Nenhum cliente corresponde aos filtros.</div>
          ) : filtered.map((item) => {
            const itemStats = visitStats(item)
            return (
              <button type="button" key={item.id} className={item.id === selectedId ? 'hx-row selected' : 'hx-row'} onClick={() => selectClient(item.id, window.innerWidth <= 1000)}>
                <span className="hx-row-top"><strong>{item.name || 'Sem nome'}</strong><span className={`hx-tag ${item.status}`}>{clientStatusLabel(item.status)}</span></span>
                <small>Cliente desde {formatDate(item.startedAt)} · {itemStats.count} {itemStats.count === 1 ? 'visita' : 'visitas'}</small>
                {item.status === 'comprou' && item.purchase && <small className="hx-row-purchase">Comprou {describePurchase(item.purchase)} em {formatDate(item.purchase.date)}</small>}
              </button>
            )
          })}
        </section>

        <section className="hx-detail" ref={detailRef}>
          {!client || !stats ? (
            <div className="hx-card dash-panel hx-empty">Escolhe um cliente da lista para ver e editar o histórico, ou cria um novo.</div>
          ) : (
            <>
              <div className="hx-card dash-panel">
                {isDraft
                  ? <div className="hx-card-heading"><div><span className="eyebrow">NOVO CLIENTE</span><h3>{client.name || 'Novo cliente'}</h3></div><div className="hx-actions"><button className="dash-button" type="button" onClick={cancelDraft}>Cancelar</button><button className="dash-button primary" type="button" onClick={saveDraft}><Check size={14} /> Guardar cliente</button></div></div>
                  : <div className="hx-card-heading"><div><span className="eyebrow">CLIENTE</span><h3>{client.name || 'Sem nome'}</h3></div><span className="hx-summary">{stats.count} {stats.count === 1 ? 'visita' : 'visitas'} · gostou em {stats.liked} · última {formatDate(stats.last)}{onOpenPortfolio && <> · <button className="inline-link" type="button" onClick={() => onOpenPortfolio(client.id)}>Abrir na Carteira</button></>} · <button className="inline-link hx-delete-link" type="button" onClick={removeClient}>Apagar cliente</button></span></div>}
                <div className="hx-grid">
                  <label className="studio-field">Nome<input value={client.name} onChange={(event) => updateClient({ name: event.target.value })} /></label>
                  <label className="studio-field">Início (primeiro contacto)<input type="date" value={client.startedAt} onChange={(event) => updateClient({ startedAt: event.target.value })} /></label>
                  <label className="studio-field">Telemóvel<input inputMode="tel" value={client.phone} placeholder="912 345 678" onChange={(event) => updateClient({ phone: event.target.value })} /></label>
                  <label className="studio-field">Email<input type="email" value={client.email} placeholder="nome@exemplo.pt" onChange={(event) => updateClient({ email: event.target.value })} /></label>
                  <label className="studio-field">Próximo contacto (follow-up)<input type="date" value={client.followUpAt} onChange={(event) => updateClient({ followUpAt: event.target.value })} /></label>
                  {isDraft && <fieldset className="hx-types"><legend>Tipo de casa que procura * (podes escolher mais do que um)</legend>{houseTypeOptions.map((option, index) => <label key={option.value} className="hx-check"><input type="checkbox" data-property-type={index === 0 ? '' : undefined} checked={client.wants.propertyTypes.includes(option.value)} onChange={(event) => { const next = event.target.checked ? [...client.wants.propertyTypes, option.value] : client.wants.propertyTypes.filter((kind) => kind !== option.value); updateClient({ wants: { ...client.wants, propertyTypes: houseTypeOptions.map((item) => item.value).filter((kind) => next.includes(kind)) } }) }} />{option.label}</label>)}</fieldset>}
                  <label className="studio-field">Estado<select value={client.status} onChange={(event) => changeStatus(event.target.value as HistoryClient['status'])}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="studio-field hx-span-full">Notas gerais<textarea value={client.notes} placeholder="Situação familiar, prazos, financiamento…" onChange={(event) => updateClient({ notes: event.target.value })} /></label>
                </div>
              </div>

              {isDraft ? (
                <div className="hx-card dash-panel">
                  <div className="hx-actions">
                    <button className="dash-button primary" type="button" onClick={saveDraft}><Check size={14} /> Guardar cliente</button>
                    <button className="dash-button" type="button" onClick={cancelDraft}>Cancelar</button>
                  </div>
                  <p className="hx-hint">O cliente só entra no histórico quando carregares em "Guardar cliente". Depois de guardado podes registar visitas, a compra e enviar mensagens.</p>
                </div>
              ) : (
              <>
              <div className="hx-card dash-panel">
                <div className="hx-card-heading"><div><span className="eyebrow">O QUE PROCURA</span><h3>Resumo que vais afinando</h3></div></div>
                <label className="studio-field">Atualiza depois de cada visita, com base nas notas<textarea value={client.learned} placeholder="Ex.: T2 com elevador e garagem; descarta rés-do-chão; prefere zona perto da escola" onChange={(event) => updateClient({ learned: event.target.value })} /></label>
              </div>

              <div className="hx-card dash-panel">
                <div className="hx-card-heading"><div><span className="eyebrow">VISITAS</span><h3>Visitas e notas ({stats.count})</h3></div></div>
                <div className="hx-visit-new">
                  <label className="studio-field">Data<input type="date" value={visitDraft.date} onChange={(event) => setVisitDraft({ ...visitDraft, date: event.target.value })} /></label>
                  <label className="studio-field hx-span-2">Imóvel visitado (morada ou título)<input value={visitDraft.property} placeholder="Ex.: T2 na Rua Evaristo da Silva, Torres Vedras" onChange={(event) => setVisitDraft({ ...visitDraft, property: event.target.value })} /></label>
                  <label className="studio-field">Opinião do cliente<select value={visitDraft.interest} onChange={(event) => setVisitDraft({ ...visitDraft, interest: event.target.value as Visit['interest'] })}>{interestOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="studio-field hx-span-full">Ligação do anúncio (opcional)<input value={visitDraft.url} placeholder="https://…" onChange={(event) => setVisitDraft({ ...visitDraft, url: event.target.value })} /></label>
                  <label className="studio-field hx-span-full">Notas da visita<textarea value={visitDraft.notes} placeholder="O que gostou, o que não gostou, objeções, o que isto diz sobre o que procura…" onChange={(event) => setVisitDraft({ ...visitDraft, notes: event.target.value })} /></label>
                  <div className="hx-span-full"><button className="dash-button primary" type="button" onClick={addVisit}><Plus size={14} /> Registar visita</button></div>
                </div>
                {client.visits.length === 0 ? <div className="hx-empty">Ainda sem visitas registadas.</div> : (
                  <div className="hx-visits">
                    {client.visits.slice().sort((a, b) => b.date.localeCompare(a.date)).map((visit) => (
                      <article className="hx-visit" key={visit.id}>
                        <div className="hx-visit-head">
                          <input type="date" aria-label="Data da visita" value={visit.date} onChange={(event) => updateVisit(visit.id, { date: event.target.value })} />
                          <select aria-label="Opinião do cliente" value={visit.interest} onChange={(event) => updateVisit(visit.id, { interest: event.target.value as Visit['interest'] })}>{interestOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                          <button className="icon-remove" type="button" aria-label="Apagar visita" title="Apagar visita" onClick={() => removeVisit(visit.id)}><Trash2 size={14} /></button>
                        </div>
                        <input aria-label="Imóvel visitado" value={visit.property} placeholder="Imóvel visitado" onChange={(event) => updateVisit(visit.id, { property: event.target.value })} />
                        <textarea aria-label="Notas da visita" value={visit.notes} placeholder="Notas da visita" onChange={(event) => updateVisit(visit.id, { notes: event.target.value })} />
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {client.status === 'comprou' && client.purchase && (
                <div className="hx-card dash-panel">
                  <div className="hx-card-heading"><div><span className="eyebrow">COMPRA</span><h3>Casa que comprou</h3></div></div>
                  <div className="hx-grid">
                    <label className="studio-field">Data da compra<input type="date" value={client.purchase.date} onChange={(event) => updatePurchase({ date: event.target.value })} /></label>
                    <label className="studio-field">Tipo<select value={client.purchase.propertyType} onChange={(event) => updatePurchase({ propertyType: event.target.value as Purchase['propertyType'] })}>{houseTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label className="studio-field">Tipologia<select value={client.purchase.typology} onChange={(event) => updatePurchase({ typology: event.target.value })}><option value="">—</option>{historyTypologies.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                    <label className="studio-field">Localização (concelho ou zona)<input value={client.purchase.location} placeholder="Ex.: Torres Vedras" onChange={(event) => updatePurchase({ location: event.target.value })} /></label>
                    <label className="studio-field">Preço (€)<input type="number" min="0" step="1000" value={client.purchase.priceEur ?? ''} onChange={(event) => updatePurchase({ priceEur: numberValue(event) })} /></label>
                    <label className="studio-field">Área (m²)<input type="number" min="0" step="1" value={client.purchase.areaM2 ?? ''} onChange={(event) => updatePurchase({ areaM2: numberValue(event) })} /></label>
                    <label className="studio-field hx-span-full">Descrição da casa<textarea value={client.purchase.description} placeholder="Ex.: T2 remodelado com garagem e varanda, 3.º andar com elevador, condomínio de 40 €/mês" onChange={(event) => updatePurchase({ description: event.target.value })} /></label>
                  </div>
                </div>
              )}

              <div className="hx-card dash-panel">
                <div className="hx-card-heading"><div><span className="eyebrow">CONTACTAR</span><h3>Mensagem para {client.name || 'o cliente'}</h3></div><span className="hx-summary">Último contacto: {formatDate(client.lastContactAt)}</span></div>
                <div className="hx-grid">
                  <label className="studio-field">Tipo de mensagem<select value={contactKind} onChange={(event) => { setContactKind(event.target.value as ContactKind); setCustomMessage(null) }}><option value="vender">Possível comprador: quer vender a casa?</option><option value="retomar">Retomar a procura de casa</option></select></label>
                  <label className="studio-field hx-span-2">A tua assinatura (guardada neste browser)<input value={signature} placeholder="Ex.: Ana Silva · ImoAssistenteAI · 912 000 000" onChange={(event) => { setSignature(event.target.value); setCustomMessage(null) }} /></label>
                  <label className="studio-field hx-span-full">Texto da mensagem (podes editar)<textarea className="hx-message" value={message} onChange={(event) => setCustomMessage(event.target.value)} /></label>
                </div>
                {customMessage !== null && <p className="hx-hint"><button className="inline-link" type="button" onClick={() => setCustomMessage(null)}>Repor texto automático</button></p>}
                <div className="hx-actions">
                  <button className="dash-button" type="button" onClick={copyMessage}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}</button>
                  {phoneOk
                    ? <a className="dash-button primary" href={whatsappUrl(message, client.phone)} target="_blank" rel="noopener noreferrer" onClick={markContacted}><MessageCircle size={14} /> Enviar por WhatsApp</a>
                    : <button className="dash-button" type="button" disabled title="Falta um telemóvel válido"><MessageCircle size={14} /> WhatsApp (sem telemóvel)</button>}
                  {emailOk
                    ? <a className="dash-button primary" href={mailtoUrl(client.email, contactSubject(contactKind), message)} onClick={markContacted}><Mail size={14} /> Enviar por email</a>
                    : <button className="dash-button" type="button" disabled title="Falta um email válido"><Mail size={14} /> Email (sem email válido)</button>}
                </div>
                <p className="hx-hint">O WhatsApp e o programa de email abrem com o texto preenchido, e só enviam quando carregares em enviar. O "último contacto" fica registado ao abrires um deles.</p>
              </div>

              <div className="hx-danger"><button className="dash-button quiet" type="button" onClick={removeClient}><Trash2 size={14} /> Apagar cliente</button></div>
              </>
              )}
            </>
          )}
        </section>
      </div>
    </section>
  )
}
