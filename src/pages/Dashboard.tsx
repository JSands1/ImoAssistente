import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowDownUp,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  Clapperboard,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  FileSearch,
  History as HistoryIcon,
  House,
  LayoutDashboard,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react'
import WeekCalendar, { type CalendarEvent } from '../components/WeekCalendar'
import WeeklyPlan from '../components/WeeklyPlan'
import { buildWeeklyPlan, type PlanTask } from '../lib/weekly-plan'
import { useCollapsiblePanels } from '../lib/collapsible-panels'
import { useAccount } from '../lib/account'
import { matchClients } from '../lib/matching'
import {
  migrateLegacyClients,
  parseHistory,
  todayIso,
  type HistoryClient,
} from '../lib/history'
import { linkLabel, normalizeLink, phoneHref } from '../lib/visit'
import { defaultVisitMinutes, findConflict, visitMinutes } from '../lib/week'
import './Dashboard.css'

const VideoStudio = lazy(() => import('./VideoStudio'))
const PropertyAnalysis = lazy(() => import('./PropertyAnalysis'))
const ClientSearch = lazy(() => import('./ClientSearch'))
const ClientHistory = lazy(() => import('./History'))
const ClientPortfolio = lazy(() => import('./Portfolio'))
const Messages = lazy(() => import('./Messages'))
const Admin = lazy(() => import('./Admin'))

type View = 'overview' | 'properties' | 'portfolio' | 'search' | 'history' | 'messages' | 'analysis' | 'calendar' | 'video' | 'admin'
type PropertyStatus = 'Disponível' | 'Reservado' | 'CPCV assinado' | 'Vendido'

type Property = {
  id: string
  reference: string
  title: string
  zone: string
  price: number
  typology: string
  bedrooms: number
  status: PropertyStatus
  lastVerified: string
  details: string
}

type Appointment = {
  id: string
  clientId: string
  propertyId: string
  date: string
  /** Duração da visita em minutos (visitas antigas não a têm). */
  minutes?: number
  /** Morada do imóvel, link do anúncio e contacto do vendedor (opcionais). */
  address?: string
  link?: string
  seller?: string
}

// Os clientes, imóveis e visitas de exemplo de versões anteriores ficaram gravados no browser. Estes ids são sempre
// descartados ao carregar, para só aparecerem dados reais (os registos criados pelo utilizador têm ids únicos).
const demoClientIds = new Set(['c1', 'c2', 'c3'])
const demoPropertyIds = new Set(['p1', 'p2', 'p3', 'p4'])
const demoAppointmentIds = new Set(['a1', 'a2'])

const historyKey = 'casanexa-history'

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

function loadList<T extends { id: string }>(key: string, demoIds: Set<string>): T[] {
  const raw = readJson(key)
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is T => Boolean(item) && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' && !demoIds.has((item as { id: string }).id))
}

function loadProperties() {
  return loadList<Property>('casanexa-properties', demoPropertyIds)
}

function loadAppointments() {
  return loadList<Appointment>('casanexa-appointments', demoAppointmentIds).filter((appointment) => !demoClientIds.has(appointment.clientId))
}

// O histórico é a única fonte de clientes. Na primeira abertura traz os clientes criados à mão na antiga "Caixa de
// entrada" e remove essa chave, mas só depois de os gravar no histórico.
function loadClients(): HistoryClient[] {
  const history = parseHistory(readJson(historyKey))
  const legacy = readJson('casanexa-clients')
  if (legacy === null) return history
  const { clients } = migrateLegacyClients(legacy, history)
  try {
    localStorage.setItem(historyKey, JSON.stringify(clients))
    localStorage.removeItem('casanexa-clients')
  } catch {
    // Sem armazenamento: mantém os dados antigos onde estão.
  }
  return clients
}

function nextReference(properties: Property[]) {
  const numbers = properties.map((property) => Number(/^CN-(\d+)$/.exec(property.reference)?.[1] ?? 0))
  return `CN-${Math.max(1000, ...numbers) + 1}`
}

function greetingFor(now: number) {
  const hour = new Date(now).getHours()
  return hour < 12 ? 'Bom dia' : hour < 20 ? 'Boa tarde' : 'Boa noite'
}

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase()
}

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'calendar', label: 'Agenda', icon: CalendarDays },
  { id: 'portfolio', label: 'Carteira de clientes', icon: UsersRound },
  { id: 'search', label: 'Imóvel para cliente', icon: Search },
  { id: 'history', label: 'Histórico', icon: HistoryIcon },
  { id: 'messages', label: 'Mensagens padrão', icon: MessageCircle },
  { id: 'analysis', label: 'Análise do imóvel', icon: FileSearch },
  { id: 'video', label: 'Vídeo do imóvel', icon: Clapperboard },
]

const adminNavigation: (typeof navigation)[number] = { id: 'admin', label: 'Administração', icon: ShieldCheck }

function dateIn(days: number, hour = 10) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, 0, 0, 0)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function visitEnd(start: string, minutes: number) {
  const from = new Date(start)
  if (Number.isNaN(from.getTime()) || !Number.isFinite(minutes) || minutes < 15) return 'Indica a duração da visita (mínimo 15 minutos).'
  const to = new Date(from.getTime() + minutes * 60000)
  const time = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' })
  return `Das ${time.format(from)} às ${time.format(to)}${to.getDate() !== from.getDate() ? ' (já no dia seguinte)' : ''}`
}

function euro(value: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function formatDate(value: string, withTime = false) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-PT', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date)
}

function PanelButton({ children, onClick, kind = 'secondary', type = 'button' }: { children: React.ReactNode; onClick?: () => void; kind?: 'primary' | 'secondary' | 'quiet'; type?: 'button' | 'submit' }) {
  return <button className={`dash-button ${kind}`} onClick={onClick} type={type}>{children}</button>
}

export default function Dashboard() {
  const account = useAccount()
  const menu = account?.isAdmin ? [...navigation, adminNavigation] : navigation
  const [view, setViewState] = useState<View>(() => {
    const feature = new URLSearchParams(window.location.search).get('feature')
    return feature === 'admin' || feature === 'video' || feature === 'analysis' || feature === 'search' || feature === 'history' || feature === 'messages' || feature === 'portfolio' ? feature : 'overview'
  })
  const [clients, setClients] = useState<HistoryClient[]>(loadClients)
  const [properties, setProperties] = useState<Property[]>(loadProperties)
  const [appointments, setAppointments] = useState<Appointment[]>(loadAppointments)
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [consultant, setConsultant] = useState(() => {
    const saved = readJson('casanexa-consultant')
    return typeof saved === 'string' ? saved : ''
  })
  const [editingName, setEditingName] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  useCollapsiblePanels(mainRef)
  // Ao abrir o Histórico ou a Procura a partir da Carteira, escolhe-se logo o cliente em causa.
  const [historyFocusId, setHistoryFocusId] = useState('')
  const [searchFocusId, setSearchFocusId] = useState('')
  const [portfolioFocusId, setPortfolioFocusId] = useState('')

  // O Histórico edita os clientes noutra página: ao mudar de vista volta-se a lê-los da gravação.
  function setView(next: View) {
    setClients(loadClients())
    setAppointments(loadAppointments())
    setViewState(next)
  }
  const [propertyFormOpen, setPropertyFormOpen] = useState(false)
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(false)
  const [appointmentPropertyId, setAppointmentPropertyId] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentMinutes, setAppointmentMinutes] = useState(defaultVisitMinutes)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => { try { localStorage.setItem(historyKey, JSON.stringify(clients)) } catch { /* sem armazenamento */ } }, [clients])
  useEffect(() => { try { localStorage.setItem('casanexa-consultant', JSON.stringify(consultant)) } catch { /* sem armazenamento */ } }, [consultant])
  useEffect(() => { localStorage.setItem('casanexa-properties', JSON.stringify(properties)) }, [properties])
  useEffect(() => { localStorage.setItem('casanexa-appointments', JSON.stringify(appointments)) }, [appointments])

  const selectedProperty = properties.find((property) => property.id === selectedPropertyId) ?? properties[0]
  const staleProperties = properties.filter((property) => now - Date.parse(property.lastVerified) > 7 * 86400000 && property.status === 'Disponível')
  const pageTitle = view === 'properties' ? 'Imóveis' : menu.find((item) => item.id === view)?.label ?? 'Visão geral'
  const activeClients = clients.filter((client) => client.status === 'procura')
  const followUps = clients.filter((client) => client.followUpAt && client.status !== 'desistiu').sort((a, b) => a.followUpAt.localeCompare(b.followUpAt))
  const pendingFollowUps = followUps.filter((client) => client.followUpAt <= todayIso(new Date(now)))
  const isEmpty = clients.length === 0 && properties.length === 0 && appointments.length === 0

  const weeklyPlan = useMemo(
    () => buildWeeklyPlan({ clients, appointments, properties, now: new Date(now) }),
    [clients, appointments, properties, now],
  )
  const clientNames = useMemo(() => Object.fromEntries(clients.map((client) => [client.id, client.name])), [clients])

  const upcomingAppointments = useMemo(
    () => appointments.filter((appointment) => Date.parse(appointment.date) >= now).sort((a, b) => a.date.localeCompare(b.date)),
    [appointments, now],
  )

  const calendarEvents: CalendarEvent[] = appointments.map((appointment) => ({
    id: appointment.id,
    start: appointment.date,
    minutes: visitMinutes(appointment.minutes),
    title: clients.find((client) => client.id === appointment.clientId)?.name || 'Cliente removido',
    subtitle: properties.find((property) => property.id === appointment.propertyId)?.title ?? (appointment.propertyId ? 'Imóvel removido' : 'Imóvel a definir'),
    details: [appointment.address, appointment.seller].filter(Boolean).join(' · '),
  })).filter((event) => !Number.isNaN(Date.parse(event.start)))

  function addProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const property: Property = {
      id: crypto.randomUUID(),
      reference: nextReference(properties),
      title: String(form.get('title')),
      zone: String(form.get('zone')),
      price: Number(form.get('price')),
      typology: String(form.get('typology')),
      bedrooms: Number(form.get('bedrooms')),
      status: 'Disponível',
      lastVerified: new Date().toISOString().slice(0, 10),
      details: String(form.get('details')),
    }
    setProperties((current) => [property, ...current])
    setSelectedPropertyId(property.id)
    setPropertyFormOpen(false)
    event.currentTarget.reset()
  }

  function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const appointment: Appointment = {
      id: crypto.randomUUID(),
      clientId: String(form.get('clientId')),
      propertyId: String(form.get('propertyId')),
      date: String(form.get('date')),
      minutes: visitMinutes(appointmentMinutes),
      address: String(form.get('address') ?? '').trim(),
      link: normalizeLink(String(form.get('link') ?? '')),
      seller: String(form.get('seller') ?? '').trim(),
    }
    if (String(form.get('link') ?? '').trim() && !appointment.link) { window.alert('O link do imóvel não parece válido. Cola o endereço completo do anúncio (por exemplo, https://www.idealista.pt/imovel/…).'); return }
    const clash = findConflict(appointments.map((item) => ({ id: item.id, start: item.date, minutes: visitMinutes(item.minutes) })), appointment.date, appointment.minutes ?? defaultVisitMinutes)
    if (clash && !window.confirm(`Já tens uma visita marcada a esta hora (${formatDate(appointments.find((item) => item.id === clash.id)?.date ?? appointment.date, true)}). Marcar mesmo assim?`)) return
    setAppointments((current) => [...current, appointment])
    setAppointmentFormOpen(false)
    setAppointmentPropertyId('')
    setAppointmentDate('')
    setAppointmentMinutes(defaultVisitMinutes)
    event.currentTarget.reset()
  }

  function updateProperty(id: string, patch: Partial<Property>) {
    setProperties((current) => current.map((property) => property.id === id ? { ...property, ...patch } : property))
  }

  function removeProperty(id: string) {
    const property = properties.find((item) => item.id === id)
    if (!property || !window.confirm(`Remover ${property.reference} · ${property.title}? As visitas já marcadas ficam sem imóvel associado.`)) return
    setProperties((current) => current.filter((item) => item.id !== id))
    if (selectedPropertyId === id) setSelectedPropertyId('')
  }

  function openHistoryFor(clientId: string) {
    setHistoryFocusId(clientId)
    setView('history')
  }

  function openPortfolioFor(clientId: string) {
    setPortfolioFocusId(clientId)
    setView('portfolio')
  }

  function openSearchFor(clientId: string) {
    setSearchFocusId(clientId)
    setView('search')
  }

  function openPlanTask(task: PlanTask) {
    if (task.target === 'calendar') setView('calendar')
    else if (task.target === 'properties') setView('properties')
    else if (task.target === 'search' && task.clientId) openSearchFor(task.clientId)
    else if (task.target === 'history' && task.clientId) openHistoryFor(task.clientId)
    else if (task.clientId) openPortfolioFor(task.clientId)
    else setView(task.target === 'history' ? 'history' : 'portfolio')
  }

  function addFirstProperty() {
    setView('properties')
    setPropertyFormOpen(true)
  }

  function openAppointment(propertyId = '') {
    setAppointmentPropertyId(propertyId)
    setAppointmentDate('')
    setAppointmentFormOpen(true)
    setView('calendar')
  }

  function bookSlot(start: string) {
    setAppointmentDate(start)
    setAppointmentFormOpen(true)
    window.setTimeout(() => document.querySelector('.appointment-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0)
  }

  function removeAppointment(id: string) {
    const appointment = appointments.find((item) => item.id === id)
    if (!appointment || !window.confirm(`Remover a visita de ${formatDate(appointment.date, true)}?`)) return
    setAppointments((current) => current.filter((item) => item.id !== id))
  }

  return (
    <main className="dash-shell">
      <aside className="dash-sidebar">
        <a className="dash-brand" href="/" aria-label="ImoAssistenteAI, voltar ao website">Imo<span>Assistente</span>AI</a>
        <div className="workspace-label">ESPAÇO DE TRABALHO</div>
        <nav className="dash-nav" aria-label="Navegação do painel">
          {menu.map(({ id, label, icon: Icon }) => (
            <button className={view === id ? 'active' : ''} key={id} onClick={() => { if (id === 'history') setHistoryFocusId(''); if (id === 'search') setSearchFocusId(''); if (id === 'portfolio') setPortfolioFocusId(''); setView(id) }} type="button">
              <Icon size={17} strokeWidth={1.7} /> <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="demo-status"><span /> Dados guardados neste browser</div>
        <a className="back-to-site" href="/">Voltar ao website <ExternalLink size={14} /></a>
      </aside>

      <section className="dash-main" ref={mainRef}>
        <header className="dash-topbar">
          <div><div className="dash-breadcrumb">IMOASSISTENTEAI <span>/</span> PAINEL</div><h1>{pageTitle}</h1></div>
          <div className="topbar-actions"><button className="icon-button" type="button" aria-label="Notificações" onClick={() => setView('overview')}><Bell size={17} />{(staleProperties.length > 0 || pendingFollowUps.length > 0) && <i />}</button>{editingName
            ? <input className="user-name-input" autoFocus aria-label="O teu nome" value={consultant} placeholder="O teu nome" onChange={(event) => setConsultant(event.target.value)} onBlur={() => setEditingName(false)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') setEditingName(false) }} />
            : <button className="user-chip" type="button" title="Definir o teu nome" onClick={() => setEditingName(true)}><span>{initialsOf(consultant) || '?'}</span><strong>{consultant.trim() || 'Define o teu nome'}</strong><ChevronDown size={14} /></button>}</div>
        </header>

        {view === 'overview' && <>
          <div className="dash-welcome"><div><span className="eyebrow">{new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }).format(now).toUpperCase()}</span><h2>{greetingFor(now)}{consultant.trim() ? `, ${consultant.trim().split(/\s+/)[0]}` : ''}.</h2><p>Este é o resumo do teu negócio hoje.</p></div><PanelButton kind="primary" onClick={() => openAppointment()}><Plus size={16} /> Agendar visita</PanelButton></div>
          {isEmpty && (
            <section className="dash-panel onboarding-panel">
              <div className="panel-heading"><div><span className="eyebrow">COMEÇAR</span><h3>Três passos para começar</h3></div></div>
              <ol className="onboarding-steps">
                <li><span><strong>1. Adiciona os teus imóveis</strong><small>O catálogo alimenta a agenda, a análise e o vídeo.</small></span><PanelButton onClick={addFirstProperty}>Adicionar imóvel</PanelButton></li>
                <li><span><strong>2. Regista os teus clientes</strong><small>No Histórico guardas contactos, visitas, notas e compras.</small></span><PanelButton onClick={() => setView('history')}>Abrir o Histórico</PanelButton></li>
                <li><span><strong>3. Marca as visitas</strong><small>A agenda junta cliente e imóvel e lembra os próximos contactos.</small></span><PanelButton onClick={() => openAppointment()}>Agendar visita</PanelButton></li>
              </ol>
            </section>
          )}
          {staleProperties.length > 0 && <button className="alert-banner" onClick={() => setView('properties')} type="button"><CircleAlert size={19} /><span><strong>{staleProperties.length} {staleProperties.length === 1 ? 'imóvel precisa' : 'imóveis precisam'} de confirmação</strong><small>Disponibilidade sem atualização há mais de 7 dias.</small></span><ArrowRight size={17} /></button>}
          <div className="metric-grid">
            <Metric icon={<UsersRound size={18} />} label="Clientes ativos" value={String(activeClients.length)} foot="em procura" />
            <Metric icon={<House size={18} />} label="Imóveis disponíveis" value={String(properties.filter((property) => property.status === 'Disponível').length)} foot="no teu catálogo" />
            <Metric icon={<CalendarDays size={18} />} label="Visitas agendadas" value={String(upcomingAppointments.length)} foot="próximas visitas" />
            <Metric icon={<ArrowDownUp size={18} />} label="Follow-ups pendentes" value={String(pendingFollowUps.length)} foot="para hoje ou em atraso" />
          </div>
          {!isEmpty && <WeeklyPlan plan={weeklyPlan} names={clientNames} onOpenTask={openPlanTask} onOpenClient={openPortfolioFor} />}
          <div className="overview-grid">
            <section className="dash-panel"><div className="panel-heading"><div><span className="eyebrow">AGENDA</span><h3>Próximas visitas</h3></div><button className="inline-link" type="button" onClick={() => setView('calendar')}>Ver agenda <ArrowRight size={14} /></button></div>
              {upcomingAppointments.slice(0, 4).map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} clients={clients} properties={properties} />)}
              {upcomingAppointments.length === 0 && <EmptyState>Sem visitas agendadas.</EmptyState>}
            </section>
          </div>
        </>}

        {view === 'properties' && <>
          <div className="page-intro"><div><p>Catálogo e estado comercial</p><span>Os teus imóveis e o estado comercial de cada um.</span></div><PanelButton kind="primary" onClick={() => setPropertyFormOpen(!propertyFormOpen)}><Plus size={16} /> Novo imóvel</PanelButton></div>
          {propertyFormOpen && <form className="dash-panel create-property-form" onSubmit={addProperty}><strong>Adicionar imóvel</strong><div className="form-two"><input name="title" placeholder="Título / descrição curta" required /><input name="zone" placeholder="Zona" required /></div><div className="form-three"><input name="price" type="number" placeholder="Preço (€)" required /><select name="typology"><option>T1</option><option>T2</option><option>T3</option><option>T4+</option></select><input name="bedrooms" type="number" placeholder="Quartos" min="0" required /></div><textarea name="details" placeholder="Detalhes confirmados: estado, condomínio, CPCV…" rows={2} /><PanelButton kind="primary" type="submit"><Plus size={15} /> Guardar imóvel</PanelButton></form>}
          {staleProperties.length > 0 && <div className="alert-banner property-alert"><CircleAlert size={19} /><span><strong>{staleProperties.length} imóveis com dados desatualizados</strong><small>Confirma disponibilidade e preço antes de partilhar.</small></span></div>}
          {properties.length === 0 && <EmptyState>Ainda não tens imóveis. Carrega em "Novo imóvel" para adicionares o primeiro.</EmptyState>}
          <div className="property-list">{properties.map((property) => {
            const stale = now - Date.parse(property.lastVerified) > 7 * 86400000 && property.status === 'Disponível'
            const matches = property.status === 'Disponível' ? matchClients(property, clients) : []
            return <article className="property-card dash-panel" key={property.id}><div className="property-thumb"><House size={25} strokeWidth={1.4} /><span>{property.reference}</span></div><div className="property-info"><div className="property-title-row"><div><h3>{property.title}</h3><p>{property.typology} · {property.zone} · {property.bedrooms} quartos</p></div><strong>{euro(property.price)}</strong></div><p className="property-details">{property.details}</p><div className="property-matches"><span>Clientes da carteira que encaixam</span>{matches.length > 0 ? matches.map(({ client, score }) => <button className="match-chip" type="button" key={client.id} title="Abrir a ficha na Carteira" onClick={() => openPortfolioFor(client.id)}>{client.name || 'Sem nome'} · {score}%</button>) : <em>{clients.length === 0 ? 'A carteira ainda não tem clientes.' : property.status === 'Disponível' ? 'Nenhum cliente à procura encaixa neste imóvel.' : 'Imóvel já não está disponível.'}</em>}</div><div className="property-meta"><span className={stale ? 'verification stale' : 'verification'}>{stale ? <CircleAlert size={13} /> : <Check size={13} />} Atualizado {formatDate(property.lastVerified)}</span><label>Estado do imóvel<select value={property.status} onChange={(event) => updateProperty(property.id, { status: event.target.value as PropertyStatus })}>{(['Disponível', 'Reservado', 'CPCV assinado', 'Vendido'] as PropertyStatus[]).map((status) => <option key={status}>{status}</option>)}</select></label><button className="verify-button" type="button" onClick={() => updateProperty(property.id, { lastVerified: new Date().toISOString().slice(0, 10) })}>Confirmar dados</button><button className="verify-button reject" type="button" onClick={() => removeProperty(property.id)}>Remover</button></div></div></article>
          })}</div>
        </>}

        {view === 'calendar' && <>
          <div className="page-intro"><div><p>Visitas e próximos contactos</p><span>Os registos ficam neste browser.</span></div><PanelButton kind="primary" onClick={() => { setAppointmentDate(''); setAppointmentFormOpen(!appointmentFormOpen) }}><Plus size={16} /> Nova marcação</PanelButton></div>
          {appointmentFormOpen && (clients.length === 0
            ? <div className="dash-panel appointment-form"><strong>Agendar visita</strong><EmptyState>Para agendar uma visita precisas de um cliente. Cria o primeiro no Histórico.</EmptyState><PanelButton onClick={() => setView('history')}><UsersRound size={15} /> Abrir o Histórico</PanelButton></div>
            : <form className="dash-panel appointment-form" onSubmit={addAppointment}><strong>Agendar visita</strong><div className="form-three"><label>Cliente<select name="clientId" required defaultValue={clients[0]?.id}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name || 'Sem nome'}</option>)}</select></label><label>Imóvel<select name="propertyId" defaultValue={appointmentPropertyId || selectedProperty?.id || ''}><option value="">Imóvel a definir</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.reference} · {property.zone}</option>)}</select></label><label>Data e hora<input name="date" type="datetime-local" required value={appointmentDate || dateIn(1, 11)} onChange={(event) => setAppointmentDate(event.target.value)} /></label></div><div className="form-three visit-contact"><label>Morada do imóvel<input name="address" placeholder="Rua, número, localidade" maxLength={160} /></label><label>Link do imóvel<input name="link" inputMode="url" placeholder="https://…" maxLength={400} /></label><label>Contacto do vendedor<input name="seller" placeholder="Nome e telefone" maxLength={120} /></label></div><div className="visit-duration"><span className="visit-duration-label">Duração da visita</span><div className="visit-duration-options" role="group" aria-label="Duração da visita">{[30, 45, 60, 90, 120].map((minutes) => <button className={appointmentMinutes === minutes ? 'is-active' : ''} key={minutes} type="button" aria-pressed={appointmentMinutes === minutes} onClick={() => setAppointmentMinutes(minutes)}>{minutes} min</button>)}<label className="visit-duration-custom">Outra<input name="minutes" type="number" min="15" max="480" step="5" required value={appointmentMinutes} onChange={(event) => setAppointmentMinutes(Number(event.target.value))} /><span>min</span></label></div><small>{visitEnd(appointmentDate || dateIn(1, 11), appointmentMinutes)}</small></div><PanelButton kind="primary" type="submit"><CalendarDays size={15} /> Guardar visita</PanelButton></form>)}
          <WeekCalendar events={calendarEvents} now={now} onSlot={bookSlot} onRemove={removeAppointment} />
          <section className="dash-panel full-agenda"><div className="panel-heading"><div><span className="eyebrow">AGENDA</span><h3>Visitas e contactos</h3></div><span className="connection-state">{upcomingAppointments.length} próximos</span></div>{appointments.slice().sort((a, b) => a.date.localeCompare(b.date)).map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} clients={clients} properties={properties} detailed onRemove={() => setAppointments((current) => current.filter((item) => item.id !== appointment.id))} />)}{appointments.length === 0 && <EmptyState>Ainda não há visitas marcadas.</EmptyState>}</section>
        </>}

        {view === 'portfolio' && <Suspense fallback={<div className="empty-state">A abrir a carteira de clientes…</div>}><ClientPortfolio initialClientId={portfolioFocusId} onOpenHistory={openHistoryFor} onOpenSearch={openSearchFor} /></Suspense>}
        {view === 'search' && <Suspense fallback={<div className="empty-state">A abrir imóvel para cliente…</div>}><ClientSearch initialClientId={searchFocusId} onOpenPortfolio={openPortfolioFor} /></Suspense>}
        {view === 'history' && <Suspense fallback={<div className="empty-state">A abrir o histórico…</div>}><ClientHistory initialClientId={historyFocusId} onOpenPortfolio={openPortfolioFor} /></Suspense>}
        {view === 'admin' && account?.isAdmin && <Suspense fallback={<div className="empty-state">A abrir a administração…</div>}><Admin /></Suspense>}
        {view === 'messages' && <Suspense fallback={<div className="empty-state">A abrir as mensagens padrão…</div>}><Messages consultant={consultant} appointments={appointments} properties={properties} /></Suspense>}
        {view === 'analysis' && properties.length === 0 && <NeedProperty what="a análise do imóvel" onAdd={addFirstProperty} />}
        {view === 'analysis' && properties.length > 0 && <Suspense fallback={<div className="empty-state">A abrir a análise do imóvel…</div>}><PropertyAnalysis properties={properties} initialPropertyId={selectedProperty?.id ?? ''} /></Suspense>}
        {view === 'video' && properties.length === 0 && <NeedProperty what="o vídeo do imóvel" onAdd={addFirstProperty} />}
        {view === 'video' && properties.length > 0 && <Suspense fallback={<div className="empty-state">A abrir o estúdio de vídeo…</div>}><VideoStudio properties={properties} initialPropertyId={selectedProperty?.id ?? ''} /></Suspense>}

        <footer className="dash-footer"><span>IMOASSISTENTEAI</span><span>Os dados são guardados localmente neste browser. Descarrega uma cópia do Histórico de vez em quando.</span></footer>
      </section>
    </main>
  )
}

function Metric({ icon, label, value, foot }: { icon: React.ReactNode; label: string; value: string; foot: string }) {
  return <article className="metric-card dash-panel"><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong><small>{foot}</small></article>
}

function AppointmentRow({ appointment, clients, properties, detailed = false, onRemove }: { appointment: Appointment; clients: HistoryClient[]; properties: Property[]; detailed?: boolean; onRemove?: () => void }) {
  const client = clients.find((item) => item.id === appointment.clientId)
  const property = properties.find((item) => item.id === appointment.propertyId)
  return <div className="appointment-row"><div className="appointment-date"><strong>{new Intl.DateTimeFormat('pt-PT', { day: '2-digit' }).format(new Date(appointment.date))}</strong><span>{new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(new Date(appointment.date)).replace('.', '')}</span></div><div className="appointment-info"><strong>{client ? client.name || 'Sem nome' : 'Cliente removido'}</strong><span>{property?.title ?? (appointment.propertyId ? 'Imóvel removido' : 'Imóvel a definir')}</span><small>{formatDate(appointment.date, true)}</small>{detailed && <VisitDetails appointment={appointment} />}</div>{detailed && onRemove && <button className="row-remove" type="button" aria-label="Remover marcação" onClick={onRemove}><X size={15} /></button>}</div>
}

function VisitDetails({ appointment }: { appointment: Appointment }) {
  const link = normalizeLink(appointment.link ?? '')
  const phone = phoneHref(appointment.seller ?? '')
  if (!appointment.address && !link && !appointment.seller) return null
  return <span className="visit-details">
    {appointment.address && <span><MapPin size={12} /> {appointment.address}</span>}
    {link && <a href={link} target="_blank" rel="noopener noreferrer"><LinkIcon size={12} /> {linkLabel(link)}</a>}
    {appointment.seller && (phone ? <a href={phone}><Phone size={12} /> {appointment.seller}</a> : <span><Phone size={12} /> {appointment.seller}</span>)}
  </span>
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>
}

function NeedProperty({ what, onAdd }: { what: string; onAdd: () => void }) {
  return <section className="dash-panel need-property"><EmptyState>Para usar {what} precisas de pelo menos um imóvel no catálogo.</EmptyState><PanelButton kind="primary" onClick={onAdd}><Plus size={16} /> Adicionar imóvel</PanelButton></section>
}
