import type { HistoryClient } from './history'

export type MatchableProperty = { zone: string; typology: string; price: number }

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function clientZones(client: HistoryClient) {
  return [client.wants.municipality, ...client.wants.otherZones.split(',')].map(normalize).filter((zone) => zone.length >= 3)
}

function typologyMatches(clientTypology: string, propertyTypology: string) {
  if (clientTypology === propertyTypology) return true
  // "T4+" nos imóveis cobre T4, T5 e T6+.
  return propertyTypology === 'T4+' && ['T4', 'T5', 'T6+'].includes(clientTypology)
}

// Que clientes da carteira (ainda à procura) encaixam num imóvel. Se o cliente indicou zona, o imóvel tem de estar nela.
// Zona vale 40 pontos, tipologia 30 (10 se o cliente não indicou) e orçamento 30 (15 se ultrapassa até 10%).
export function matchClients(property: MatchableProperty, clients: HistoryClient[], limit = 3) {
  const propertyZone = normalize(property.zone)
  const matches: Array<{ client: HistoryClient; score: number }> = []

  for (const client of clients) {
    if (client.status !== 'procura') continue
    const { wants } = client
    const zones = clientZones(client)
    let score = 0

    if (zones.length > 0) {
      const inZone = propertyZone.length >= 3 && zones.some((zone) => zone.includes(propertyZone) || propertyZone.includes(zone))
      if (!inZone) continue
      score += 40
    }

    if (wants.typologies.length > 0) {
      if (wants.typologies.some((typology) => typologyMatches(typology, property.typology))) score += 30
    } else {
      score += 10
    }

    const max = wants.budgetMax
    if (max !== null) {
      if (property.price <= max) score += 30
      else if (property.price <= max * 1.1) score += 15
    }

    if (score >= 60) matches.push({ client, score })
  }
  return matches.sort((a, b) => b.score - a.score || a.client.name.localeCompare(b.client.name, 'pt')).slice(0, limit)
}
