import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Check, ChevronDown, Plus, Search, Trash2, X } from 'lucide-react'
import {
  clientStatusLabel,
  clientTypeOptions,
  describePurchaseWindow,
  describeWants,
  emptyPortfolioFilters,
  filterPortfolio,
  financingOptions,
  formatDate,
  hasActivePortfolioFilters,
  purchaseWindow,
  timeSince,
  historyTypologies,
  houseTypeOptions,
  newClient,
  newPurchase,
  optionLabel,
  parseHistory,
  portfolioStats,
  priorityOptions,
  sortPortfolio,
  sourceOptions,
  statusOptions,
  timeframeOptions,
  todayIso,
  type ClientWants,
  type HistoryClient,
  type PortfolioFilters,
} from '../lib/history'
import { clientAppointmentCount, deleteConfirmation, purgeClientTraces } from '../lib/client-cleanup'
import { districts, featureOptions } from '../lib/portal-links'
import './VideoStudio.css'
import './Portfolio.css'

const storageKey = 'casanexa-history'

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

type Props = {
  initialClientId?: string
  onOpenHistory: (clientId: string) => void
  onOpenSearch: (clientId: string) => void
}

function clockTime() {
  return new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function PurchasedLine({ client }: { client: HistoryClient }) {
  const { purchase } = client
  if (!purchase) return <small className="pf-bought">Comprou · ainda sem dados da compra</small>
  const since = timeSince(purchase.date, todayIso())
  return (
    <span className="pf-bought">
      <span className="pf-bought-where">{purchase.location.trim() || 'Localização por indicar'}</span>
      <span className="pf-bought-when">Comprou em {formatDate(purchase.date)}{since && <b>{since}</b>}</span>
    </span>
  )
}

function PurchaseWindowLine({ client }: { client: HistoryClient }) {
  const timeline = purchaseWindow(client, todayIso())
  if (timeline.state === 'sem-prazo') {
    return <small className="pf-row-entry">Entrou em {formatDate(client.startedAt)} · sem prazo definido</small>
  }
  const urgent = timeline.state === 'ultrapassado' || timeline.days <= 30
  const percent = Math.round(timeline.elapsed * 100)
  return (
    <span className={urgent ? 'pf-timeline urgent' : 'pf-timeline'} role="img" aria-label={`Entrou em ${formatDate(client.startedAt)}. ${describePurchaseWindow(timeline)}.`}>
      <span className="pf-timeline-headline">{timeline.state === 'ultrapassado' ? `Ultrapassado há ${timeline.days} ${timeline.days === 1 ? 'dia' : 'dias'}` : timeline.days === 0 ? 'Termina hoje' : `Faltam ${timeline.days} ${timeline.days === 1 ? 'dia' : 'dias'}`}</span>
      <span className="pf-timeline-track"><span className="pf-timeline-fill" style={{ width: `${percent}%` }} /><span className="pf-timeline-now" style={{ left: `${percent}%` }} /></span>
      <span className="pf-timeline-dates"><span>Entrou<b>{formatDate(client.startedAt)}</b></span><span className="pf-timeline-today">Hoje</span><span>Termina<b>{formatDate(timeline.deadline)}</b></span></span>
    </span>
  )
}

export default function ClientPortfolio({ initialClientId = '', onOpenHistory, onOpenSearch }: Props) {
  const [clients, setClients] = useState<HistoryClient[]>(() => parseHistory(readStorage(storageKey)))
  const [selectedId, setSelectedId] = useState(() => (clients.some((item) => item.id === initialClientId) ? initialClientId : ''))
  const [filters, setFilters] = useState<PortfolioFilters>(emptyPortfolioFilters)
  // Cliente novo ainda por guardar: só entra na carteira quando se carrega em "Guardar cliente".
  const [draft, setDraft] = useState<HistoryClient | null>(null)
  const [formError, setFormError] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [savedNotice, setSavedNotice] = useState('')

  const detailRef = useRef<HTMLElement>(null)
  const scrollPending = useRef(false)
  const [draftBase, setDraftBase] = useState('')

  useEffect(() => { writeStorage(storageKey, clients) }, [clients])

  const isDraft = draft !== null
  const isDirty = draft !== null && JSON.stringify(draft) !== draftBase
  const activeId = draft?.id ?? selectedId

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

  const visible = useMemo(() => sortPortfolio(filterPortfolio(clients, filters)), [clients, filters])
  const stats = useMemo(() => portfolioStats(clients), [clients])
  const client = draft ?? clients.find((item) => item.id === selectedId)

  // Os números do resumo são atalhos: clicar filtra a lista por baixo; clicar outra vez mostra todos.
  const activeStat = filters.status === 'procura' && filters.priority === 'quente' ? 'quente' : filters.status || 'total'

  function pickStat(stat: 'total' | 'procura' | 'comprou' | 'desistiu' | 'quente') {
    if (stat === 'total' || stat === activeStat) {
      setFilters({ ...filters, status: '', priority: '' })
    } else if (stat === 'quente') {
      setFilters({ ...filters, status: 'procura', priority: 'quente' })
    } else {
      setFilters({ ...filters, status: stat, priority: '' })
    }
  }

  function setFilter<K extends keyof PortfolioFilters>(key: K, value: PortfolioFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function selectClient(id: string, scroll = false) {
    if (draft) {
      if (isDirty && !window.confirm('Tens um cliente novo por guardar. Descartá-lo? Os dados preenchidos perdem-se.')) return
      setDraft(null)
      setFormError('')
    }
    scrollPending.current = scroll
    setSavedNotice('')
    setFormError('')
    setSelectedId(id)
  }

  // "Novo cliente" só abre o formulário vazio e leva-te até ele: nada é gravado até carregares em "Guardar cliente".
  function startNewClient() {
    setSavedNotice('')
    setFormError('')
    if (draft) {
      scrollToDetail()
      return
    }
    const fresh = newClient(todayIso())
    setDraftBase(JSON.stringify(fresh))
    scrollPending.current = true
    setFilters(emptyPortfolioFilters)
    setSelectedId('')
    setDraft(fresh)
  }

  function saveDraft() {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) {
      setFormError('Indica o nome do cliente para o guardar.')
      detailRef.current?.querySelector<HTMLInputElement>('input')?.focus()
      return
    }
    if (draft.wants.propertyTypes.length === 0) {
      setFormError('Escolhe pelo menos um tipo de casa que o cliente procura.')
      const select = detailRef.current?.querySelector<HTMLSelectElement>('[data-property-type]')
      select?.scrollIntoView({ block: 'center' })
      select?.focus({ preventScroll: true })
      return
    }
    setClients((current) => [{ ...draft, name }, ...current])
    // Fica um formulário novo e vazio, pronto para o cliente seguinte.
    const fresh = newClient(todayIso())
    setDraftBase(JSON.stringify(fresh))
    setDraft(fresh)
    setFormError('')
    setSavedNotice(`${name} foi guardado na carteira. Podes adicionar outro cliente.`)
    requestAnimationFrame(() => detailRef.current?.querySelector<HTMLInputElement>('input')?.focus())
  }

  function cancelDraft() {
    if (isDirty && !window.confirm('Descartar o cliente novo? Os dados preenchidos perdem-se.')) return
    setDraft(null)
    setFormError('')
  }

  function updateClient(patch: Partial<HistoryClient>) {
    if (draft) {
      setDraft({ ...draft, ...patch })
      return
    }
    if (!client) return
    setClients((current) => current.map((item) => item.id === client.id ? { ...item, ...patch } : item))
  }

  function updateWants(patch: Partial<ClientWants>) {
    if (!client) return
    updateClient({ wants: { ...client.wants, ...patch } })
  }

  function changeStatus(status: HistoryClient['status']) {
    if (!client) return
    // Ao marcar "Comprou" cria-se o registo da compra, que se detalha no Histórico.
    updateClient({ status, purchase: status === 'comprou' ? client.purchase ?? newPurchase(todayIso()) : client.purchase })
  }

  // As alterações a um cliente já guardado gravam-se logo; este botão valida a ficha e confirma o que ficou registado.
  function confirmUpdate() {
    if (!client || isDraft) return
    if (!client.name.trim()) {
      setFormError('Indica o nome do cliente.')
      detailRef.current?.querySelector<HTMLInputElement>('input')?.focus()
      return
    }
    if (client.wants.propertyTypes.length === 0) {
      setFormError('Escolhe pelo menos um tipo de casa que o cliente procura.')
      const box = detailRef.current?.querySelector<HTMLInputElement>('[data-property-type]')
      box?.scrollIntoView({ block: 'center' })
      box?.focus({ preventScroll: true })
      return
    }
    setFormError('')
    setSavedNotice(`${client.name.trim()} atualizado: dados guardados às ${clockTime()}.`)
    scrollToTop()
  }

  function scrollToTop() {
    detailRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  function updatePurchase(patch: Partial<NonNullable<HistoryClient['purchase']>>) {
    if (!client?.purchase) return
    updateClient({ purchase: { ...client.purchase, ...patch } })
  }

  function togglePropertyType(value: ClientWants['propertyTypes'][number], on: boolean) {
    if (!client) return
    const next = on ? [...client.wants.propertyTypes, value] : client.wants.propertyTypes.filter((kind) => kind !== value)
    updateWants({ propertyTypes: houseTypeOptions.map((option) => option.value).filter((kind) => next.includes(kind)) })
  }

  function toggleTypology(value: ClientWants['typologies'][number], on: boolean) {
    if (!client) return
    const next = on ? [...client.wants.typologies, value] : client.wants.typologies.filter((item) => item !== value)
    updateWants({ typologies: historyTypologies.filter((item) => next.includes(item)) })
  }

  function toggleFeature(value: ClientWants['features'][number], on: boolean) {
    if (!client) return
    updateWants({ features: on ? [...client.wants.features, value] : client.wants.features.filter((feature) => feature !== value) })
  }

  function removeClient(target: HistoryClient) {
    if (!window.confirm(deleteConfirmation(target.name, clientAppointmentCount(target.id)))) return
    purgeClientTraces(target.id)
    setClients((current) => current.filter((item) => item.id !== target.id))
    if (selectedId === target.id) setSelectedId('')
  }

  const purchase = client?.status === 'comprou' ? client.purchase : null

  return (
    <section className="portfolio-page">
      <header className="portfolio-heading">
        <div><span className="eyebrow">CARTEIRA</span><h2>Carteira de clientes</h2><p>Todos os teus clientes num só sítio: quem procura, o que procura, quem já comprou e quem está para decidir. Os registos são os mesmos do Histórico, onde guardas as visitas e a compra.</p></div>
        <button className="dash-button primary" type="button" onClick={startNewClient}><Plus size={14} /> Novo cliente</button>
      </header>

      <div className="pf-stats" role="group" aria-label="Resumo da carteira: clica num número para ver esses clientes">
        {([
          ['total', 'Clientes', stats.total],
          ['procura', 'Em procura', stats.procura],
          ['comprou', 'Já compraram', stats.comprou],
          ['desistiu', 'Desistiram', stats.desistiu],
          ['quente', 'Prioridade quente', stats.quentes],
        ] as const).map(([key, label, count]) => (
          <button type="button" key={key} className={activeStat === key ? 'pf-stat active' : 'pf-stat'} aria-pressed={activeStat === key} onClick={() => pickStat(key)}>
            <small>{label}</small><strong>{count}</strong>
          </button>
        ))}
      </div>

      <section className="pf-card dash-panel">
        <div className="pf-card-heading">
          <button className="pf-filter-toggle" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
            <ChevronDown size={15} className={filtersOpen ? 'open' : ''} />
            <span><span className="eyebrow">PESQUISAR</span><h3>Filtrar a carteira</h3></span>
            {hasActivePortfolioFilters(filters) && <span className="pf-tag procura">Filtros ativos · {visible.length} de {clients.length}</span>}
          </button>
          {hasActivePortfolioFilters(filters) && <button className="dash-button quiet" type="button" onClick={() => setFilters(emptyPortfolioFilters)}><X size={14} /> Limpar filtros</button>}
        </div>
        {filtersOpen && <>
        <div className="pf-filters">
          <label className="studio-field pf-span-2">Nome, contacto ou notas<input value={filters.text} placeholder="Ex.: Inês, 912…, garagem" onChange={(event) => setFilter('text', event.target.value)} /></label>
          <label className="studio-field">Estado<select value={filters.status} onChange={(event) => setFilter('status', event.target.value as PortfolioFilters['status'])}><option value="">Todos</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="studio-field">Tipo de cliente<select value={filters.clientType} onChange={(event) => setFilter('clientType', event.target.value as PortfolioFilters['clientType'])}><option value="">Todos</option>{clientTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="studio-field">Prioridade<select value={filters.priority} onChange={(event) => setFilter('priority', event.target.value as PortfolioFilters['priority'])}><option value="">Todas</option>{priorityOptions.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="studio-field">Tipo de casa<select value={filters.propertyType} onChange={(event) => setFilter('propertyType', event.target.value as PortfolioFilters['propertyType'])}><option value="">Todos</option>{houseTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="studio-field">Zona (concelho ou distrito)<input value={filters.zone} placeholder="Ex.: Torres Vedras" onChange={(event) => setFilter('zone', event.target.value)} /></label>
          <label className="studio-field">Orçamento a partir de (€)<input type="number" min="0" step="10000" value={filters.budgetFrom ?? ''} onChange={(event) => setFilter('budgetFrom', numberValue(event))} /></label>
          <label className="studio-field">Orçamento até (€)<input type="number" min="0" step="10000" value={filters.budgetTo ?? ''} onChange={(event) => setFilter('budgetTo', numberValue(event))} /></label>
        </div>
        <p className="pf-hint">O orçamento filtra os clientes cujo intervalo (mínimo a máximo) se sobrepõe ao que indicares. {visible.length} de {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}.</p>
        </>}
      </section>

      <div className="pf-layout">
        <section className="pf-list dash-panel" aria-label="Clientes">
          {isDraft && (
            <div className="pf-row-wrap">
              <div className="pf-row selected pf-row-draft"><span className="pf-row-top"><strong>{draft.name.trim() || 'Novo cliente'}</strong><span className="pf-tag">Por guardar</span></span><small>Preenche a ficha ao lado e carrega em "Guardar cliente".</small></div>
            </div>
          )}
          {clients.length === 0 ? (
            isDraft ? null : <div className="pf-empty">Ainda não tens clientes na carteira. Carrega em "Novo cliente" para adicionares o primeiro.</div>
          ) : visible.length === 0 ? (
            <div className="pf-empty">Nenhum cliente corresponde aos filtros.</div>
          ) : visible.map((item) => {
            const summary = describeWants(item.wants)
            return (
              <div className="pf-row-wrap" key={item.id}>
              <button type="button" className={item.id === selectedId ? 'pf-row selected' : 'pf-row'} onClick={() => selectClient(item.id, window.innerWidth <= 1000)}>
                <span className="pf-row-top"><strong>{item.name || 'Sem nome'}</strong><span className={`pf-tag ${item.status}`}>{clientStatusLabel(item.status)}</span></span>
                <small>{summary || 'Sem critérios de procura definidos'}</small>
                {item.status === 'procura' ? <PurchaseWindowLine client={item} /> : <small className="pf-row-entry">Entrou na carteira em {formatDate(item.startedAt)}</small>}
                {item.status === 'comprou' && <PurchasedLine client={item} />}
                <small className="pf-row-meta">
                  {item.wants.priority && <span className={`pf-dot ${item.wants.priority}`}>{item.wants.priority}</span>}
                  {item.wants.timeframe && <span>Prazo: {optionLabel(timeframeOptions, item.wants.timeframe)}</span>}
                  {item.followUpAt && <span>Contactar {formatDate(item.followUpAt)}</span>}
                </small>
              </button>
              <button className="pf-row-delete" type="button" aria-label={`Apagar ${item.name || 'cliente'}`} title="Apagar cliente" onClick={() => removeClient(item)}><Trash2 size={13} /></button>
              </div>
            )
          })}
        </section>

        <section className={isDraft ? "pf-detail pf-detail-draft" : "pf-detail"} ref={detailRef}>
          {!client ? (
            <div className="pf-card dash-panel pf-empty">Escolhe um cliente da lista para ver e editar, ou cria um novo.</div>
          ) : (
            <>
              <div className="pf-card dash-panel">
                <div className="pf-card-heading"><div><span className="eyebrow">{isDraft ? 'NOVO CLIENTE' : 'CONTACTO'}</span><h3>{client.name || (isDraft ? 'Novo cliente' : 'Sem nome')}</h3></div><div className="pf-head-actions">{isDraft ? <><span className="pf-tag">Por guardar</span><button className="dash-button" type="button" onClick={cancelDraft}>Cancelar</button><button className="dash-button primary" type="button" onClick={saveDraft}><Check size={14} /> Guardar cliente</button></> : <><span className={`pf-tag ${client.status}`}>{clientStatusLabel(client.status)}</span><button className="dash-button quiet" type="button" onClick={() => removeClient(client)}><Trash2 size={14} /> Apagar</button><button className="dash-button primary" type="button" onClick={confirmUpdate}><Check size={14} /> Atualizar cliente</button></>}</div></div>
                {savedNotice && <p className="pf-notice" role="status">{savedNotice}</p>}
                {formError && <p className="pf-warning" role="alert">{formError}</p>}
                {isDraft && <div className="pf-part"><span>1</span><h4>Contacto</h4></div>}
                <div className="pf-grid">
                  <label className="studio-field">Nome<input value={client.name} onChange={(event) => updateClient({ name: event.target.value })} /></label>
                  <label className="studio-field">Telemóvel<input inputMode="tel" value={client.phone} placeholder="912 345 678" onChange={(event) => updateClient({ phone: event.target.value })} /></label>
                  <label className="studio-field">Email<input type="email" value={client.email} placeholder="nome@exemplo.pt" onChange={(event) => updateClient({ email: event.target.value })} /></label>
                  <label className="studio-field">Como chegou até ti<select value={client.wants.source} onChange={(event) => updateWants({ source: event.target.value as ClientWants['source'] })}>{sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="studio-field">Início (primeiro contacto)<input type="date" value={client.startedAt} onChange={(event) => updateClient({ startedAt: event.target.value })} /></label>
                  <label className="studio-field">Próximo contacto<input type="date" value={client.followUpAt} onChange={(event) => updateClient({ followUpAt: event.target.value })} /></label>
                </div>
              </div>

              <div className="pf-card dash-panel">
                {isDraft ? <div className="pf-part"><span>2</span><h4>Estado e classificação</h4></div> : <div className="pf-card-heading"><div><span className="eyebrow">ESTADO</span><h3>Estado e classificação</h3></div></div>}
                <div className="pf-grid">
                  <label className="studio-field">Estado<select value={client.status} onChange={(event) => changeStatus(event.target.value as HistoryClient['status'])}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="studio-field">Tipo de cliente<select value={client.wants.clientType} onChange={(event) => updateWants({ clientType: event.target.value as ClientWants['clientType'] })}>{clientTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="studio-field">Prioridade<select value={client.wants.priority} onChange={(event) => updateWants({ priority: event.target.value as ClientWants['priority'] })}>{priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="studio-field">Prazo para decidir<select value={client.wants.timeframe} onChange={(event) => updateWants({ timeframe: event.target.value as ClientWants['timeframe'] })}>{timeframeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="studio-field">Financiamento<select value={client.wants.financing} onChange={(event) => updateWants({ financing: event.target.value as ClientWants['financing'] })}>{financingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                </div>
                {purchase && (
                  <div className="pf-purchase">
                    <div className="pf-part"><span>€</span><h4>Compra</h4></div>
                    <div className="pf-grid">
                      <label className="studio-field">Data da compra<input type="date" value={purchase.date} onChange={(event) => updatePurchase({ date: event.target.value })} /></label>
                      <label className="studio-field">Localização da casa<input value={purchase.location} placeholder="Ex.: Torres Vedras" onChange={(event) => updatePurchase({ location: event.target.value })} /></label>
                      <label className="studio-field">Preço (€)<input type="number" min="0" step="1000" value={purchase.priceEur ?? ''} onChange={(event) => updatePurchase({ priceEur: numberValue(event) })} /></label>
                    </div>
                    {!isDraft && <p className="pf-hint">Tipo, tipologia, área e descrição da casa registam-se no Histórico. <button className="inline-link" type="button" onClick={() => onOpenHistory(client.id)}>Abrir no Histórico</button></p>}
                  </div>
                )}
              </div>

              <div className="pf-card dash-panel">
                {isDraft ? <div className="pf-part"><span>3</span><h4>O que procura</h4></div> : <div className="pf-card-heading"><div><span className="eyebrow">O QUE PROCURA</span><h3>Critérios de procura</h3></div></div>}
                <div className="pf-grid">
                  <fieldset className="pf-features pf-span-full"><legend>{isDraft ? 'Tipo de casa que procura * (podes escolher mais do que um)' : 'Tipo de casa que procura'}</legend>{houseTypeOptions.map((option, index) => <label key={option.value} className="pf-check"><input type="checkbox" data-property-type={index === 0 ? '' : undefined} checked={client.wants.propertyTypes.includes(option.value)} onChange={(event) => togglePropertyType(option.value, event.target.checked)} />{option.label}</label>)}</fieldset>
                  <fieldset className="pf-features pf-span-full">
                    <legend>Tipologia (podes escolher mais do que uma)</legend>
                    {historyTypologies.map((option) => (
                      <label className="pf-check" key={option}>
                        <input type="checkbox" checked={client.wants.typologies.includes(option)} onChange={(event) => toggleTypology(option, event.target.checked)} />
                        {option}
                      </label>
                    ))}
                  </fieldset>
                  <label className="studio-field">Distrito<select value={client.wants.district} onChange={(event) => updateWants({ district: event.target.value })}><option value="">—</option>{districts.map((district) => <option key={district.value} value={district.value}>{district.label}</option>)}</select></label>
                  <label className="studio-field">Concelho principal<input value={client.wants.municipality} placeholder="Ex.: Torres Vedras" onChange={(event) => updateWants({ municipality: event.target.value })} /></label>
                  <label className="studio-field pf-span-2">Outras zonas aceites<input value={client.wants.otherZones} placeholder="Ex.: Mafra, Lourinhã" onChange={(event) => updateWants({ otherZones: event.target.value })} /></label>
                  <label className="studio-field">Orçamento mínimo (€)<input type="number" min="0" step="10000" value={client.wants.budgetMin ?? ''} onChange={(event) => updateWants({ budgetMin: numberValue(event) })} /></label>
                  <label className="studio-field">Orçamento máximo (€)<input type="number" min="0" step="10000" value={client.wants.budgetMax ?? ''} onChange={(event) => updateWants({ budgetMax: numberValue(event) })} /></label>
                  <fieldset className="pf-features pf-span-full">
                    <legend>Características importantes</legend>
                    {featureOptions.map((option) => (
                      <label className="pf-check" key={option.value}>
                        <input type="checkbox" checked={client.wants.features.includes(option.value)} onChange={(event) => toggleFeature(option.value, event.target.checked)} />
                        {option.label}
                      </label>
                    ))}
                  </fieldset>
                  <label className="studio-field pf-span-full">Notas<textarea value={client.notes} placeholder="Situação familiar, o que o motiva, objeções, prazos…" onChange={(event) => updateClient({ notes: event.target.value })} /></label>
                </div>
                                {isDraft ? (
                  <>
                    <div className="pf-actions">
                      <button className="dash-button primary" type="button" onClick={saveDraft}><Check size={14} /> Guardar cliente</button>
                      <button className="dash-button" type="button" onClick={cancelDraft}>Cancelar</button>
                    </div>
                    <p className="pf-hint">O cliente só entra na carteira quando carregares em "Guardar cliente". Depois de guardado podes procurar imóveis para ele e registar visitas no Histórico.</p>
                  </>
                ) : (
                  <>
                    <div className="pf-actions">
                  <button className="dash-button primary" type="button" onClick={confirmUpdate}><Check size={14} /> Atualizar cliente</button>
                  <button className="dash-button" type="button" onClick={() => onOpenSearch(client.id)}><Search size={14} /> Procurar imóveis para este cliente</button>
                  <button className="dash-button" type="button" onClick={() => onOpenHistory(client.id)}>Abrir no Histórico (visitas e notas)</button>
                </div>
                <p className="pf-hint">As alterações ficam guardadas assim que as escreves; "Atualizar cliente" confirma e valida a ficha. A página "Imóvel para cliente" abre com este cliente escolhido e os critérios acima já preenchidos. O que alterares lá atualiza esta ficha.</p>
                  </>
                )}
              </div>

              {!isDraft && <div className="pf-danger"><button className="dash-button quiet" type="button" onClick={() => removeClient(client)}><Trash2 size={14} /> Apagar cliente</button></div>}
            </>
          )}
        </section>
      </div>
    </section>
  )
}
