import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, MessageCircle, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { clientStatusLabel, parseHistory, sortPortfolio, todayIso, type HistoryClient } from '../lib/history'
import {
  defaultTemplates,
  describeDay,
  fillTemplate,
  loadTemplates,
  missingFields,
  newTemplate,
  placeholderFields,
  placeholdersIn,
  saveTemplates,
  type MessageTemplate,
  type PlaceholderKey,
} from '../lib/message-templates'
import { firstName, whatsappNumber, whatsappUrl } from '../lib/portal-links'
import './VideoStudio.css'
import './ClientSearch.css'
import './Messages.css'

const historyKey = 'casanexa-history'

type VisitInfo = { id: string; clientId: string; propertyId: string; date: string; address?: string }
type PropertyInfo = { id: string; title: string }
type Fields = { imovel: string; morada: string; dia: string; hora: string }
const emptyFields: Fields = { imovel: '', morada: '', dia: '', hora: '' }

function loadClients(): HistoryClient[] {
  try {
    return parseHistory(JSON.parse(localStorage.getItem(historyKey) ?? 'null'))
  } catch {
    return []
  }
}

function saveClients(clients: HistoryClient[]) {
  try {
    localStorage.setItem(historyKey, JSON.stringify(clients))
  } catch {
    // Sem armazenamento, o contacto não fica registado na ficha.
  }
}

type Props = { consultant: string; appointments: VisitInfo[]; properties: PropertyInfo[] }

export default function Messages({ consultant, appointments, properties }: Props) {
  const [clients, setClients] = useState<HistoryClient[]>(loadClients)
  const [templates, setTemplates] = useState<MessageTemplate[]>(loadTemplates)
  const [templateId, setTemplateId] = useState(() => templates[0]?.id ?? '')
  const [clientId, setClientId] = useState('')
  const [phone, setPhone] = useState('')
  const [fields, setFields] = useState<Fields>(emptyFields)
  // null: texto automático (modelo + campos); string: texto editado à mão.
  const [custom, setCustom] = useState<string | null>(null)
  const [registerContact, setRegisterContact] = useState(true)
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => { saveTemplates(templates) }, [templates])

  const template = templates.find((item) => item.id === templateId) ?? templates[0]
  const client = clients.find((item) => item.id === clientId)
  const ordered = useMemo(() => sortPortfolio(clients.filter((item) => item.status !== 'desistiu')), [clients])

  const values = {
    nome: client ? firstName(client.name) : '',
    consultor: consultant.trim(),
    imovel: fields.imovel,
    morada: fields.morada,
    data: describeDay(fields.dia),
    hora: fields.hora,
  }
  const auto = template ? fillTemplate(template.body, values) : ''
  const message = custom ?? auto
  const used = template ? placeholdersIn(template.body) : []
  const missing = template && custom === null ? missingFields(template.body, values) : []
  const phoneOk = whatsappNumber(phone) !== ''
  const labelOf = (key: PlaceholderKey) => placeholderFields.find((field) => field.key === key)?.label.toLowerCase() ?? key

  function selectClient(id: string) {
    const next = clients.find((item) => item.id === id)
    setClientId(id)
    setPhone(next?.phone ?? '')
    setCustom(null)
    setSent('')
    // Se o cliente tem uma visita marcada, o imóvel, a morada e a hora já vêm preenchidos.
    const now = new Date().toISOString().slice(0, 16)
    const visit = next ? appointments.filter((item) => item.clientId === id && item.date >= now).sort((a, b) => a.date.localeCompare(b.date))[0] : undefined
    setFields(visit ? { imovel: properties.find((item) => item.id === visit.propertyId)?.title ?? '', morada: visit.address ?? '', dia: visit.date.slice(0, 10), hora: visit.date.slice(11, 16) } : emptyFields)
  }

  function selectTemplate(id: string) {
    setTemplateId(id)
    setCustom(null)
    setSent('')
    setCopied(false)
  }

  function updateTemplate(patch: Partial<MessageTemplate>) {
    if (!template) return
    setTemplates((current) => current.map((item) => item.id === template.id ? { ...item, ...patch } : item))
    setCustom(null)
  }

  function addTemplate() {
    const created = newTemplate()
    setTemplates((current) => [...current, created])
    selectTemplate(created.id)
    setEditing(true)
  }

  function removeTemplate() {
    if (!template || !window.confirm(`Apagar o modelo "${template.title}"?`)) return
    const rest = templates.filter((item) => item.id !== template.id)
    setTemplates(rest.length > 0 ? rest : defaultTemplates)
    selectTemplate((rest.length > 0 ? rest : defaultTemplates)[0].id)
  }

  function restoreTemplates() {
    if (!window.confirm('Repor os modelos de origem? Os modelos que criaste ou alteraste perdem-se.')) return
    setTemplates(defaultTemplates)
    selectTemplate(defaultTemplates[0].id)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  // Ao enviar, o contacto fica registado na ficha (alimenta a análise da semana).
  function markContacted() {
    if (!client || !registerContact) return
    const today = todayIso(new Date())
    const next = clients.map((item) => item.id === client.id ? { ...item, lastContactAt: today } : item)
    setClients(next)
    saveClients(next)
    setSent(`Contacto de hoje registado na ficha de ${client.name || 'cliente'}.`)
  }

  return (
    <section className="client-search-page messages-page">
      <header className="client-search-heading">
        <div><span className="eyebrow">MENSAGENS PADRÃO</span><h2>Mensagens prontas a enviar</h2><p>Escolhe uma mensagem e um cliente: o nome e os restantes campos preenchem-se sozinhos. Depois abres o WhatsApp com o texto já escrito e só é enviado quando carregares em enviar.</p></div>
      </header>

      <div className="messages-layout">
        <section className="cs-card dash-panel messages-list">
          <div className="cs-card-heading"><div><span className="eyebrow">MODELOS</span><h3>As tuas mensagens</h3></div></div>
          <ul>
            {templates.map((item) => (
              <li key={item.id}>
                <button className={item.id === template?.id ? 'is-selected' : ''} type="button" onClick={() => selectTemplate(item.id)}>
                  <strong>{item.title || 'Sem título'}</strong>
                  <small>{item.body.slice(0, 70)}{item.body.length > 70 ? '…' : ''}</small>
                </button>
              </li>
            ))}
          </ul>
          <div className="messages-list-actions">
            <button className="dash-button" type="button" onClick={addTemplate}><Plus size={14} /> Novo modelo</button>
            <button className="dash-button quiet" type="button" onClick={restoreTemplates}><RotateCcw size={14} /> Repor originais</button>
          </div>
        </section>

        <div className="messages-main">
          <section className="cs-card dash-panel">
            <div className="cs-card-heading"><div><span className="eyebrow">1 · PARA QUEM</span><h3>Cliente e dados da mensagem</h3></div></div>
            <div className="messages-fields">
              <label className="studio-field">Cliente da carteira
                <select value={clientId} onChange={(event) => selectClient(event.target.value)}>
                  <option value="">Sem cliente (escrevo o número)</option>
                  {ordered.map((item) => <option key={item.id} value={item.id}>{item.name || 'Sem nome'} · {clientStatusLabel(item.status)}</option>)}
                </select>
              </label>
              <label className="studio-field">Telemóvel (para o WhatsApp)<input inputMode="tel" value={phone} placeholder="Ex.: 912 345 678" onChange={(event) => setPhone(event.target.value)} /></label>
              {used.includes('imovel') && <label className="studio-field">Imóvel<input list="messages-properties" value={fields.imovel} placeholder="Ex.: T2 em Torres Vedras" onChange={(event) => { setFields({ ...fields, imovel: event.target.value }); setCustom(null) }} /></label>}
              {used.includes('morada') && <label className="studio-field">Morada do imóvel<input value={fields.morada} placeholder="Ex.: Rua das Flores, 12" onChange={(event) => { setFields({ ...fields, morada: event.target.value }); setCustom(null) }} /></label>}
              {used.includes('data') && <label className="studio-field">Dia da visita<input type="date" value={fields.dia} onChange={(event) => { setFields({ ...fields, dia: event.target.value }); setCustom(null) }} /></label>}
              {used.includes('hora') && <label className="studio-field">Hora da visita<input type="time" value={fields.hora} onChange={(event) => { setFields({ ...fields, hora: event.target.value }); setCustom(null) }} /></label>}
            </div>
            <datalist id="messages-properties">{properties.map((item) => <option key={item.id} value={item.title} />)}</datalist>
            {!consultant.trim() && used.includes('consultor') && <p className="cs-warning" role="status">Define o teu nome no canto superior direito para ele aparecer na mensagem.</p>}
          </section>

          <section className="cs-card dash-panel">
            <div className="cs-card-heading"><div><span className="eyebrow">2 · MENSAGEM</span><h3>{template?.title || 'Mensagem'}</h3></div></div>
            <label className="studio-field">Texto da mensagem (podes editar)
              <textarea className="cs-textarea messages-text" value={message} onChange={(event) => setCustom(event.target.value)} />
            </label>
            <p className="cs-hint">{message.length} caracteres{custom !== null && <> · <button className="inline-link" type="button" onClick={() => setCustom(null)}>Repor texto do modelo</button></>}</p>
            {missing.length > 0 && <p className="cs-warning" role="status">Ainda falta preencher: {missing.map(labelOf).join(', ')}. Aparece entre chavetas na mensagem.</p>}
            {client && !phoneOk && <p className="cs-warning" role="status">{client.name || 'Este cliente'} não tem um telemóvel válido. Escreve-o acima para abrir a conversa certa.</p>}
            <label className="messages-register"><input type="checkbox" checked={registerContact} disabled={!client} onChange={(event) => setRegisterContact(event.target.checked)} /> Registar o contacto de hoje na ficha do cliente</label>
            <div className="cs-link-actions">
              <a className="dash-button primary" href={whatsappUrl(message, phone)} target="_blank" rel="noopener noreferrer" onClick={markContacted}><MessageCircle size={14} /> Enviar no WhatsApp</a>
              <button className="dash-button" type="button" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar mensagem'}</button>
            </div>
            {sent && <p className="cs-hint" role="status">{sent}</p>}
            {!phoneOk && !client && <p className="cs-hint">Sem número, o WhatsApp abre para escolheres o contacto.</p>}
          </section>

          {template && (
            <section className="cs-card dash-panel">
              <div className="cs-card-heading">
                <div><span className="eyebrow">3 · MODELO</span><h3>Editar este modelo</h3></div>
                <button className="dash-button quiet" type="button" onClick={() => setEditing((open) => !open)}>{editing ? 'Fechar' : 'Editar'}</button>
              </div>
              {editing && (
                <>
                  <label className="studio-field">Título<input value={template.title} onChange={(event) => updateTemplate({ title: event.target.value })} /></label>
                  <label className="studio-field">Texto do modelo
                    <textarea className="cs-textarea messages-text" value={template.body} onChange={(event) => updateTemplate({ body: event.target.value })} />
                  </label>
                  <p className="cs-hint">Campos que podes usar: {placeholderFields.map((field) => `{${field.key}}`).join(' ')}. As alterações ficam guardadas neste browser.</p>
                  <div className="cs-link-actions"><button className="dash-button quiet" type="button" onClick={removeTemplate}><Trash2 size={14} /> Apagar modelo</button></div>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </section>
  )
}
