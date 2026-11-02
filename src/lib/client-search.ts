import { emptyWants, historyTypologies, newClient, type ClientWants, type HistoryClient } from './history'
import { emptyProfile, type SearchProfile } from './portal-links'

// A procura de um cliente da carteira lê os critérios da ficha (zona, orçamento, tipo, tipologia, características).
// Só o que é específico de uma pesquisa (área, estado, preferências em texto) fica guardado à parte, por cliente.
export type SearchExtras = Pick<SearchProfile, 'areaMin' | 'areaMax' | 'condition' | 'preferences'>

export const emptyExtras: SearchExtras = { areaMin: null, areaMax: null, condition: '', preferences: '' }

const searchTypologies = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5']

export function buildSearchProfile(client: HistoryClient, extras: SearchExtras = emptyExtras): SearchProfile {
  const { wants } = client
  return {
    ...emptyProfile(client.id),
    name: client.name,
    phone: client.phone,
    propertyType: wants.propertyTypes.includes('apartamento') || !wants.propertyTypes.includes('moradia') ? 'apartamento' : 'moradia',
    // Os portais pesquisam uma tipologia de cada vez: usa a primeira que cobrem.
    typology: historyTypologies.find((value) => searchTypologies.includes(value) && wants.typologies.includes(value)) ?? '',
    district: wants.district,
    municipality: wants.municipality,
    budgetMin: wants.budgetMin,
    budgetMax: wants.budgetMax,
    features: wants.features,
    ...extras,
  }
}

// Aplica uma alteração feita na página de procura: os critérios vão para a ficha do cliente e o resto para os extras.
export function applyProfilePatch(client: HistoryClient, extras: SearchExtras, patch: Partial<SearchProfile>) {
  const wants: Partial<ClientWants> = {}
  const nextExtras: SearchExtras = { ...extras }
  const nextClient: HistoryClient = { ...client }

  if ('name' in patch && patch.name !== undefined) nextClient.name = patch.name
  if ('phone' in patch && patch.phone !== undefined) nextClient.phone = patch.phone
  // A procura pesquisa um tipo de cada vez: só toca na ficha se o tipo escolhido ainda não faz parte do que o cliente procura.
  if (patch.propertyType !== undefined && !client.wants.propertyTypes.includes(patch.propertyType)) {
    wants.propertyTypes = [...client.wants.propertyTypes.filter((kind) => kind !== 'apartamento' && kind !== 'moradia'), patch.propertyType]
  }
  // Só toca na ficha se a tipologia escolhida ainda não faz parte das que o cliente aceita ("Qualquer" limpa-as).
  if (patch.typology !== undefined && !client.wants.typologies.some((value) => value === patch.typology)) {
    wants.typologies = historyTypologies.filter((value) => value === patch.typology)
  }
  if (patch.district !== undefined) wants.district = patch.district
  if (patch.municipality !== undefined) wants.municipality = patch.municipality
  if ('budgetMin' in patch) wants.budgetMin = patch.budgetMin ?? null
  if ('budgetMax' in patch) wants.budgetMax = patch.budgetMax ?? null
  if (patch.features !== undefined) wants.features = patch.features
  if ('areaMin' in patch) nextExtras.areaMin = patch.areaMin ?? null
  if ('areaMax' in patch) nextExtras.areaMax = patch.areaMax ?? null
  if (patch.condition !== undefined) nextExtras.condition = patch.condition
  if (patch.preferences !== undefined) nextExtras.preferences = patch.preferences

  nextClient.wants = { ...client.wants, ...wants }
  return { client: nextClient, extras: nextExtras }
}

export function parseExtras(raw: unknown): Record<string, SearchExtras> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: Record<string, SearchExtras> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const entry = value as Record<string, unknown>
    const positive = (input: unknown) => (typeof input === 'number' && Number.isFinite(input) && input > 0 ? input : null)
    result[id] = {
      areaMin: positive(entry.areaMin),
      areaMax: positive(entry.areaMax),
      condition: ['novo', 'usado', 'bom-estado', 'recuperar'].includes(String(entry.condition)) ? (entry.condition as SearchExtras['condition']) : '',
      preferences: typeof entry.preferences === 'string' ? entry.preferences : '',
    }
  }
  return result
}

// O perfil de exemplo que versões anteriores criavam sozinhas ("João", T2, Torres Vedras, até 250 mil).
function isOldSampleProfile(profile: SearchProfile) {
  return profile.name === 'João' && profile.typology === 'T2' && profile.municipality === 'Torres Vedras' && profile.budgetMax === 250000
    && !profile.phone && !profile.preferences && profile.features.length === 0 && profile.areaMin === null && profile.areaMax === null && profile.budgetMin === null
}

// Os perfis da antiga página de procura passam para a carteira: os que já eram de um cliente da carteira só trazem
// os extras; os que eram independentes tornam-se clientes novos. O perfil de exemplo antigo é descartado.
export function migrateSearchProfiles(profiles: SearchProfile[], clients: HistoryClient[]) {
  const extras: Record<string, SearchExtras> = {}
  const created: HistoryClient[] = []
  const known = new Set(clients.map((client) => client.id))

  for (const profile of profiles) {
    if (isOldSampleProfile(profile)) continue
    const hasExtras = profile.areaMin !== null || profile.areaMax !== null || profile.condition !== '' || profile.preferences.trim() !== ''
    if (!known.has(profile.id)) {
      if (!profile.name.trim() && !profile.municipality.trim()) continue
      created.push({
        ...newClient(''),
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        wants: {
          ...emptyWants(),
          propertyTypes: [profile.propertyType],
          typologies: historyTypologies.filter((value) => value === profile.typology),
          district: profile.district,
          municipality: profile.municipality,
          budgetMin: profile.budgetMin,
          budgetMax: profile.budgetMax,
          features: profile.features,
        },
      })
    }
    if (hasExtras) extras[profile.id] = { areaMin: profile.areaMin, areaMax: profile.areaMax, condition: profile.condition, preferences: profile.preferences }
  }
  return { clients: [...clients, ...created], extras, created: created.length }
}

// Se o cliente só procura tipos que os portais não cobrem (terreno, comercial, outro), devolve-os em texto; senão, ''.
export function onlyUnsupportedTypes(wants: ClientWants) {
  if (wants.propertyTypes.includes('apartamento') || wants.propertyTypes.includes('moradia')) return ''
  return wants.propertyTypes.join(' / ')
}
