// Instruções e pedidos à IA, partilhados pelo proxy local do Vite (`vite.config.ts`) e pelo Firebase AI Logic (`ai-firebase.ts`),
// para que o texto dos pedidos exista num só sítio. Sem dependências: é lido também pelo Node.

export const maxImages = 4

// Erro de um pedido à IA, com o estado HTTP quando existe.
export class ApiError extends Error {
  status: number | null

  constructor(message: string, status: number | null) {
    super(message)
    this.status = status
  }
}

const baseRules = `És um assistente de apoio a consultores imobiliários em Portugal. Responde apenas em português de Portugal e apenas com JSON no formato pedido.`

export const reportPrompt = `${baseRules}
Recebes as características de um imóvel indicadas pelo consultor, opcionalmente imagens da planta e, opcionalmente, estatísticas de preços da zona obtidas automaticamente na web (não verificadas).
Regras:
- Não inventes áreas, medidas, preços, custos de obras nem valores de mercado, e não calcules o preço do imóvel. Se algo não estiver nos dados ou não for visível, diz que não é possível confirmar.
- Usa as estatísticas da zona apenas para contextualizar (por exemplo, se o preço pedido está acima, dentro ou abaixo do intervalo) e avisa se forem poucas.
- Tudo o que escreveres é uma inferência a rever por um consultor, não um facto.
- Vantagens e desvantagens devem basear-se nas características indicadas e no que a planta mostra (distribuição, circulação, divisões).
- Sugestões de valorização: ações concretas e realistas para o mercado português (por exemplo, certificado energético e eficiência, pintura e pequenas reparações, remodelação de cozinha ou casas de banho, iluminação, arrumação e home staging, fotografia profissional, regularização documental). Indica impacto e esforço de forma qualitativa, sem valores em euros.`

export const reportShape = `Formato JSON:
{
  "summary": "resumo de 2 a 3 frases",
  "typology": "ex.: T3, ou null se não for possível determinar",
  "layoutObservations": ["observações sobre a distribuição (vazio se não houver planta)"],
  "strengths": ["vantagens"],
  "weaknesses": ["desvantagens"],
  "valueSuggestions": [{ "action": "ação concreta", "impact": "alto|medio|baixo", "effort": "alto|medio|baixo", "rationale": "porquê" }],
  "missingInfo": ["informação em falta que melhoraria a análise"],
  "possibleMissedRooms": ["divisões visíveis na planta e não indicadas pelo consultor"],
  "caveats": ["limitações desta análise"]
}`

export const listingPrompt = `És um copywriter imobiliário em Portugal e escreves descritivos para anúncios em portais como o Idealista ou o Imovirtual. Responde apenas em português de Portugal e apenas com JSON no formato pedido.
Regras:
- Usa apenas factos fornecidos (características e notas do consultor). Nunca inventes divisões, acabamentos, vistas, proximidade a serviços, áreas, estado ou equipamentos do imóvel. Se um dado não existe, não o menciones (a única exceção é o parágrafo geral sobre a zona, descrito abaixo).
- Inclui a classificação energética se for fornecida (é obrigatória em anúncios em Portugal).
- Não incluas preço, contactos nem dados pessoais.
- Não faças afirmações de qualidade sem base nos dados fornecidos (por exemplo luminosidade, circulação fluida, silêncio, vistas, acabamentos, "bem desenhado"). Se faltam dados, a descrição fica mais curta em vez de preenchida com generalidades.
- A tipologia indica os quartos (T2 = dois quartos, T3 = três quartos): não a descrevas como "divisões" nem deduzas o número total de divisões, de salas ou de casas de banho além do que foi indicado.
- Evita superlativos vazios e promessas (por exemplo "oportunidade única", "investimento garantido") e linguagem discriminatória.
- Texto pronto a colar: sem marcadores markdown nem emojis na descrição; parágrafos separados por uma linha em branco.
- A descrição deve ser detalhada e completa, usando todos os factos fornecidos. Estrutura sugerida, omitindo o que não tiver dados: apresentação do imóvel (tipo, tipologia, localização, área); características gerais (ano, estado, classificação energética, piso, elevador); distribuição interior apenas se constar das notas; exterior, estacionamento e exposição solar; a zona; fecho que convida a visitar.
- Localização: escreve um parágrafo positivo sobre a zona, usando apenas conhecimento geral, bem conhecido e estável sobre o concelho ou freguesia (por exemplo litoral, clima, tradição, vinhos, acessibilidades principais, serviços típicos de uma localidade deste tipo). Não afirmes distâncias nem tempos de deslocação, nem a existência de lojas, escolas, transportes ou praias específicos junto ao imóvel, a menos que tenham sido fornecidos pelo consultor. Se não conheceres bem a zona, escreve algo breve e genérico em vez de arriscar.`

export const listingShape = `Formato JSON:
{
  "title": "título do anúncio, até 80 caracteres",
  "description": "descrição do anúncio; parágrafos separados por \\n\\n",
  "highlights": ["4 a 6 destaques curtos, só com factos fornecidos"]
}`

const toneInstructions: Record<string, string> = {
  profissional: 'Tom profissional e objetivo. Descrição longa e detalhada: 5 a 8 parágrafos, cerca de 300 a 450 palavras.',
  apelativo: 'Tom caloroso e apelativo, a destacar o conforto e o estilo de vida, mas sem exageros nem factos inventados. Descrição longa e detalhada: 5 a 8 parágrafos, cerca de 300 a 450 palavras.',
  conciso: 'Tom direto e conciso. Descrição curta: 2 a 3 parágrafos, cerca de 100 a 150 palavras.',
}

export const marketPrompt = `Pesquisas na web anúncios e vendas recentes de imóveis semelhantes na zona indicada, em Portugal, para o consultor comparar preços.
Regras:
- Usa apenas dados que encontrares nas páginas pesquisadas. Nunca inventes anúncios, preços, áreas ou ligações.
- Cada item tem de ter preço total em euros, área em m² e a ligação da página onde o viste.
- Procura 6 a 10 imóveis do mesmo tipo e tipologia (ou muito próxima) e da mesma zona. Se não encontrares nenhum, devolve a lista vazia.
- Responde apenas com JSON, sem texto à volta.
Formato JSON:
{ "comparables": [{ "label": "tipologia e rua ou zona", "priceEur": 0, "areaM2": 0, "url": "https://..." }] }`

export type AiImage = { mimeType: string; data: string }

// Pedido já preparado, independente do serviço que o vai enviar.
export type AiRequest = {
  system: string
  text: string
  images: AiImage[]
  json: boolean
  search: boolean
  temperature: number
}

export type AiPayload = { context?: unknown; images?: unknown; tone?: unknown }

export const aiRoutes = ['/api/ai/property-report', '/api/ai/property-listing', '/api/ai/market-comparables'] as const

function validImages(images: unknown): AiImage[] {
  const list = Array.isArray(images) ? images.slice(0, maxImages) : []
  return list.filter((image): image is AiImage =>
    typeof image?.data === 'string' && (image.mimeType === 'image/jpeg' || image.mimeType === 'image/png'))
}

// Devolve o pedido, ou uma mensagem de erro (texto) quando faltam dados.
export function buildAiRequest(path: string, payload: AiPayload): AiRequest | string {
  const context = (limit: number) => typeof payload.context === 'string' ? payload.context.slice(0, limit) : ''

  if (path === '/api/ai/property-report') {
    const text = context(20000)
    const images = validImages(payload.images)
    if (images.length === 0 && !text.trim()) return 'Sem dados do imóvel nem planta para analisar.'
    return {
      system: reportPrompt,
      text: `${text}

${images.length ? 'Seguem imagens da planta.' : 'Não foi fornecida planta.'}

${reportShape}`,
      images,
      json: true,
      search: false,
      temperature: 0.2,
    }
  }

  if (path === '/api/ai/property-listing') {
    const text = context(20000)
    if (!text.trim()) return 'Sem dados do imóvel para o descritivo.'
    const tone = typeof payload.tone === 'string' && payload.tone in toneInstructions ? payload.tone : 'profissional'
    return { system: listingPrompt, text: `${text}

${toneInstructions[tone]}

${listingShape}`, images: [], json: true, search: false, temperature: 0.5 }
  }

  if (path === '/api/ai/market-comparables') {
    const text = context(4000)
    if (!text.trim()) return 'Sem localização para pesquisar.'
    return { system: marketPrompt, text: `Imóvel a comparar:
${text}`, images: [], json: false, search: true, temperature: 0.2 }
  }

  return 'Pedido desconhecido.'
}
