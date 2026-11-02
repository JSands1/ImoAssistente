import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Check, Copy, ExternalLink, MessageCircle, TriangleAlert, UsersRound } from 'lucide-react'
import {
  applyProfilePatch,
  onlyUnsupportedTypes,
  buildSearchProfile,
  emptyExtras,
  migrateSearchProfiles,
  parseExtras,
  type SearchExtras,
} from '../lib/client-search'
import { clientStatusLabel, describeWants, parseHistory, sortPortfolio, type HistoryClient } from '../lib/history'
import {
  buildMessage,
  buildPortalLinks,
  conditionOptions,
  describeProfile,
  districts,
  emptyProfile,
  featureOptions,
  parseProfiles,
  searchTypologies,
  whatsappUrl,
  type SearchProfile,
} from '../lib/portal-links'
import { openInPopup, shouldUsePopup } from '../lib/popup'
import './VideoStudio.css'
import './ClientSearch.css'

const historyKey = 'casanexa-history'
const extrasKey = 'casanexa-search-extras'
const freeKey = 'casanexa-free-search'
const legacyProfilesKey = 'casanexa-client-searches'
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

// Os perfis da antiga página de procura passam para a carteira (ver migrateSearchProfiles). Só se remove a chave antiga
// depois de gravar o resultado.
function loadSearchState(): { clients: HistoryClient[]; extras: Record<string, SearchExtras> } {
  let clients = parseHistory(readStorage(historyKey))
  let extras = parseExtras(readStorage(extrasKey))
  const legacy = readStorage(legacyProfilesKey)
  if (legacy !== null) {
    const migrated = migrateSearchProfiles(parseProfiles(legacy), clients)
    clients = migrated.clients
    extras = { ...migrated.extras, ...extras }
    try {
      if (migrated.created > 0) localStorage.setItem(historyKey, JSON.stringify(clients))
      localStorage.setItem(extrasKey, JSON.stringify(extras))
      localStorage.removeItem(legacyProfilesKey)
    } catch {
      // Sem armazenamento: mantém os dados antigos onde estão.
    }
  }
  return { clients, extras }
}

function numberValue(event: ChangeEvent<HTMLInputElement>) {
  return event.target.value === '' ? null : Number(event.target.value)
}

type Props = {
  initialClientId?: string
  onOpenPortfolio: (clientId: string) => void
}

export default function ClientSearch({ initialClientId = '', onOpenPortfolio }: Props) {
  const [loaded] = useState(loadSearchState)
  const [clients, setClients] = useState<HistoryClient[]>(loaded.clients)
  const [extras, setExtras] = useState<Record<string, SearchExtras>>(loaded.extras)
  const [freeProfile, setFreeProfile] = useState<SearchProfile>(() => parseProfiles([readStorage(freeKey)])[0] ?? emptyProfile('livre'))
  const [selectedId, setSelectedId] = useState(() => {
    if (clients.some((item) => item.id === initialClientId)) return initialClientId
    return sortPortfolio(clients.filter((item) => item.status === 'procura'))[0]?.id ?? ''
  })
  const [signature, setSignature] = useState(() => {
    const saved = readStorage(signatureKey)
    return typeof saved === 'string' ? saved : ''
  })
  // null: texto automático; string: texto editado à mão pelo consultor.
  const [customMessage, setCustomMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState('')
  const [copyError, setCopyError] = useState('')

  // Só os clientes que ainda procuram casa (o escolhido fica sempre na lista, mesmo que entretanto tenha comprado).
  const ordered = useMemo(() => sortPortfolio(clients.filter((item) => item.status === 'procura' || item.id === selectedId)), [clients, selectedId])
  const client = clients.find((item) => item.id === selectedId)
  const unsupportedType = client ? onlyUnsupportedTypes(client.wants) : ''
  const profile = client ? buildSearchProfile(client, extras[client.id] ?? emptyExtras) : freeProfile
  const links = useMemo(() => buildPortalLinks(profile), [profile])
  const autoMessage = useMemo(() => links.length > 0 ? buildMessage({ profile, links, signature }) : '', [profile, links, signature])
  const message = customMessage ?? autoMessage

  useEffect(() => { writeStorage(historyKey, clients) }, [clients])
  useEffect(() => { writeStorage(extrasKey, extras) }, [extras])
  useEffect(() => { writeStorage(freeKey, freeProfile) }, [freeProfile])
  useEffect(() => { writeStorage(signatureKey, signature) }, [signature])

  // Com um cliente escolhido, os critérios são os da ficha: o que se altera aqui atualiza a carteira.
  function update(patch: Partial<SearchProfile>) {
    if (!client) {
      setFreeProfile((current) => ({ ...current, ...patch }))
      return
    }
    const applied = applyProfilePatch(client, extras[client.id] ?? emptyExtras, patch)
    setClients((current) => current.map((item) => item.id === client.id ? applied.client : item))
    setExtras((current) => ({ ...current, [client.id]: applied.extras }))
  }

  function selectClient(id: string) {
    setSelectedId(id)
    setCustomMessage(null)
    setCopied('')
    setCopyError('')
  }

  async function copy(kind: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setCopyError('')
      window.setTimeout(() => setCopied((current) => current === kind ? '' : current), 1800)
    } catch {
      setCopyError('Não foi possível copiar automaticamente. Seleciona o texto e copia manualmente.')
    }
  }


  return (
    <section className="client-search-page">
      <header className="client-search-heading">
        <div><span className="eyebrow">IMÓVEL PARA CLIENTE</span><h2>Encontra o imóvel certo para o teu cliente</h2><p>Escolhe um cliente da carteira e os critérios dele aparecem logo preenchidos. A página monta as pesquisas nos portais, já com os filtros, e prepara a mensagem para lhe enviares. Não usa IA nem envia dados do cliente para fora.</p></div>
      </header>

      <section className="cs-card dash-panel">
        <div className="cs-card-heading">
          <div><span className="eyebrow">1 · CLIENTE</span><h3>Cliente e critérios de procura</h3></div>
          <div className="cs-card-actions">
            <label className="studio-field cs-profile-select">Cliente da carteira
              <select value={client ? client.id : ''} onChange={(event) => selectClient(event.target.value)}>
                <option value="">Pesquisa livre (sem cliente)</option>
                {ordered.map((item) => <option key={item.id} value={item.id}>{item.name || 'Sem nome'} · {clientStatusLabel(item.status)}</option>)}
              </select>
            </label>
            <button className="dash-button" type="button" onClick={() => onOpenPortfolio(client?.id ?? '')}><UsersRound size={14} /> {client ? 'Abrir na Carteira' : 'Abrir a Carteira'}</button>
          </div>
        </div>

        {!clients.some((item) => item.status === 'procura') && <div className="cs-empty">{clients.length === 0 ? 'A carteira ainda não tem clientes. Cria o primeiro na Carteira de clientes' : 'Nenhum cliente da carteira está à procura de imóvel. Regista um cliente em procura na Carteira de clientes'} para os critérios aparecerem aqui preenchidos. Entretanto podes usar a pesquisa livre.</div>}
        {client ? (
          <p className="cs-linked">Critérios lidos da carteira: <strong>{describeWants(client.wants) || 'ainda sem critérios definidos'}</strong>. O que alterares aqui atualiza a ficha de {client.name || 'este cliente'}.</p>
        ) : (
          <p className="cs-linked">Pesquisa livre: não está ligada a nenhum cliente e não altera a carteira.</p>
        )}
        {unsupportedType && <p className="cs-warning"><TriangleAlert size={14} /> Este cliente procura {unsupportedType}, e os portais são pesquisados como apartamento ou moradia. Escolhe abaixo o tipo a pesquisar (isso também altera a ficha).</p>}

        <div className="cs-form-grid">
          <label className="studio-field">Nome do cliente<input value={profile.name} placeholder="Ex.: João Martins" onChange={(event) => update({ name: event.target.value })} /></label>
          <label className="studio-field">Telemóvel (para o WhatsApp)<input inputMode="tel" value={profile.phone} placeholder="Ex.: 912 345 678" onChange={(event) => update({ phone: event.target.value })} /></label>
          <label className="studio-field">Tipo<select value={profile.propertyType} onChange={(event) => update({ propertyType: event.target.value as SearchProfile['propertyType'] })}><option value="apartamento">Apartamento</option><option value="moradia">Moradia</option></select></label>
          <label className="studio-field">Tipologia<select value={profile.typology} onChange={(event) => update({ typology: event.target.value })}><option value="">Qualquer</option>{searchTypologies.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="studio-field">Distrito<select value={profile.district} onChange={(event) => update({ district: event.target.value })}><option value="">— escolhe —</option>{districts.map((district) => <option key={district.value} value={district.value}>{district.label}</option>)}</select></label>
          <label className="studio-field">Concelho<input value={profile.municipality} placeholder="Ex.: Torres Vedras" onChange={(event) => update({ municipality: event.target.value })} /></label>
          <label className="studio-field">Orçamento mínimo (€)<input type="number" min="0" step="5000" value={profile.budgetMin ?? ''} onChange={(event) => update({ budgetMin: numberValue(event) })} /></label>
          <label className="studio-field">Orçamento máximo (€)<input type="number" min="0" step="5000" value={profile.budgetMax ?? ''} onChange={(event) => update({ budgetMax: numberValue(event) })} /></label>
          <label className="studio-field">Área mínima (m²)<input type="number" min="0" step="5" value={profile.areaMin ?? ''} onChange={(event) => update({ areaMin: numberValue(event) })} /></label>
          <label className="studio-field">Área máxima (m²)<input type="number" min="0" step="5" value={profile.areaMax ?? ''} onChange={(event) => update({ areaMax: numberValue(event) })} /></label>
          <label className="studio-field">Estado<select value={profile.condition} onChange={(event) => update({ condition: event.target.value as SearchProfile['condition'] })}><option value="">Qualquer</option>{conditionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <fieldset className="cs-features cs-span-full">
            <legend>Características pretendidas</legend>
            {featureOptions.map((option) => (
              <label className="cs-check" key={option.value}>
                <input type="checkbox" checked={profile.features.includes(option.value)} onChange={(event) => update({ features: event.target.checked ? [...profile.features, option.value] : profile.features.filter((feature) => feature !== option.value) })} />
                {option.label}
              </label>
            ))}
          </fieldset>
          <label className="studio-field cs-span-full">Outras preferências desta pesquisa (só como nota na mensagem)<input value={profile.preferences} placeholder="Ex.: perto da escola, rua sossegada" onChange={(event) => update({ preferences: event.target.value })} /></label>
        </div>
        {profile.municipality.trim() && !profile.district && <p className="cs-warning"><TriangleAlert size={14} /> Escolhe o distrito: o Imovirtual precisa dele para abrir a pesquisa certa.</p>}
        <p className="cs-hint">A área, o estado e as preferências em texto ficam guardados só nesta pesquisa. Cada portal aplica só os filtros que consegui confirmar nele: por baixo de cada ligação vês o que fica aplicado e o que ainda tens de marcar no site.</p>
      </section>

      <section className="cs-card dash-panel">
        <div className="cs-card-heading"><div><span className="eyebrow">2 · PESQUISAS</span><h3>Ligações para os portais</h3></div></div>
        {links.length === 0 ? (
          <div className="cs-empty">Indica o concelho para gerar as pesquisas.</div>
        ) : (
          <div className="cs-links">
            {links.map((link) => (
              <article className="cs-link" key={link.id}>
                <div className="cs-link-head">
                  <strong>{link.name}</strong>
                  <span className={link.status === 'tested' ? 'cs-tag tested' : 'cs-tag'}>{link.status === 'tested' ? 'Filtros testados' : 'Confirma ao abrir'}</span>
                </div>
                <p className="cs-hint">{link.note}</p>
                <p className="cs-filters"><strong>Aplicados no endereço:</strong> {link.applied.length > 0 ? link.applied.join(', ') : 'só o concelho'}</p>
                {link.notApplied.length > 0 && <p className="cs-filters warn"><strong>Marca tu no site:</strong> {link.notApplied.join(', ')}</p>}
                <code className="cs-url">{link.url}</code>
                <div className="cs-link-actions">
                  <a className="dash-button" href={link.url} target="_blank" rel="noopener noreferrer" title="Abre numa janela pequena por cima da app. Ctrl+clique abre um separador." onClick={(event) => { if (shouldUsePopup(event)) { event.preventDefault(); openInPopup(link.url) } }}><ExternalLink size={14} /> Abrir</a>
                  <button className="dash-button" type="button" onClick={() => copy(link.id, link.url)}>{copied === link.id ? <Check size={14} /> : <Copy size={14} />} {copied === link.id ? 'Copiado' : 'Copiar'}</button>
                </div>
              </article>
            ))}
          </div>
        )}
        {links.length > 0 && <p className="cs-warning"><TriangleAlert size={14} /> Abre cada ligação antes de enviar para confirmares que mostra o que esperas. O botão Abrir usa uma janela pequena por cima da app (se o browser a bloquear, permite pop-ups para este site; com Ctrl+clique abre um separador). Alguns portais, como o Imovirtual, abrem uma janela nova de cada vez: fecha as que já não precisas. Os portais podem mudar o formato dos endereços sem aviso.</p>}
      </section>

      <section className="cs-card dash-panel">
        <div className="cs-card-heading"><div><span className="eyebrow">3 · MENSAGEM</span><h3>Mensagem para {profile.name.trim() || 'o cliente'}</h3></div></div>
        <label className="studio-field">A tua assinatura (guardada neste browser)<input value={signature} placeholder="Ex.: Ana Silva · ImoAssistenteAI · 912 000 000" onChange={(event) => { setSignature(event.target.value); setCustomMessage(null) }} /></label>
        {links.length === 0 ? (
          <div className="cs-empty">A mensagem aparece quando houver um concelho.</div>
        ) : (
          <>
            <label className="studio-field">Texto da mensagem (podes editar)
              <textarea className="cs-textarea" value={message} onChange={(event) => setCustomMessage(event.target.value)} />
            </label>
            <p className="cs-hint">{describeProfile(profile)} · {message.length} caracteres{customMessage !== null && <> · <button className="inline-link" type="button" onClick={() => setCustomMessage(null)}>Repor texto automático</button></>}</p>
            {copyError && <p className="cs-warning" role="alert">{copyError}</p>}
            <div className="cs-link-actions">
              <button className="dash-button primary" type="button" onClick={() => copy('message', message)}>{copied === 'message' ? <Check size={14} /> : <Copy size={14} />} {copied === 'message' ? 'Copiado' : 'Copiar mensagem'}</button>
              <a className="dash-button" href={whatsappUrl(message, profile.phone)} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> Abrir no WhatsApp</a>
            </div>
            <p className="cs-hint">O WhatsApp abre com o texto preenchido e só é enviado quando carregares em enviar. Os anúncios dos portais mudam todos os dias.</p>
          </>
        )}
      </section>
    </section>
  )
}
