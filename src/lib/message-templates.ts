import { z } from 'zod'

// Mensagens padrão: textos prontos com campos entre chavetas ({nome}, {imovel}…) que se preenchem com os dados do cliente.

export const placeholderFields = [
  { key: 'nome', label: 'Nome do cliente', fromClient: true },
  { key: 'consultor', label: 'O teu nome', fromClient: false },
  { key: 'imovel', label: 'Imóvel', fromClient: false },
  { key: 'morada', label: 'Morada do imóvel', fromClient: false },
  { key: 'data', label: 'Dia da visita', fromClient: false },
  { key: 'hora', label: 'Hora da visita', fromClient: false },
] as const

export type PlaceholderKey = (typeof placeholderFields)[number]['key']
export type PlaceholderValues = Record<PlaceholderKey, string>

export const templateStorageKey = 'casanexa-message-templates'

export type MessageTemplate = { id: string; title: string; body: string }

const posVenda = [
  'Olá {nome}, parabéns pela casa nova! Para ficar tudo em ordem, deixo-te o passo a passo do que falta tratar.',
  '',
  '*1. Alterar a morada no Cartão de Cidadão*',
  'a) Acede ao serviço no Portal Gov.pt (gov.pt) e procura "Alterar a morada do Cartão de Cidadão".',
  'b) Autentica-te com a Chave Móvel Digital ou com o leitor do Cartão de Cidadão.',
  'c) Preenche e confirma os dados da nova morada. É gratuito.',
  'd) Vais receber uma carta por correio, na nova morada, com os códigos de confirmação (normalmente em 5 dias úteis).',
  'e) Termina o processo inserindo esses códigos online no portal, em "Confirmar a alteração de morada do Cartão de Cidadão": autentica-te outra vez, confirma o número do processo e a morada e escreve os códigos da carta.',
  'Só depois do passo e) é que a morada muda mesmo, por isso não te esqueças dele (há um prazo; está indicado na carta). Se a carta não chegar, liga ao IRN (210 990 111) ou escreve para cartaodecidadao@irn.mj.pt. Também podes fazer tudo presencialmente num Espaço Cidadão.',
  '',
  '*2. Pôr o teu nome na caderneta predial*',
  'a) Entra em portaldasfinancas.gov.pt com o NIF e a senha.',
  'b) Abre o e-Balcão (no menu de atendimento do Portal) e cria um novo pedido sobre IMI / imóveis, para atualizar o titular da caderneta predial.',
  'c) Na descrição escreve, por exemplo: "Pedido de atualização do titular da caderneta predial do artigo matricial ___, da freguesia de ___, por compra em __/__/____. Segue a escritura em anexo."',
  'd) Anexa a escritura em PDF (a cópia que o notário te enviou ou uma digitalização) e submete o pedido. Guarda o comprovativo.',
  'e) Passados uns dias, entra no Portal, consulta a caderneta predial do imóvel e confirma que já aparece o teu nome. As conservatórias só comunicam a compra às Finanças a partir do 1.º dia útil do mês seguinte à escritura, por isso pode demorar um pouco.',
  'Se o e-Balcão não te deixar submeter, entrega a declaração Modelo 1 do IMI (no Portal, em IMI > Entregar declaração) ou vai ao Serviço de Finanças com a escritura.',
  '',
  '*3. Isenção de IMI*',
  'Se a casa for a tua habitação própria e permanente, tens direito a isenção temporária de IMI. Costuma ser atribuída automaticamente depois de a morada fiscal e a caderneta estarem atualizadas; se não a vires, pede-a no Portal das Finanças em Todos os serviços > IMI > Submeter pedido de isenção, com o motivo "Habitação própria permanente". Os limites do valor da casa e os prazos mudam, por isso confirma-os no Portal.',
  '',
  '*4. Moradas*',
  'Atualiza a morada nos bancos, no livrete do carro, no centro de saúde, nos seguros e nos contratos de luz, água, gás e internet.',
  '',
  '*5. Recomendações*',
  'Se algum amigo ou familiar quiser comprar ou vender casa, passa-lhe o meu contacto. Fico muito agradecido!',
  '',
  'Qualquer dúvida, diz-me. {consultor}',
].join('\n')

export const defaultTemplates: MessageTemplate[] = [
  {
    id: 'primeiro-contacto',
    title: 'Primeiro contacto',
    body: 'Olá {nome}, é o {consultor}, consultor imobiliário. Vi que estás à procura de casa e gostava de perceber melhor o que procuras (zona, orçamento e prazo). Quando é que te dá jeito falarmos 5 minutos?',
  },
  {
    id: 'seguimento',
    title: 'Seguimento da procura',
    body: 'Olá {nome}, como vai a procura de casa? Há algum tempo que não falamos e quis saber se continuas interessado. Se quiseres, atualizo a pesquisa com o que fomos aprendendo e envio-te novas opções. Um abraço, {consultor}.',
  },
  {
    id: 'novas-opcoes',
    title: 'Novas opções de imóveis',
    body: 'Olá {nome}, surgiram novos imóveis que encaixam no que procuras. Posso enviar-te as ligações e, se algum te interessar, marcamos logo uma visita. Diz-me o que preferes. {consultor}',
  },
  {
    id: 'confirmar-visita',
    title: 'Confirmar visita',
    body: 'Olá {nome}, a confirmar a nossa visita a {imovel}, {data} às {hora}. Morada: {morada}. Se surgir algum imprevisto, avisa-me com antecedência para reagendarmos. Até lá! {consultor}',
  },
  {
    id: 'lembrar-visita',
    title: 'Lembrar a visita de amanhã',
    body: 'Olá {nome}, só para lembrar a visita de amanhã a {imovel}, às {hora}. Encontramo-nos em {morada}. Qualquer coisa, diz-me. {consultor}',
  },
  {
    id: 'agradecer-visita',
    title: 'Depois da visita',
    body: 'Olá {nome}, obrigado pela visita a {imovel}. O que achaste? Do que gostaste mais e do que gostaste menos? Isso ajuda-me a afinar as próximas opções. {consultor}',
  },
  {
    id: 'sem-resposta',
    title: 'Sem resposta',
    body: 'Olá {nome}, tentei falar contigo mas não consegui. Ainda estás à procura de casa? Se mudaste de planos, diz-me sem problema. Se não, quando te dá jeito falarmos? {consultor}',
  },
  {
    id: 'pos-venda',
    title: 'Pós-venda: passos depois da compra',
    body: posVenda,
  },
]

const templateSchema = z.object({ id: z.string().min(1), title: z.string().catch(''), body: z.string().catch('') })

/** Lê os modelos guardados. Sem nada válido, devolve os de origem. */
export function parseTemplates(raw: unknown): MessageTemplate[] {
  if (!Array.isArray(raw)) return defaultTemplates
  const list = raw.flatMap((item) => {
    const parsed = templateSchema.safeParse(item)
    return parsed.success && (parsed.data.title.trim() || parsed.data.body.trim()) ? [parsed.data] : []
  })
  return list.length > 0 ? list : defaultTemplates
}

// Textos de origem antigos: quem nunca os alterou passa a ter o novo.
const posVendaV3 = [
  'Olá {nome}, parabéns pela casa nova! Para ficar tudo em ordem, deixo-te o passo a passo do que falta tratar.',
  '',
  '*1. Alterar a morada no Cartão de Cidadão*',
  'a) Vai a eportugal.gov.pt e procura "Alterar a morada do Cartão de Cidadão".',
  'b) Escolhe a opção online e autentica-te com a Chave Móvel Digital (ou com o Cartão de Cidadão).',
  'c) O formulário aparece pré-preenchido: escreve a nova morada completa e submete. É gratuito.',
  'd) Vais receber uma carta na nova morada, normalmente em 5 dias úteis, com um código de confirmação.',
  'e) Quando a carta chegar, volta ao eportugal.gov.pt, procura "Confirmar a alteração de morada do Cartão de Cidadão", autentica-te outra vez, confirma o número do processo e a morada e escreve o código da carta.',
  'Só depois do passo e) é que a morada muda mesmo, por isso não te esqueças dele (há um prazo; está indicado na carta). Se a carta não chegar, liga ao IRN (210 990 111) ou escreve para cartaodecidadao@irn.mj.pt. Também podes fazer tudo presencialmente num Espaço Cidadão.',
  '',
  '*2. Pôr o teu nome na caderneta predial*',
  'a) Entra em portaldasfinancas.gov.pt com o NIF e a senha.',
  'b) Abre o e-Balcão (no menu de atendimento do Portal) e cria um novo pedido sobre IMI / imóveis, para atualizar o titular da caderneta predial.',
  'c) Na descrição escreve, por exemplo: "Pedido de atualização do titular da caderneta predial do artigo matricial ___, da freguesia de ___, por compra em __/__/____. Segue a escritura em anexo."',
  'd) Anexa a escritura em PDF (a cópia que o notário te enviou ou uma digitalização) e submete o pedido. Guarda o comprovativo.',
  'e) Passados uns dias, entra no Portal, consulta a caderneta predial do imóvel e confirma que já aparece o teu nome. As conservatórias só comunicam a compra às Finanças a partir do 1.º dia útil do mês seguinte à escritura, por isso pode demorar um pouco.',
  'Se o e-Balcão não te deixar submeter, entrega a declaração Modelo 1 do IMI (no Portal, em IMI > Entregar declaração) ou vai ao Serviço de Finanças com a escritura.',
  '',
  '*3. Isenção de IMI*',
  'Se a casa for a tua habitação própria e permanente, tens direito a isenção temporária de IMI. Costuma ser atribuída automaticamente depois de a morada fiscal e a caderneta estarem atualizadas; se não a vires, pede-a no Portal das Finanças em Todos os serviços > IMI > Submeter pedido de isenção, com o motivo "Habitação própria permanente". Os limites do valor da casa e os prazos mudam, por isso confirma-os no Portal.',
  '',
  '*4. Moradas*',
  'Atualiza a morada nos bancos, no livrete do carro, no centro de saúde, nos seguros e nos contratos de luz, água, gás e internet.',
  '',
  '*5. Recomendações*',
  'Se algum amigo ou familiar quiser comprar ou vender casa, passa-lhe o meu contacto. Fico muito agradecido!',
  '',
  'Qualquer dúvida, diz-me. {consultor}',
].join('\n')

const posVendaV2 = [
      'Olá {nome}, parabéns pela casa nova! Para ficar tudo em ordem, deixo-te os próximos passos.',
      '',
      '*1. Morada no Cartão de Cidadão*',
      'Atualiza a morada em cartaodecidadao.pt (com a Chave Móvel Digital ou com o leitor de cartões e o PIN) ou numa Loja do Cidadão. Normalmente isto atualiza também a tua morada fiscal.',
      '',
      '*2. Nome na caderneta predial*',
      'Entra no Portal das Finanças (portaldasfinancas.gov.pt) com o NIF e a senha, abre o e-Balcão e submete um pedido para alterar o titular da caderneta predial. Anexa a escritura em PDF (a cópia que o notário te enviou ou uma digitalização) e indica o imóvel pelo artigo matricial.',
      '',
      '*3. Isenção de IMI*',
      'No mesmo e-Balcão, pede a isenção de IMI, se tiveres direito (habitação própria e permanente, dentro dos limites do valor patrimonial). Se pedirem, anexa a escritura.',
      '',
      '*4. Moradas*',
      'Atualiza a morada nos bancos, no livrete do carro, no centro de saúde, nos seguros e nos contratos de luz, água, gás e internet.',
      '',
      '*5. Recomendações*',
      'Se algum amigo ou familiar quiser comprar ou vender casa, passa-lhe o meu contacto. Fico muito agradecido!',
      '',
      'Qualquer dúvida, diz-me. {consultor}',
    ].join('\n')

const previousDefaults: Record<string, string[]> = {
  'pos-venda': [
    'Olá {nome}, espero que estejas a gostar da casa nova! Se conheceres alguém que esteja a comprar ou a vender, ficaria muito agradecido se me recomendasses. Um abraço, {consultor}.',
    posVendaV2,
    posVendaV3,
  ],
}

export function upgradeTemplates(templates: MessageTemplate[]) {
  return templates.map((template) => {
    const current = defaultTemplates.find((item) => item.id === template.id)
    return current && previousDefaults[template.id]?.includes(template.body) ? { ...template, title: current.title, body: current.body } : template
  })
}

export function loadTemplates(): MessageTemplate[] {
  try {
    return upgradeTemplates(parseTemplates(JSON.parse(localStorage.getItem(templateStorageKey) ?? 'null')))
  } catch {
    return defaultTemplates
  }
}

export function saveTemplates(templates: MessageTemplate[]) {
  try {
    localStorage.setItem(templateStorageKey, JSON.stringify(templates))
  } catch {
    // Sem armazenamento, as alterações valem só até fechar a página.
  }
}

const placeholderPattern = /\{([a-z]+)\}/g
const knownKeys = new Set<string>(placeholderFields.map((field) => field.key))

/** Campos conhecidos que o texto usa, pela ordem em que aparecem e sem repetir. */
export function placeholdersIn(body: string): PlaceholderKey[] {
  const found: PlaceholderKey[] = []
  for (const match of body.matchAll(placeholderPattern)) {
    const key = match[1]
    if (knownKeys.has(key) && !found.includes(key as PlaceholderKey)) found.push(key as PlaceholderKey)
  }
  return found
}

/** Troca os campos pelos valores. O que estiver por preencher fica como {campo}, para se ver que falta. */
export function fillTemplate(body: string, values: Partial<PlaceholderValues>) {
  return body.replace(placeholderPattern, (whole, key: string) => {
    const value = knownKeys.has(key) ? values[key as PlaceholderKey]?.trim() : ''
    return value || whole
  })
}

/** Campos que o texto usa e ainda não têm valor. */
export function missingFields(body: string, values: Partial<PlaceholderValues>) {
  return placeholdersIn(body).filter((key) => !values[key]?.trim())
}

const weekdayDate = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

/** "2026-10-30" -> "sexta-feira, 30 de outubro". */
export function describeDay(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? weekdayDate.format(new Date(`${date}T12:00:00`)) : ''
}

export function newTemplate(): MessageTemplate {
  return { id: crypto.randomUUID(), title: 'Novo modelo', body: 'Olá {nome}, ' }
}
