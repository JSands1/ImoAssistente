import { z } from 'zod'
import { ApiError, type AiPayload } from './ai-requests'
import { firebaseConfigured } from './firebase'
import { estimatedPriceRange, formatEur, pricePerM2, type Comparable, type MarketStats } from './market-stats'

// ---------- Características do imóvel (introduzidas pelo consultor) ----------

export const energyClasses = ['A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F'] as const

export const propertyTypeOptions = [
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'moradia', label: 'Moradia' },
  { value: 'outro', label: 'Outro' },
] as const

export const conditionOptions = [
  { value: 'novo', label: 'Novo / em construção' },
  { value: 'renovado', label: 'Renovado' },
  { value: 'bom', label: 'Bom estado' },
  { value: 'a_recuperar', label: 'Para recuperar' },
] as const

export const typologyOptions = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6+'] as const
export const outdoorOptions = ['Nenhum', 'Varanda', 'Terraço', 'Jardim', 'Varanda e jardim'] as const
export const sunOptions = ['Norte', 'Sul', 'Nascente', 'Poente', 'Nascente/Poente', 'Não sei'] as const

const optionalNumber = (schema: z.ZodNumber) => schema.nullable().catch(null)

export const propertyDetailsSchema = z.object({
  location: z.string().catch(''),
  propertyType: z.enum(['apartamento', 'moradia', 'outro']).catch('apartamento'),
  typology: z.string().catch(''),
  usefulAreaM2: optionalNumber(z.number().positive()),
  constructionYear: optionalNumber(z.number().int().min(1800).max(2100)),
  energyClass: z.string().catch(''),
  condition: z.enum(['', 'novo', 'renovado', 'bom', 'a_recuperar']).catch(''),
  floor: z.string().catch(''),
  bathrooms: optionalNumber(z.number().int().min(0).max(20)),
  hasElevator: z.enum(['', 'sim', 'nao']).catch(''),
  parking: z.string().catch(''),
  outdoorSpace: z.string().catch(''),
  sunExposure: z.string().catch(''),
  askingPriceEur: optionalNumber(z.number().positive()),
  notes: z.string().catch(''),
})

export type PropertyDetails = z.infer<typeof propertyDetailsSchema>

export const emptyPropertyDetails: PropertyDetails = propertyDetailsSchema.parse({})

// ---------- Relatório gerado pela IA ----------

const textList = z.array(z.string()).catch([])

const level = z.preprocess(
  (value) => typeof value === 'string' ? value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase() : value,
  z.enum(['alto', 'medio', 'baixo']).catch('medio'),
)

export const valueSuggestionSchema = z.object({
  action: z.string(),
  impact: level,
  effort: level,
  rationale: z.string().catch(''),
})

export const aiReportSchema = z.object({
  summary: z.string(),
  typology: z.string().nullable().catch(null),
  layoutObservations: textList,
  strengths: textList,
  weaknesses: textList,
  valueSuggestions: z.array(valueSuggestionSchema).catch([]),
  missingInfo: textList,
  possibleMissedRooms: textList,
  caveats: textList,
})

export const storedReportSchema = aiReportSchema.extend({
  source: z.literal('INFERRED'),
  generatedAt: z.string(),
})

export type AiPropertyReport = z.infer<typeof storedReportSchema>

// ---------- Armazenamento local por imóvel ----------

const comparableSchema = z.object({
  id: z.string(),
  label: z.string().catch(''),
  priceEur: optionalNumber(z.number()),
  areaM2: optionalNumber(z.number()),
  url: z.string().catch(''),
})

// Um item corrompido é descartado sem perder os restantes.
const marketSchema = z.object({
  comparables: z.array(z.unknown()).catch([]).transform((items) => items.flatMap((item) => {
    const parsed = comparableSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })),
  fetchedAt: z.string(),
})

export const listingTones = [
  { value: 'profissional', label: 'Profissional' },
  { value: 'apelativo', label: 'Apelativo' },
  { value: 'conciso', label: 'Conciso' },
] as const

const listingSchema = z.object({
  title: z.string(),
  description: z.string(),
  highlights: textList,
})

export const storedListingSchema = listingSchema.extend({
  tone: z.string().catch('profissional'),
  generatedAt: z.string(),
})

export type AiListing = z.infer<typeof storedListingSchema>
export type MarketData = z.infer<typeof marketSchema>

const workspaceSchema = z.object({
  details: propertyDetailsSchema.catch(emptyPropertyDetails),
  market: marketSchema.nullable().catch(null),
  report: storedReportSchema.nullable().catch(null),
  listing: storedListingSchema.nullable().catch(null),
})

export type PropertyWorkspace = z.infer<typeof workspaceSchema>

const storageKey = 'casanexa-property-analysis'

function readAll(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

// Nunca lança: dados em falta ou corrompidos dão uma ficha vazia.
export function parseWorkspace(raw: unknown): PropertyWorkspace {
  const parsed = workspaceSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : { details: emptyPropertyDetails, market: null, report: null, listing: null }
}

// Só as características ficam guardadas entre visitas. A análise, o descritivo e os preços da zona
// existem apenas enquanto a página está aberta (o consultor descarrega-os se os quiser manter).
export function loadWorkspace(propertyId: string): PropertyWorkspace {
  return { ...parseWorkspace(readAll()[propertyId]), market: null, report: null, listing: null }
}

export function saveWorkspace(propertyId: string, workspace: PropertyWorkspace) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...readAll(), [propertyId]: { details: workspace.details } }))
  } catch {
    // Sem armazenamento disponível: o trabalho continua apenas em memória.
  }
}

// ---------- Pedido à IA ----------

const conditionLabel = Object.fromEntries(conditionOptions.map((option) => [option.value, option.label]))
const typeLabel = Object.fromEntries(propertyTypeOptions.map((option) => [option.value, option.label]))

function line(label: string, value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? null : `- ${label}: ${value}`
}

// Características preenchidas, como pares [rótulo, valor], para o contexto da IA e para o ficheiro descarregado.
export function detailRows(details: PropertyDetails): Array<[string, string]> {
  const rows: Array<[string, string | number | null]> = [
    ['Localização', details.location],
    ['Tipo', typeLabel[details.propertyType]],
    ['Tipologia', details.typology],
    ['Área útil (m²)', details.usefulAreaM2],
    ['Ano de construção', details.constructionYear],
    ['Classificação energética', details.energyClass],
    ['Estado de conservação', details.condition ? conditionLabel[details.condition] : ''],
    ['Piso', details.floor],
    ['Casas de banho', details.bathrooms],
    ['Elevador', details.hasElevator === 'sim' ? 'Sim' : details.hasElevator === 'nao' ? 'Não' : ''],
    ['Estacionamento', details.parking],
    ['Espaço exterior', details.outdoorSpace],
    ['Exposição solar', details.sunExposure],
    ['Preço pedido', details.askingPriceEur === null ? null : formatEur(details.askingPriceEur)],
    ['Notas do consultor', details.notes],
  ]
  return rows.flatMap(([label, value]) => value === null || value === '' ? [] : [[label, String(value)] as [string, string]])
}

export function buildContext(details: PropertyDetails, stats: MarketStats | null, comparables: Comparable[]) {
  const detailLines = detailRows(details).map(([label, value]) => line(label, label === 'Notas do consultor' ? value.slice(0, 1500) : value))
    .filter((entry): entry is string => entry !== null)

  const parts = [
    `Características indicadas pelo consultor:\n${detailLines.length ? detailLines.join('\n') : '- (nenhuma indicada)'}`,
  ]

  if (stats) {
    const range = estimatedPriceRange(stats, details.usefulAreaM2)
    const askingPerM2 = details.askingPriceEur !== null && details.usefulAreaM2 !== null
      ? pricePerM2({ priceEur: details.askingPriceEur, areaM2: details.usefulAreaM2 })
      : null
    parts.push([
      `Preços da zona obtidos por pesquisa automática na web (${stats.count} anúncios válidos; não verificados):`,
      `- Preço médio: ${formatEur(stats.meanPerM2)}/m² · desvio padrão: ${formatEur(stats.sdPerM2)}/m²`,
      `- Intervalo média ± 1 desvio padrão: ${formatEur(stats.lowPerM2)} a ${formatEur(stats.highPerM2)}/m²`,
      range ? `- Intervalo correspondente para a área deste imóvel: ${formatEur(range.low)} a ${formatEur(range.high)}` : null,
      askingPerM2 === null ? null : `- Preço pedido deste imóvel: ${formatEur(askingPerM2)}/m²`,
      stats.count < 5 ? '- Atenção: poucos comparáveis; a estatística é pouco fiável.' : null,
    ].filter((entry): entry is string => entry !== null).join('\n'))
  } else if (comparables.length > 0) {
    parts.push('Preços da zona: dados insuficientes para estatística.')
  }

  return parts.join('\n\n')
}

// ---------- Chamadas à IA ----------

type ApiResult = { text?: string; error?: string; status?: number }

export { ApiError }

// Em produção (ou com VITE_AI_BACKEND=firebase) a IA é chamada pelo Firebase AI Logic, sem servidor nosso e sem chave no browser.
// Em `npm run dev` continua a usar o proxy local do Vite com a GEMINI_API_KEY do .env (VITE_AI_BACKEND=proxy força-o).
function usesFirebaseAi() {
  const choice = import.meta.env.VITE_AI_BACKEND
  return firebaseConfigured && (choice === 'firebase' || (choice !== 'proxy' && !import.meta.env.DEV))
}

async function callApi(path: string, payload: unknown, fallbackError: string) {
  if (usesFirebaseAi()) {
    const { runAiViaFirebase } = await import('./ai-firebase')
    return runAiViaFirebase(path, payload as AiPayload, fallbackError)
  }
  let response: Response
  try {
    response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  } catch {
    throw new Error('Não foi possível contactar o servidor local. Confirma que o npm run dev está a correr.')
  }
  const body = await response.json().catch(() => null) as ApiResult | null
  if (!response.ok || !body?.text) throw new ApiError(body?.error ?? fallbackError, body?.status ?? response.status)
  return body.text
}

// Aceita JSON puro, dentro de um bloco ```json … ``` ou com texto à volta.
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('A resposta da IA não estava no formato esperado.')
    return JSON.parse(trimmed.slice(start, end + 1))
  }
}

function planImages(planPages: Array<{ page: number; dataUrl: string }>) {
  return planPages.map((preview) => ({
    mimeType: 'image/jpeg',
    data: preview.dataUrl.replace(/^data:image\/jpeg;base64,/, ''),
  }))
}

function parseOrThrow<T>(text: string, schema: z.ZodType<T>, message: string): T {
  let parsed: unknown
  try {
    parsed = extractJson(text)
  } catch {
    throw new Error(message)
  }
  const result = schema.safeParse(parsed)
  if (!result.success) throw new Error(message)
  return result.data
}

const formatError = 'A resposta da IA não estava no formato esperado. Tenta novamente.'

export async function generateAiPropertyReport(input: {
  details: PropertyDetails
  comparables?: Comparable[]
  stats?: MarketStats | null
  planPages: Array<{ page: number; dataUrl: string }>
}): Promise<AiPropertyReport> {
  const text = await callApi('/api/ai/property-report', {
    context: buildContext(input.details, input.stats ?? null, input.comparables ?? []),
    images: planImages(input.planPages),
  }, 'Não foi possível gerar a análise com IA.')
  const report = parseOrThrow(text, aiReportSchema, formatError)
  return { ...report, source: 'INFERRED', generatedAt: new Date().toISOString() }
}

export async function generateListing(input: { details: PropertyDetails; tone: string }): Promise<AiListing> {
  const text = await callApi('/api/ai/property-listing', {
    context: buildContext(input.details, null, []),
    tone: input.tone,
  }, 'Não foi possível gerar o descritivo.')
  const listing = parseOrThrow(text, listingSchema, formatError)
  if (!listing.description.trim()) throw new Error(formatError)
  return { ...listing, tone: input.tone, generatedAt: new Date().toISOString() }
}

// ---------- Preços da zona (pesquisa automática) ----------

const rawComparableSchema = z.object({
  label: z.string().catch(''),
  priceEur: z.number(),
  areaM2: z.number(),
  url: z.string(),
})

function isHttpUrl(value: string) {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

// Só aceita itens com preço, área e ligação válidos, sem repetidos e com valores plausíveis.
export function sanitizeComparables(raw: unknown): Comparable[] {
  const list = raw && typeof raw === 'object' && 'comparables' in raw ? (raw as { comparables: unknown }).comparables : []
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const result: Comparable[] = []
  for (const item of list) {
    const parsed = rawComparableSchema.safeParse(item)
    if (!parsed.success) continue
    const { label, priceEur, areaM2, url } = parsed.data
    const perM2 = priceEur / areaM2
    if (!isHttpUrl(url) || seen.has(url)) continue
    if (areaM2 < 15 || areaM2 > 2000 || priceEur < 10000 || perM2 < 300 || perM2 > 30000) continue
    seen.add(url)
    result.push({ id: crypto.randomUUID(), label: label.trim().slice(0, 120), priceEur: Math.round(priceEur), areaM2, url })
  }
  return result
}

export function marketQuery(details: PropertyDetails) {
  return [
    line('Localização', details.location),
    line('Tipo', typeLabel[details.propertyType]),
    line('Tipologia', details.typology),
    line('Área útil aproximada (m²)', details.usefulAreaM2),
    line('Estado de conservação', details.condition ? conditionLabel[details.condition] : ''),
  ].filter((entry): entry is string => entry !== null).join('\n')
}

export async function fetchMarketComparables(details: PropertyDetails): Promise<MarketData> {
  const text = await callApi('/api/ai/market-comparables', { context: marketQuery(details) }, 'Não foi possível pesquisar os preços da zona.')
  let parsed: unknown
  try {
    parsed = extractJson(text)
  } catch {
    throw new Error('A pesquisa não devolveu dados num formato utilizável. Tenta novamente.')
  }
  return { comparables: sanitizeComparables(parsed), fetchedAt: new Date().toISOString() }
}
