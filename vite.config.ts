import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { aiRoutes, buildAiRequest, type AiPayload, type AiRequest } from './src/lib/ai-requests.ts'

const maxBodyBytes = 20 * 1024 * 1024

class UpstreamError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBodyBytes) {
        reject(new Error('Pedido demasiado grande.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

type GeminiCall = {
  apiKey: string
  model: string
  system: string
  parts: unknown[]
  json?: boolean
  tools?: unknown[]
  temperature?: number
}

// Pedido neutro (ai-requests.ts) no formato da Interactions API.
function toGeminiCall(request: AiRequest): Omit<GeminiCall, 'apiKey' | 'model'> {
  return {
    system: request.system,
    parts: [
      { type: 'text', text: request.text },
      ...request.images.map((image) => ({ type: 'image', mime_type: image.mimeType, data: image.data })),
    ],
    json: request.json,
    temperature: request.temperature,
    ...(request.search ? { tools: [{ type: 'google_search' }] } : {}),
  }
}

// Interactions API. `store: false` evita guardar os dados no serviço da Google.
async function callGemini({ apiKey, model, system, parts, json = true, tools, temperature = 0.2 }: GeminiCall) {
  const requestBody = JSON.stringify({
    model,
    system_instruction: system,
    input: [{ type: 'user_input', content: parts }],
    ...(json ? { response_format: { type: 'text', mime_type: 'application/json' } } : {}),
    ...(tools ? { tools } : {}),
    generation_config: { temperature },
    store: false,
  })

  let response: Response
  for (let attempt = 0; ; attempt += 1) {
    response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: requestBody,
    })
    // 503 são picos de procura temporários. Um 429 é quota: repetir não ajuda.
    if (response.status !== 503 || attempt >= 2) break
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null) as { error?: { message?: string; status?: string; code?: string | number } } | null
    const reason = errorBody?.error?.message?.slice(0, 300) ?? ''
    console.error(`[gemini] HTTP ${response.status} (modelo ${model}) ${errorBody?.error?.status ?? errorBody?.error?.code ?? ''} ${reason}`)
    throw new UpstreamError(response.status, reason)
  }

  const data = await response.json() as { steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }
  const text = data.steps
    ?.filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('')
  if (!text) throw new UpstreamError(502, 'O serviço de IA não devolveu conteúdo.')
  return text
}

// Proxy local: a chave GEMINI_API_KEY fica no servidor Vite e nunca chega ao browser.
// Só existe em `vite dev` e `vite preview`; em produção terá de ser uma função de servidor.
function geminiProxy(env: Record<string, string>): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const route = aiRoutes.find((path) => path === req.url)
    if (!route) return next()
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido.' })

    const apiKey = env.GEMINI_API_KEY
    if (!apiKey) return sendJson(res, 503, { error: 'GEMINI_API_KEY não está configurada no ficheiro .env.' })

    try {
      const prepared = buildAiRequest(route, JSON.parse(await readBody(req)) as AiPayload)
      if (typeof prepared === 'string') return sendJson(res, 400, { error: prepared })
      const text = await callGemini({ apiKey, model: env.GEMINI_MODEL || 'gemini-3.8-flash', ...toGeminiCall(prepared) })
      sendJson(res, 200, { text })
    } catch (error) {
      if (error instanceof UpstreamError) {
        const rateLimited = error.message.includes('Rate limit exceeded')
        const message = error.status === 429
          ? rateLimited
            ? `Limite de pedidos do Gemini atingido (plano gratuito). ${error.message}`
            : req.url === '/api/ai/market-comparables'
              ? 'A pesquisa de preços na web não está disponível no plano gratuito do Gemini (precisa de faturação ativa no Google AI Studio). A análise e o descritivo funcionam sem ela.'
              : `Quota da API do Gemini esgotada ou não disponível. Verifica o plano e a faturação da chave no Google AI Studio. ${error.message}`.trim()
          : `O serviço de IA devolveu o erro ${error.status}${error.message ? `: ${error.message}` : '.'}`
        return sendJson(res, 502, { error: message, status: error.status })
      }
      console.error('[gemini]', error instanceof Error ? error.message : error)
      sendJson(res, 500, { error: 'Não foi possível concluir o pedido.' })
    }
  }

  return {
    name: 'gemini-proxy',
    configureServer(server) { server.middlewares.use(handler) },
    configurePreviewServer(server) { server.middlewares.use(handler) },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), geminiProxy(env)],
  }
})
