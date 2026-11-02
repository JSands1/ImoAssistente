import { z } from 'zod'
import { formatEur } from './market-stats'

// ---------- Perfil de procura de um cliente ----------

export const districts = [
  { value: 'aveiro', label: 'Aveiro' },
  { value: 'beja', label: 'Beja' },
  { value: 'braga', label: 'Braga' },
  { value: 'braganca', label: 'Bragança' },
  { value: 'castelo-branco', label: 'Castelo Branco' },
  { value: 'coimbra', label: 'Coimbra' },
  { value: 'evora', label: 'Évora' },
  { value: 'faro', label: 'Faro' },
  { value: 'guarda', label: 'Guarda' },
  { value: 'leiria', label: 'Leiria' },
  { value: 'lisboa', label: 'Lisboa' },
  { value: 'portalegre', label: 'Portalegre' },
  { value: 'porto', label: 'Porto' },
  { value: 'santarem', label: 'Santarém' },
  { value: 'setubal', label: 'Setúbal' },
  { value: 'viana-do-castelo', label: 'Viana do Castelo' },
  { value: 'vila-real', label: 'Vila Real' },
  { value: 'viseu', label: 'Viseu' },
] as const

export const searchTypologies = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5'] as const

export const conditionOptions = [
  { value: 'novo', label: 'Novo / em construção' },
  { value: 'usado', label: 'Usado' },
  { value: 'bom-estado', label: 'Bom estado' },
  { value: 'recuperar', label: 'Para recuperar' },
] as const

export const featureOptions = [
  { value: 'elevador', label: 'Elevador' },
  { value: 'garagem', label: 'Garagem' },
  { value: 'varanda', label: 'Varanda' },
  { value: 'terraco', label: 'Terraço' },
  { value: 'jardim', label: 'Jardim' },
  { value: 'piscina', label: 'Piscina' },
  { value: 'ar-condicionado', label: 'Ar condicionado' },
] as const

type Feature = (typeof featureOptions)[number]['value']
const featureValues: string[] = featureOptions.map((option) => option.value)
const featureLabel = Object.fromEntries(featureOptions.map((option) => [option.value, option.label])) as Record<Feature, string>

const optionalPositive = z.number().positive().nullable().catch(null)

export const searchProfileSchema = z.object({
  id: z.string(),
  name: z.string().catch(''),
  phone: z.string().catch(''),
  propertyType: z.enum(['apartamento', 'moradia']).catch('apartamento'),
  typology: z.string().catch(''),
  district: z.string().catch('lisboa'),
  municipality: z.string().catch(''),
  budgetMin: optionalPositive,
  budgetMax: optionalPositive,
  areaMin: optionalPositive,
  areaMax: optionalPositive,
  condition: z.enum(['', 'novo', 'usado', 'bom-estado', 'recuperar']).catch(''),
  // Um valor inválido é descartado sem perder as características válidas.
  features: z.array(z.unknown()).catch([]).transform((items) => items.filter((item): item is Feature => typeof item === 'string' && featureValues.includes(item))),
  preferences: z.string().catch(''),
})

export type SearchProfile = z.infer<typeof searchProfileSchema>

export function emptyProfile(id: string): SearchProfile {
  return {
    id,
    name: '',
    phone: '',
    propertyType: 'apartamento',
    typology: '',
    district: 'lisboa',
    municipality: '',
    budgetMin: null,
    budgetMax: null,
    areaMin: null,
    areaMax: null,
    condition: '',
    features: [],
    preferences: '',
  }
}

// Um perfil corrompido é descartado sem perder os restantes.
export function parseProfiles(raw: unknown): SearchProfile[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const parsed = searchProfileSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

// ---------- Endereços de pesquisa ----------

export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export type PortalLink = {
  id: 'imovirtual' | 'sapo' | 'idealista'
  name: string
  url: string
  // 'tested': formato confirmado a abrir uma pesquisa filtrada. 'unverified': convém abrir e confirmar antes de enviar.
  status: 'tested' | 'unverified'
  note: string
  // Filtros do perfil que este endereço aplica, e os que o consultor ainda tem de marcar no site.
  applied: string[]
  notApplied: string[]
}

function numberOf(value: number | null) {
  return value !== null && value > 0 ? String(Math.round(value)) : null
}

const conditionLabel = Object.fromEntries(conditionOptions.map((option) => [option.value, option.label])) as Record<string, string>

export function describeProfile(profile: SearchProfile) {
  const kind = profile.propertyType === 'moradia' ? 'moradia' : 'apartamento'
  const parts = [profile.typology ? `${kind} ${profile.typology}` : kind]
  if (profile.municipality.trim()) parts.push(`em ${profile.municipality.trim()}`)
  const { budgetMin, budgetMax, areaMin, areaMax } = profile
  if (budgetMin !== null && budgetMax !== null) parts.push(`entre ${formatEur(budgetMin)} e ${formatEur(budgetMax)}`)
  else if (budgetMax !== null) parts.push(`até ${formatEur(budgetMax)}`)
  else if (budgetMin !== null) parts.push(`a partir de ${formatEur(budgetMin)}`)
  if (areaMin !== null && areaMax !== null) parts.push(`com ${areaMin} a ${areaMax} m²`)
  else if (areaMin !== null) parts.push(`com mais de ${areaMin} m²`)
  else if (areaMax !== null) parts.push(`com até ${areaMax} m²`)
  if (profile.condition) parts.push(`(${conditionLabel[profile.condition].toLowerCase()})`)
  if (profile.features.length > 0) parts.push(`com ${joinList(profile.features.map((feature) => featureLabel[feature].toLowerCase()))}`)
  return parts.join(' ')
}

function joinList(items: string[]) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

// Rótulos dos filtros que o perfil pede, para comparar com o que cada portal aplica.
function wantedFilters(profile: SearchProfile) {
  const wanted: string[] = []
  if (profile.typology) wanted.push('Tipologia')
  if (numberOf(profile.budgetMin)) wanted.push('Preço mínimo')
  if (numberOf(profile.budgetMax)) wanted.push('Preço máximo')
  if (numberOf(profile.areaMin)) wanted.push('Área mínima')
  if (numberOf(profile.areaMax)) wanted.push('Área máxima')
  if (profile.condition) wanted.push('Estado')
  for (const feature of profile.features) wanted.push(featureLabel[feature])
  return wanted
}

const imovirtualExtras: Partial<Record<Feature, string>> = {
  elevador: 'LIFT',
  garagem: 'GARAGE',
  varanda: 'BALCONY',
  terraco: 'TERRACE',
  jardim: 'GARDEN',
}

const idealistaFeatures: Partial<Record<Feature, string>> = {
  elevador: 'elevador',
  garagem: 'garagem',
  jardim: 'jardim',
  piscina: 'piscina',
  'ar-condicionado': 'arcondicionado',
}

export function buildPortalLinks(profile: SearchProfile): PortalLink[] {
  const municipality = slugify(profile.municipality)
  const district = slugify(profile.district)
  if (!municipality) return []
  const max = numberOf(profile.budgetMax)
  const min = numberOf(profile.budgetMin)
  const areaMin = numberOf(profile.areaMin)
  const areaMax = numberOf(profile.areaMax)
  const typology = profile.typology.toLowerCase()
  const wanted = wantedFilters(profile)

  // ----- Imovirtual: tipo, estado e tipologia no caminho; resto em parâmetros (todos testados a mudar o número de resultados) -----
  const imovirtualApplied: string[] = []
  if (typology) imovirtualApplied.push('Tipologia')
  const imovirtualParams = new URLSearchParams()
  if (max) { imovirtualParams.set('priceMax', max); imovirtualApplied.push('Preço máximo') }
  if (min) { imovirtualParams.set('priceMin', min); imovirtualApplied.push('Preço mínimo') }
  if (areaMin) { imovirtualParams.set('areaMin', areaMin); imovirtualApplied.push('Área mínima') }
  if (areaMax) { imovirtualParams.set('areaMax', areaMax); imovirtualApplied.push('Área máxima') }
  const imovirtualExtraCodes = profile.features.flatMap((feature) => {
    const code = imovirtualExtras[feature]
    if (!code) return []
    imovirtualApplied.push(featureLabel[feature])
    return [code]
  })
  if (imovirtualExtraCodes.length > 0) imovirtualParams.set('extras', `[${imovirtualExtraCodes.join(',')}]`)
  const imovirtualCondition = profile.condition === 'novo' ? 'nova-construcao' : profile.condition ? 'casas-usadas' : ''
  if (imovirtualCondition) imovirtualApplied.push('Estado')
  const imovirtualTypes = [profile.propertyType, imovirtualCondition, typology].filter(Boolean).join(',')
  const imovirtualQuery = imovirtualParams.toString()
  const imovirtualUrl = `https://www.imovirtual.com/pt/resultados/comprar/${imovirtualTypes}${district ? `/${district}` : ''}/${municipality}${imovirtualQuery ? `?${imovirtualQuery}` : ''}`
  const imovirtualNote = profile.condition && profile.condition !== 'novo'
    ? 'Filtros testados. O Imovirtual só distingue "novo" e "usado": o estado exato fica por confirmar nos anúncios.'
    : 'Filtros testados a mudar o número de resultados.'

  // ----- Casa Sapo: só tipologia e preço máximo (o resto não foi possível confirmar) -----
  const sapoApplied: string[] = []
  if (typology) sapoApplied.push('Tipologia')
  if (max) sapoApplied.push('Preço máximo')
  const sapoKind = profile.propertyType === 'moradia' ? 'moradias' : 'apartamentos'
  const sapoUrl = `https://casa.sapo.pt/comprar-${sapoKind}/${typology ? `${typology}/` : ''}${municipality}/${max ? `?gp=${max}` : ''}`

  // ----- Idealista: concelho + filtros separados por vírgulas, nomes copiados de páginas reais do site -----
  // O concelho de Setúbal tem o mesmo nome do distrito e usa /setubal/setubal/.
  const idealistaApplied: string[] = []
  const idealistaTokens: string[] = []
  if (min) { idealistaTokens.push(`preco-min_${min}`); idealistaApplied.push('Preço mínimo') }
  if (max) { idealistaTokens.push(`preco-max_${max}`); idealistaApplied.push('Preço máximo') }
  if (areaMin) { idealistaTokens.push(`tamanho-min_${areaMin}`); idealistaApplied.push('Área mínima') }
  if (areaMax) { idealistaTokens.push(`tamanho-max_${areaMax}`); idealistaApplied.push('Área máxima') }
  idealistaTokens.push(profile.propertyType === 'moradia' ? 'moradias' : 'apartamentos')
  if (typology) { idealistaTokens.push(typology); idealistaApplied.push('Tipologia') }
  const idealistaCondition = { novo: 'novo', 'bom-estado': 'bom-estado', recuperar: 'para-reformar' }[profile.condition as string]
  if (idealistaCondition) { idealistaTokens.push(idealistaCondition); idealistaApplied.push('Estado') }
  let balconyOrTerrace = false
  for (const feature of profile.features) {
    const token = idealistaFeatures[feature]
    if (token) {
      idealistaTokens.push(token)
      idealistaApplied.push(featureLabel[feature])
    } else if ((feature === 'varanda' || feature === 'terraco') && !balconyOrTerrace) {
      // O Idealista tem um único filtro para terraço e varanda.
      balconyOrTerrace = true
      idealistaTokens.push('terraco-e-varanda')
    }
    if (feature === 'varanda' || feature === 'terraco') idealistaApplied.push(featureLabel[feature])
  }
  const idealistaPlace = municipality === 'setubal' ? 'setubal/setubal' : municipality
  const idealistaUrl = `https://www.idealista.pt/comprar-casas/${idealistaPlace}/com-${idealistaTokens.join(',')}/`
  const idealistaNote = balconyOrTerrace
    ? 'Nomes dos filtros copiados de páginas reais do Idealista (o site junta terraço e varanda num só filtro). Não o consegui abrir automaticamente, porque o Idealista bloqueia robôs.'
    : 'Nomes dos filtros copiados de páginas reais do Idealista. Não o consegui abrir automaticamente, porque o Idealista bloqueia robôs.'

  const pending = (applied: string[]) => wanted.filter((filter) => !applied.includes(filter))
  return [
    { id: 'imovirtual', name: 'Imovirtual', url: imovirtualUrl, status: district ? 'tested' : 'unverified', note: district ? imovirtualNote : 'Falta o distrito: sem ele o Imovirtual pode não abrir a pesquisa certa. Escolhe o distrito.', applied: imovirtualApplied, notApplied: pending(imovirtualApplied) },
    { id: 'sapo', name: 'Casa Sapo', url: sapoUrl, status: 'unverified', note: 'Só consegui confirmar a tipologia e o preço máximo neste portal.', applied: sapoApplied, notApplied: pending(sapoApplied) },
    { id: 'idealista', name: 'Idealista', url: idealistaUrl, status: 'unverified', note: idealistaNote, applied: idealistaApplied, notApplied: pending(idealistaApplied) },
  ]
}

// ---------- Mensagem ao cliente ----------

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? ''
}

export function buildMessage(input: { profile: SearchProfile; links: PortalLink[]; signature: string }) {
  const { profile, links, signature } = input
  const greeting = firstName(profile.name) ? `Olá ${firstName(profile.name)},` : 'Olá,'
  const lines = [
    greeting,
    '',
    `Preparei pesquisas atualizadas para o que procuras: ${describeProfile(profile)}.`,
    '',
    ...links.flatMap((link) => [
      `• ${link.name}: ${link.url}`,
      ...(link.notApplied.length > 0 ? [`   (neste portal marca ainda: ${joinList(link.notApplied.map((filter) => filter.toLowerCase()))})`] : []),
    ]),
  ]
  const preferences = profile.preferences.trim()
  if (preferences) lines.push('', `Tive em conta o que me disseste ser importante: ${preferences}.`)
  lines.push('', 'Vê com calma e diz-me quais te interessam, que eu trato de marcar as visitas. Os anúncios mudam todos os dias, por isso algum pode já ter sido vendido.')
  if (signature.trim()) lines.push('', signature.trim())
  return lines.join('\n')
}

// Número em formato internacional para o WhatsApp. Devolve '' se não houver um número utilizável.
export function whatsappNumber(phone: string) {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 9) digits = `351${digits}`
  return digits.length >= 11 && digits.length <= 15 ? digits : ''
}

export function whatsappUrl(text: string, phone: string) {
  const number = whatsappNumber(phone)
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}
