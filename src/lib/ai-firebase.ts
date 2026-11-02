import { getAI, getGenerativeModel, GoogleAIBackend, type Part } from 'firebase/ai'
import { ApiError, buildAiRequest, type AiPayload } from './ai-requests'
import { firebaseApp } from './firebase'
import { recordAiUsage } from './usage'
import type { UsageKind } from './admin-metrics'

// O mesmo modelo do proxy local (GEMINI_MODEL), mas escolhido no browser através de VITE_AI_MODEL.
const modelName = import.meta.env.VITE_AI_MODEL || 'gemini-3.8-flash'

const usageKinds: Record<string, UsageKind> = {
  '/api/ai/property-report': 'report',
  '/api/ai/property-listing': 'listing',
  '/api/ai/market-comparables': 'market',
}

type AiFailure = { message?: string; code?: string; customErrorData?: { status?: number; errorDetails?: unknown } }

function describeFailure(error: unknown, path: string, fallbackError: string) {
  const failure = (error ?? {}) as AiFailure
  const status = failure.customErrorData?.status ?? null
  const detail = failure.message ?? ''
  console.error(`[firebase-ai] ${failure.code ?? ''} ${status ?? ''} ${detail.slice(0, 300)}`)
  if (status === 429 || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(detail)) {
    return new ApiError(path === '/api/ai/market-comparables'
      ? 'A pesquisa de preços na web não está disponível no plano gratuito do Firebase (precisa do plano Blaze). A análise e o descritivo funcionam sem ela.'
      : 'Limite gratuito da IA atingido. Tenta mais tarde ou ativa o plano Blaze do Firebase.', 429)
  }
  if (status === 401 && /App Check/i.test(detail)) {
    return new ApiError('O App Check bloqueou o pedido. Configura a chave do reCAPTCHA (VITE_APPCHECK_SITE_KEY) ou, para testar, desativa a aplicação do App Check para o Firebase AI Logic na consola.', 401)
  }
  if (status === 403 || /PERMISSION_DENIED|API has not been used|is not enabled|disabled/i.test(detail)) {
    return new ApiError('A IA ainda não está ativa neste projeto. Ativa o Firebase AI Logic na consola do Firebase (Build > AI Logic > Get started).', 403)
  }
  if (status === 404 || /not found|is not supported/i.test(detail)) {
    return new ApiError(`O modelo "${modelName}" não está disponível neste plano. Define VITE_AI_MODEL com outro modelo.`, 404)
  }
  return new ApiError(fallbackError, status)
}

// Mesmo contrato do proxy local: recebe o caminho e o payload, devolve o texto da resposta.
export async function runAiViaFirebase(path: string, payload: AiPayload, fallbackError: string): Promise<string> {
  const request = buildAiRequest(path, payload)
  if (typeof request === 'string') throw new ApiError(request, 400)

  try {
    const model = getGenerativeModel(getAI(firebaseApp(), { backend: new GoogleAIBackend() }), {
      model: modelName,
      systemInstruction: request.system,
      generationConfig: { temperature: request.temperature, ...(request.json ? { responseMimeType: 'application/json' } : {}) },
      ...(request.search ? { tools: [{ googleSearch: {} }] } : {}),
    })
    const parts: Part[] = [{ type: 'text', text: request.text }, ...request.images.map((image): Part => ({ type: 'inlineData', inlineData: { mimeType: image.mimeType, data: image.data } }))]
    // 503 são picos de procura temporários: repete até 2 vezes, como o proxy local.
    let result
    for (let attempt = 0; ; attempt += 1) {
      try {
        result = await model.generateContent(parts)
        break
      } catch (error) {
        if ((error as AiFailure)?.customErrorData?.status !== 503 || attempt >= 2) throw error
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
      }
    }
    const usage = result.response.usageMetadata
    // Os tokens de raciocínio faturam-se como saída.
    recordAiUsage({ kind: usageKinds[path], model: modelName, inputTokens: usage?.promptTokenCount ?? 0, outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0), ok: true })
    const text = result.response.text()
    if (!text) throw new ApiError('O serviço de IA não devolveu conteúdo.', 502)
    return text
  } catch (error) {
    if (error instanceof ApiError) throw error
    recordAiUsage({ kind: usageKinds[path], model: modelName, inputTokens: 0, outputTokens: 0, ok: false })
    throw describeFailure(error, path, fallbackError)
  }
}
