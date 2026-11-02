import { z } from 'zod'
import { emptyPropertyDetails, propertyDetailsSchema, storedListingSchema, storedReportSchema, type PropertyWorkspace } from './property-ai'

// Lista das análises feitas (uma por análise ou descritivo gerado), guardada neste browser.

export const maxSavedAnalyses = 100
const storageKey = 'casanexa-analysis-history'

const savedAnalysisSchema = z.object({
  id: z.string().min(1),
  propertyId: z.string(),
  reference: z.string().catch(''),
  title: z.string().catch(''),
  savedAt: z.string(),
  details: propertyDetailsSchema.catch(emptyPropertyDetails),
  report: storedReportSchema.nullable().catch(null),
  listing: storedListingSchema.nullable().catch(null),
})

export type SavedAnalysis = z.infer<typeof savedAnalysisSchema>

/** Lê a lista; o que estiver corrompido é descartado sem perder o resto. */
export function parseSavedAnalyses(raw: unknown): SavedAnalysis[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const parsed = savedAnalysisSchema.safeParse(item)
    return parsed.success && (parsed.data.report || parsed.data.listing) ? [parsed.data] : []
  }).slice(0, maxSavedAnalyses)
}

export function loadSavedAnalyses(): SavedAnalysis[] {
  try {
    return parseSavedAnalyses(JSON.parse(localStorage.getItem(storageKey) ?? '[]'))
  } catch {
    return []
  }
}

export function saveSavedAnalyses(list: SavedAnalysis[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(list))
  } catch {
    // Sem armazenamento disponível: a lista existe só enquanto a página está aberta.
  }
}

type Recorded = { propertyId: string; reference: string; title: string; workspace: PropertyWorkspace; savedAt: string }

/**
 * Regista uma análise ou um descritivo acabados de gerar. Gerar o descritivo, ou a primeira análise, atualiza a entrada
 * que está aberta; gerar uma nova análise quando já havia uma cria uma entrada nova, para ficarem as várias.
 * A entrada mexida passa para o início da lista.
 */
export function recordAnalysis(list: SavedAnalysis[], currentId: string, kind: 'report' | 'listing', input: Recorded, newId: string): { list: SavedAnalysis[]; id: string } {
  const current = list.find((item) => item.id === currentId && item.propertyId === input.propertyId)
  const reuse = current && !(kind === 'report' && current.report)
  const id = reuse ? current.id : newId
  const entry: SavedAnalysis = {
    id,
    propertyId: input.propertyId,
    reference: input.reference,
    title: input.title,
    savedAt: input.savedAt,
    details: input.workspace.details,
    report: input.workspace.report,
    listing: input.workspace.listing,
  }
  return { list: [entry, ...list.filter((item) => item.id !== id)].slice(0, maxSavedAnalyses), id }
}

export function removeSavedAnalysis(list: SavedAnalysis[], id: string) {
  return list.filter((item) => item.id !== id)
}
