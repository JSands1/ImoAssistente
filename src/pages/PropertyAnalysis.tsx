import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Check, Copy, Download, Eraser, FolderOpen, Loader2, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { loadSavedAnalyses, recordAnalysis, removeSavedAnalysis, saveSavedAnalyses, type SavedAnalysis } from '../lib/analysis-history'
import { buildAnalysisHtml, downloadHtml, exportFileName, hasAnalysisContent } from '../lib/analysis-export'
import {
  conditionOptions,
  emptyPropertyDetails,
  energyClasses,
  generateAiPropertyReport,
  generateListing,
  listingTones,
  loadWorkspace,
  outdoorOptions,
  propertyTypeOptions,
  saveWorkspace,
  sunOptions,
  typologyOptions,
  type AiPropertyReport,
  type PropertyDetails,
  type PropertyWorkspace,
} from '../lib/property-ai'
import { maxPlanPages, renderPlan, type RenderedPlan } from '../lib/plan-render'
import './VideoStudio.css'
import './PropertyAnalysis.css'

type PropertyOption = { id: string; reference: string; title: string }

type PropertyAnalysisProps = {
  properties: PropertyOption[]
  initialPropertyId: string
}

const levelLabel = { alto: 'Alto', medio: 'Médio', baixo: 'Baixo' } as const

function numberValue(event: ChangeEvent<HTMLInputElement>) {
  return event.target.value === '' ? null : Number(event.target.value)
}

export default function PropertyAnalysis({ properties, initialPropertyId }: PropertyAnalysisProps) {
  const [propertyId, setPropertyId] = useState(initialPropertyId || properties[0]?.id || '')
  const [workspace, setWorkspace] = useState(() => loadWorkspace(propertyId))
  const [plan, setPlan] = useState<RenderedPlan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [listingLoading, setListingLoading] = useState(false)
  const [listingTone, setListingTone] = useState('profissional')
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')
  const [listingError, setListingError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>(loadSavedAnalyses)
  // A entrada da lista que está aberta na página: gerar o descritivo acrescenta-o a ela.
  const [currentId, setCurrentId] = useState('')
  const [showAllAnalyses, setShowAllAnalyses] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const workspaceRef = useRef(workspace)

  const { details, report, listing } = workspace
  const selectedProperty = properties.find((property) => property.id === propertyId) ?? properties[0]
  const hasContent = hasAnalysisContent(workspace)
  const hasAnyDetail = JSON.stringify(details) !== JSON.stringify(emptyPropertyDetails)

  useEffect(() => {
    if (propertyId) saveWorkspace(propertyId, workspace)
    workspaceRef.current = workspace
  }, [propertyId, workspace])
  useEffect(() => { saveSavedAnalyses(analyses) }, [analyses])

  // Guarda na lista o que acabou de ser gerado (com as características como estavam nesse momento).
  function record(kind: 'report' | 'listing', generated: Partial<PropertyWorkspace>) {
    if (!selectedProperty) return
    const result = recordAnalysis(analyses, currentId, kind, {
      propertyId,
      reference: selectedProperty.reference,
      title: selectedProperty.title,
      savedAt: new Date().toISOString(),
      workspace: { ...workspaceRef.current, market: null, ...generated },
    }, crypto.randomUUID())
    setAnalyses(result.list)
    setCurrentId(result.id)
  }

  function openAnalysis(entry: SavedAnalysis) {
    if (!properties.some((property) => property.id === entry.propertyId)) return
    setPropertyId(entry.propertyId)
    setWorkspace({ details: entry.details, market: null, report: entry.report, listing: entry.listing })
    setCurrentId(entry.id)
    setPlan(null)
    resetMessages()
    window.setTimeout(() => document.getElementById('analysis-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function deleteAnalysis(entry: SavedAnalysis) {
    if (!window.confirm(`Apagar da lista a análise de ${entry.reference} · ${entry.title}?`)) return
    setAnalyses((current) => removeSavedAnalysis(current, entry.id))
    if (entry.id === currentId) setCurrentId('')
  }

  function selectProperty(nextId: string) {
    setCurrentId('')
    setPropertyId(nextId)
    setWorkspace(loadWorkspace(nextId))
    setPlan(null)
    setError('')
    setListingError('')
  }

  function setDetail<K extends keyof PropertyDetails>(key: K, value: PropertyDetails[K]) {
    setWorkspace((current) => ({ ...current, details: { ...current.details, [key]: value } }))
  }

  async function loadPlan(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setPlanLoading(true)
    setError('')
    try {
      setPlan(await renderPlan(file))
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : 'Não foi possível preparar a planta.')
    } finally {
      setPlanLoading(false)
    }
  }

  function confirmSend() {
    return window.confirm('As características do imóvel e as imagens da planta (se existirem) vão ser enviadas ao serviço de IA da Google (Gemini). Não incluas dados pessoais sensíveis. Continuar?')
  }

  async function generateReport() {
    const { propertyType: _propertyType, ...informative } = details
    const hasDetails = Object.values(informative).some((value) => value !== '' && value !== null)
    if (!plan && !hasDetails) {
      setError('Preenche algumas características ou carrega a planta antes de gerar a análise.')
      return
    }
    if (!confirmSend()) return
    setError('')
    setAiLoading(true)
    try {
      const generated = await generateAiPropertyReport({ details, planPages: plan?.pages ?? [] })
      setWorkspace((current) => ({ ...current, report: generated }))
      record('report', { report: generated })
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : 'Não foi possível gerar a análise com IA.')
    } finally {
      setAiLoading(false)
    }
  }

  async function generateListingText() {
    const { propertyType: _propertyType, ...informative } = details
    const hasDetails = Object.values(informative).some((value) => value !== '' && value !== null)
    if (!hasDetails) {
      setListingError('Preenche algumas características antes de gerar o descritivo.')
      return
    }
    if (!window.confirm('As características e as notas do imóvel vão ser enviadas ao serviço de IA da Google (Gemini) para escrever o descritivo. Não incluas dados pessoais sensíveis. Continuar?')) return
    setListingLoading(true)
    setListingError('')
    try {
      const generated = await generateListing({ details, tone: listingTone })
      setWorkspace((current) => ({ ...current, listing: generated }))
      record('listing', { listing: generated })
    } catch (listingGenerationError) {
      setListingError(listingGenerationError instanceof Error ? listingGenerationError.message : 'Não foi possível gerar o descritivo.')
    } finally {
      setListingLoading(false)
    }
  }

  function updateListing(patch: { title?: string; description?: string }) {
    setWorkspace((current) => current.listing ? { ...current, listing: { ...current.listing, ...patch } } : current)
  }

  async function downloadAnalysis() {
    if (!selectedProperty) return
    setExporting(true)
    setError('')
    try {
      const html = await buildAnalysisHtml({ reference: selectedProperty.reference, title: selectedProperty.title, workspace })
      downloadHtml(exportFileName(selectedProperty.reference), html)
    } catch {
      setError('Não foi possível criar o ficheiro da análise.')
    } finally {
      setExporting(false)
    }
  }

  function resetMessages() {
    setError('')
    setListingError('')
  }

  // Remove a análise gerada (preços, análise e descritivo) e mantém as características.
  function clearAnalysis() {
    if (!window.confirm('Limpar a análise que está aberta? Continua guardada na lista de análises e as características ficam guardadas.')) return
    setWorkspace((current) => ({ ...current, market: null, report: null, listing: null }))
    setCurrentId('')
    resetMessages()
  }

  // Remove tudo deste imóvel, incluindo as características e a planta carregada.
  function clearAll() {
    if (!window.confirm('Limpar todas as características e a análise abertas? As análises da lista continuam guardadas.')) return
    setWorkspace({ details: emptyPropertyDetails, market: null, report: null, listing: null })
    setCurrentId('')
    setPlan(null)
    resetMessages()
  }

  async function copy(kind: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      window.setTimeout(() => setCopied((current) => current === kind ? '' : current), 1800)
    } catch {
      setListingError('Não foi possível copiar automaticamente. Seleciona o texto e copia manualmente.')
    }
  }

  const listingFullText = listing ? [listing.title, listing?.description, listing.highlights.length ? listing.highlights.map((item) => `• ${item}`).join('\n') : ''].filter(Boolean).join('\n\n') : ''

  return (
    <section className="property-analysis-page">
      <header className="property-analysis-heading">
        <div><span className="eyebrow">ANÁLISE POR IA</span><h2>Análise do imóvel</h2><p>Indica as características e, se quiseres, carrega a planta. A IA analisa o imóvel, sugere como o valorizar e escreve o descritivo do anúncio.</p></div>
        <span className="ai-badge"><span /> GEMINI · ENVIO SÓ SE PEDIRES</span>
      </header>

      <div className="analysis-toolbar" role="toolbar" aria-label="Ações da análise">
        <button className="dash-button" type="button" disabled={!hasContent || exporting} title={hasContent ? 'Guarda um ficheiro com a análise, que podes abrir ou imprimir em PDF' : 'Gera uma análise ou um descritivo primeiro'} onClick={downloadAnalysis}>{exporting ? <Loader2 className="studio-spinner" size={14} /> : <Download size={14} />} Descarregar análise</button>
        <button className="dash-button" type="button" disabled={!hasContent} onClick={clearAnalysis}><Eraser size={14} /> Limpar análise</button>
        <button className="dash-button quiet" type="button" disabled={!hasContent && !hasAnyDetail && !plan} onClick={clearAll}><Trash2 size={14} /> Limpar tudo</button>
        {hasContent && <span className="analysis-toolbar-status">Guardada na lista de análises</span>}
      </div>

      <section className="analysis-card dash-panel analysis-history" aria-label="Análises feitas">
        <div className="analysis-card-heading">
          <div><span className="eyebrow">ANÁLISES FEITAS</span><h3>As tuas análises</h3></div>
          <span className="analysis-history-count">{analyses.length} {analyses.length === 1 ? 'análise' : 'análises'}</span>
        </div>
        {analyses.length === 0
          ? <div className="analysis-empty">Ainda não fizeste nenhuma análise. Quando gerares uma análise ou um descritivo, fica aqui guardada para a abrires mais tarde.</div>
          : <ul className="analysis-history-list">{(showAllAnalyses ? analyses : analyses.slice(0, 6)).map((entry) => {
            const exists = properties.some((property) => property.id === entry.propertyId)
            return (
              <li className={entry.id === currentId ? 'is-open' : ''} key={entry.id}>
                <div className="analysis-history-info">
                  <strong>{entry.reference} · {entry.title}</strong>
                  <small>{[entry.details.location, entry.details.typology, exists ? '' : 'Imóvel removido'].filter(Boolean).join(' · ') || 'Sem localização indicada'}</small>
                  <span className="analysis-history-tags">{entry.report && <i>Análise</i>}{entry.listing && <i>Descritivo</i>}<time dateTime={entry.savedAt}>{new Date(entry.savedAt).toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' })}</time></span>
                </div>
                <button className="dash-button" type="button" disabled={!exists || entry.id === currentId} title={exists ? 'Abrir esta análise' : 'O imóvel já não está no catálogo'} onClick={() => openAnalysis(entry)}><FolderOpen size={14} /> {entry.id === currentId ? 'Aberta' : 'Abrir'}</button>
                <button className="row-remove" type="button" aria-label={`Apagar a análise de ${entry.reference}`} onClick={() => deleteAnalysis(entry)}><X size={15} /></button>
              </li>
            )
          })}</ul>}
        {analyses.length > 6 && <button className="inline-link" type="button" onClick={() => setShowAllAnalyses((value) => !value)}>{showAllAnalyses ? 'Mostrar menos' : `Ver todas (${analyses.length})`}</button>}
      </section>

      <section className="analysis-card dash-panel">
        <div className="analysis-card-heading">
          <div><span className="eyebrow">1 · IMÓVEL</span><h3>Características</h3></div>
          <label className="studio-field analysis-property-select">Imóvel<select value={propertyId} onChange={(event) => selectProperty(event.target.value)}>{properties.map((property) => <option key={property.id} value={property.id}>{property.reference} · {property.title}</option>)}</select></label>
        </div>
        <p className="analysis-hint">Quanto mais completo, melhor a análise e o descritivo. Campos vazios são ignorados. {selectedProperty ? `A gravar para ${selectedProperty.reference}, neste browser.` : ''}</p>
        <div className="analysis-form-grid">
          <label className="studio-field span-2">Localização (concelho, freguesia)<input value={details.location} placeholder="Ex.: Matosinhos, Senhora da Hora" onChange={(event) => setDetail('location', event.target.value)} /></label>
          <label className="studio-field">Tipo<select value={details.propertyType} onChange={(event) => setDetail('propertyType', event.target.value as PropertyDetails['propertyType'])}>{propertyTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="studio-field">Tipologia<select value={details.typology} onChange={(event) => setDetail('typology', event.target.value)}><option value="">—</option>{typologyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="studio-field">Área útil (m²)<input type="number" min="0" step="0.1" value={details.usefulAreaM2 ?? ''} onChange={(event) => setDetail('usefulAreaM2', numberValue(event))} /></label>
          <label className="studio-field">Ano de construção<input type="number" min="1800" max="2100" value={details.constructionYear ?? ''} onChange={(event) => setDetail('constructionYear', numberValue(event))} /></label>
          <label className="studio-field">Classificação energética<select value={details.energyClass} onChange={(event) => setDetail('energyClass', event.target.value)}><option value="">—</option>{energyClasses.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="studio-field">Estado de conservação<select value={details.condition} onChange={(event) => setDetail('condition', event.target.value as PropertyDetails['condition'])}><option value="">—</option>{conditionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="studio-field">Piso<input value={details.floor} placeholder="Ex.: 3.º, R/C" onChange={(event) => setDetail('floor', event.target.value)} /></label>
          <label className="studio-field">Casas de banho<input type="number" min="0" max="20" value={details.bathrooms ?? ''} onChange={(event) => setDetail('bathrooms', numberValue(event))} /></label>
          <label className="studio-field">Elevador<select value={details.hasElevator} onChange={(event) => setDetail('hasElevator', event.target.value as PropertyDetails['hasElevator'])}><option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option></select></label>
          <label className="studio-field">Estacionamento<input value={details.parking} placeholder="Ex.: 1 lugar em garagem" onChange={(event) => setDetail('parking', event.target.value)} /></label>
          <label className="studio-field">Espaço exterior<select value={details.outdoorSpace} onChange={(event) => setDetail('outdoorSpace', event.target.value)}><option value="">—</option>{outdoorOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="studio-field">Exposição solar<select value={details.sunExposure} onChange={(event) => setDetail('sunExposure', event.target.value)}><option value="">—</option>{sunOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="studio-field">Preço pedido (€)<input type="number" min="0" step="1000" value={details.askingPriceEur ?? ''} onChange={(event) => setDetail('askingPriceEur', numberValue(event))} /></label>
          <label className="studio-field span-full">Notas do consultor<textarea value={details.notes} placeholder="Ex.: cozinha remodelada em 2021, janelas com vidro duplo, condomínio de 40 €/mês…" onChange={(event) => setDetail('notes', event.target.value)} /></label>
        </div>
      </section>

      <section className="analysis-card dash-panel">
        <div className="analysis-card-heading">
          <div><span className="eyebrow">2 · PLANTA (OPCIONAL)</span><h3>Planta do imóvel</h3></div>
          <button className="dash-button" type="button" disabled={planLoading} onClick={() => fileInput.current?.click()}>{planLoading ? <Loader2 className="studio-spinner" size={14} /> : <Upload size={14} />} {plan ? 'Trocar planta' : 'Carregar planta'}</button>
        </div>
        <input ref={fileInput} className="studio-file-input" type="file" accept="application/pdf,.pdf,image/png,image/jpeg,.png,.jpg,.jpeg" onChange={loadPlan} aria-label="Selecionar planta do imóvel" />
        {plan ? (
          <div className="plan-preview">
            <p className="analysis-hint">{plan.fileName} · {plan.pages.length} {plan.pages.length === 1 ? 'página pronta' : 'páginas prontas'} para análise{plan.totalPages > plan.pages.length ? ` (de ${plan.totalPages}; só as primeiras ${maxPlanPages} são enviadas)` : ''}. A planta não fica guardada.</p>
            <div className="plan-thumbs">{plan.pages.map((page) => <img key={page.page} src={page.dataUrl} alt={`Página ${page.page} da planta`} />)}</div>
          </div>
        ) : <p className="analysis-hint">PDF, PNG ou JPEG até 40 MB. Ajuda a IA a avaliar a distribuição e a circulação na análise (não é usada no descritivo). A planta fica só em memória e não é guardada.</p>}
      </section>

      <section className="analysis-card dash-panel" id="analysis-report">
        <div className="analysis-card-heading">
          <div><span className="eyebrow">3 · ANÁLISE</span><h3>Análise por IA</h3></div>
          <button className="dash-button primary" type="button" disabled={aiLoading || planLoading} onClick={generateReport}>{aiLoading ? <Loader2 className="studio-spinner" size={14} /> : <Sparkles size={14} />} {report ? 'Gerar novamente' : 'Gerar análise'}</button>
        </div>
        {aiLoading && <p className="analysis-hint">A analisar o imóvel… pode demorar alguns segundos.</p>}
        {error && <p className="analysis-error" role="alert">{error}</p>}
        {report ? <ReportView report={report} /> : !aiLoading && <div className="analysis-empty">A análise inclui resumo, vantagens, desvantagens e sugestões para valorizar o imóvel. Não inclui preço nem valor de mercado.</div>}
      </section>

      <section className="analysis-card dash-panel">
        <div className="analysis-card-heading">
          <div><span className="eyebrow">4 · ANÚNCIO</span><h3>Descritivo para o anúncio</h3></div>
          <div className="analysis-card-actions">
            <label className="studio-field tone-select">Tom<select value={listingTone} onChange={(event) => setListingTone(event.target.value)}>{listingTones.map((tone) => <option key={tone.value} value={tone.value}>{tone.label}</option>)}</select></label>
            <button className="dash-button primary" type="button" disabled={listingLoading} onClick={generateListingText}>{listingLoading ? <Loader2 className="studio-spinner" size={14} /> : <Sparkles size={14} />} {listing ? 'Gerar novamente' : 'Gerar descritivo'}</button>
          </div>
        </div>
        <p className="analysis-hint">Texto longo e detalhado, pronto a colar no portal, com base apenas nas características e nas notas que indicaste (a planta não é usada). Inclui um parágrafo sobre a zona com conhecimento geral da IA: confirma-o. Não inclui preço nem contactos. Revê antes de publicar.</p>
        {listingError && <p className="analysis-error" role="alert">{listingError}</p>}
        {listing ? (
          <div className="listing-body">
            <label className="studio-field">Título <span className="char-count">{listing.title.length} caracteres</span><input value={listing.title} onChange={(event) => updateListing({ title: event.target.value })} /></label>
            <label className="studio-field">Descrição <span className="char-count">{listing.description.length} caracteres</span><textarea className="listing-textarea" value={listing.description} onChange={(event) => updateListing({ description: event.target.value })} /></label>
            {listing.highlights.length > 0 && <div><strong className="listing-label">Destaques</strong><ul className="listing-highlights">{listing.highlights.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
            <div className="listing-actions">
              <button className="dash-button" type="button" onClick={() => copy('title', listing.title)}>{copied === 'title' ? <Check size={14} /> : <Copy size={14} />} {copied === 'title' ? 'Copiado' : 'Copiar título'}</button>
              <button className="dash-button" type="button" onClick={() => copy('description', listing.description)}>{copied === 'description' ? <Check size={14} /> : <Copy size={14} />} {copied === 'description' ? 'Copiado' : 'Copiar descrição'}</button>
              <button className="dash-button primary" type="button" onClick={() => copy('all', listingFullText)}>{copied === 'all' ? <Check size={14} /> : <Copy size={14} />} {copied === 'all' ? 'Copiado' : 'Copiar tudo'}</button>
            </div>
            <span className="ai-report-source">INFERRED · gerado por IA em {new Date(listing.generatedAt).toLocaleString('pt-PT')} · confirma que todos os factos estão corretos antes de publicar</span>
          </div>
        ) : !listingLoading && <div className="analysis-empty">Escolhe o tom e gera o título, a descrição e os destaques do anúncio.</div>}
      </section>
    </section>
  )
}

function ReportView({ report }: { report: AiPropertyReport }) {
  return (
    <div className="ai-report-body">
      <p className="ai-report-summary">{report.summary}{report.typology && <strong> · Tipologia sugerida: {report.typology}</strong>}</p>
      <div className="ai-report-columns">
        <div><strong>Vantagens</strong><ul>{report.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
        <div><strong>Desvantagens</strong><ul>{report.weaknesses.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
      </div>
      {report.valueSuggestions.length > 0 && (
        <div>
          <strong>Sugestões para valorizar o imóvel</strong>
          <div className="suggestion-list">
            {report.valueSuggestions.map((suggestion, index) => (
              <article className="suggestion" key={index}>
                <div><b>{suggestion.action}</b><span className={`level-tag impact-${suggestion.impact}`}>Impacto {levelLabel[suggestion.impact]}</span><span className="level-tag">Esforço {levelLabel[suggestion.effort]}</span></div>
                {suggestion.rationale && <p>{suggestion.rationale}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
      {report.layoutObservations.length > 0 && <div><strong>Distribuição</strong><ul>{report.layoutObservations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {report.possibleMissedRooms.length > 0 && <div><strong>Divisões visíveis na planta e não indicadas</strong><ul>{report.possibleMissedRooms.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {report.missingInfo.length > 0 && <div><strong>Informação em falta que melhoraria a análise</strong><ul>{report.missingInfo.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {report.caveats.length > 0 && <div><strong>Limitações</strong><ul>{report.caveats.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      <span className="ai-report-source">{report.source} · gerado por IA em {new Date(report.generatedAt).toLocaleString('pt-PT')} · requer revisão do consultor</span>
    </div>
  )
}
