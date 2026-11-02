import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Lock,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react'
import overview from '../assets/landing/visao-geral.webp'
import weeklyPlan from '../assets/landing/plano-semana.webp'
import portfolio from '../assets/landing/carteira.webp'
import messages from '../assets/landing/mensagens.webp'
import clientSearch from '../assets/landing/imovel-cliente.webp'
import agenda from '../assets/landing/agenda.webp'
import { LoopScene, Scene } from './LandingScenes'
import { reducedMotion, sceneTabs, type SceneKind } from './landing-motion'
import './Landing.css'

const highlights: { id: string; kind: SceneKind; eyebrow: string; title: string; text: string; points: string[] }[] = [
  {
    id: 'videos',
    kind: 'video',
    eyebrow: 'VÍDEOS DE IMÓVEIS',
    title: 'Das fotografias do anúncio a um vídeo pronto a partilhar.',
    text: 'Escolhes as fotografias e carregas em gerar. O vídeo é criado no teu browser, com música, legendas e movimento suave.',
    points: [
      'Música ambiente criada na hora, ou a tua própria faixa',
      'Legendas, preço e dados do imóvel no próprio vídeo',
      'Percurso pela planta, divisão a divisão',
      'Opcional: animar as fotografias com IA no Google Flow e juntar os clips. O vídeo leva sempre o aviso "Imagem animada por IA"',
    ],
  },
  {
    id: 'analises',
    kind: 'analise',
    eyebrow: 'ANÁLISES AUTOMÁTICAS',
    title: 'Análises do imóvel geradas por IA, para rever e usar.',
    text: 'Indicas as características e, se quiseres, juntas a planta. A IA prepara o relatório e o texto do anúncio num instante.',
    points: [
      'Resumo, vantagens, desvantagens e o que falta confirmar',
      'Sugestões de valorização com impacto e esforço',
      'Descritivo do anúncio em três tons, pronto a colar nos portais',
    ],
  },
  {
    id: 'acompanhamento',
    kind: 'clientes',
    eyebrow: 'ACOMPANHAMENTO DE CLIENTES',
    title: 'Sabes quem contactar hoje e quem ficou para trás.',
    text: 'O painel junta a carteira, as visitas e as datas de contacto e transforma-os num plano dos próximos 6 dias de trabalho.',
    points: [
      'Tarefas por dia, com prioridade: urgente, esta semana, ou se houver tempo',
      'Mostra que clientes estão fora do prazo de contacto (7, 14 ou 21 dias, conforme a prioridade)',
      'Reserva tempo para procurar novos clientes quando a agenda está livre',
    ],
  },
  {
    id: 'mensagens',
    kind: 'mensagens',
    eyebrow: 'MENSAGENS PRÉ-DEFINIDAS',
    title: 'A mensagem certa escrita em segundos, enviada no WhatsApp.',
    text: 'Escolhes o modelo e o cliente. O nome, o imóvel, o dia e a hora preenchem-se sozinhos. Só é enviada quando carregas em enviar.',
    points: [
      'Modelos para o primeiro contacto, seguimento, novas opções, visitas, pós-visita e clientes sem resposta',
      'Abre o WhatsApp com o texto pronto e regista o contacto na ficha',
      'Guia de pós-venda passo a passo: morada no Cartão de Cidadão, caderneta predial, IMI',
      'Editas os modelos e crias os teus',
    ],
  },
]

const gallery = [
  { src: overview, label: 'Visão geral', alt: 'Visão geral do painel com métricas e agenda' },
  { src: weeklyPlan, label: 'Plano da semana', alt: 'Plano de seis dias de trabalho com tarefas por prioridade' },
  { src: portfolio, label: 'Carteira de clientes', alt: 'Ficha de uma cliente com critérios de procura' },
  { src: messages, label: 'Mensagens padrão', alt: 'Mensagem pronta a enviar no WhatsApp' },
  { src: clientSearch, label: 'Imóvel para cliente', alt: 'Pesquisas nos portais preparadas a partir do perfil do cliente' },
  { src: agenda, label: 'Agenda', alt: 'Agenda semanal com visitas marcadas' },
]

const more = [
  { icon: CalendarDays, title: 'Agenda das visitas', text: 'Visitas por cliente e imóvel, com duração e aviso quando duas se sobrepõem.' },
  { icon: Search, title: 'Imóvel para cliente', text: 'Pesquisas nos portais já preenchidas a partir do que o cliente procura.' },
  { icon: UsersRound, title: 'Carteira de clientes', text: 'Estado, prioridade, orçamento e que imóveis do teu catálogo encaixam.' },
  { icon: ClipboardCheck, title: 'Guia de pós-venda', text: 'Passo a passo para o cliente atualizar a morada, a caderneta e o IMI.' },
]

const ribbon = ['VÍDEOS DE IMÓVEIS', 'ANÁLISES COM IA', 'ACOMPANHAMENTO DE CLIENTES', 'MENSAGENS PARA WHATSAPP', 'PLANO SEMANAL', 'AGENDA DE VISITAS']

const steps = [
  ['01', 'Entra com o Google', 'Sem palavras-passe novas e sem instalar nada. Os teus dados ficam ligados à tua conta.'],
  ['02', 'Regista clientes e imóveis', 'Cria as fichas à medida que trabalhas, ou importa o que já tens do Histórico.'],
  ['03', 'Segue o plano e gera o resto', 'O painel diz-te quem contactar. Vídeos, análises e mensagens saem das fichas que já criaste.'],
]

const trust = [
  { icon: Lock, title: 'Os dados são teus', text: 'Cada conta só acede ao que é seu. Quem administra a plataforma vê contagens de utilização e custos, nunca o conteúdo da tua carteira.' },
  { icon: Sparkles, title: 'A IA propõe, tu decides', text: 'Os textos e análises são rascunhos para rever. A IA é instruída a não inventar áreas, preços ou características do imóvel.' },
  { icon: ShieldCheck, title: 'Transparência no vídeo', text: 'Os clips animados por IA levam sempre o aviso "Imagem animada por IA", para não induzir ninguém em erro sobre o imóvel.' },
]

const questions = [
  ['Preciso de instalar alguma coisa?', 'Não. Funciona no browser. Para exportar vídeos, usa uma versão recente do Chrome ou do Edge.'],
  ['Os vídeos são feitos pela IA?', 'O vídeo é montado no teu browser a partir das tuas fotografias, sem alterar o imóvel. Se quiseres animar as fotografias com IA, isso é feito por ti no Google Flow e depois juntas os clips na app.'],
  ['A app envia mensagens por mim?', 'Não. Abre o WhatsApp com a mensagem escrita, e só é enviada quando carregas em enviar.'],
  ['A IA decide por mim?', 'Não. Gera rascunhos e sugestões que deves rever antes de usar. Dá-te trabalho adiantado, não substitui o teu critério.'],
  ['A app pesquisa nos portais sozinha?', 'Não. Prepara as pesquisas já filtradas e abre-as para as veres. A pesquisa automática de preços da zona depende de a IA conseguir consultar a web e pode não estar disponível.'],
  ['Quem vê os dados dos meus clientes?', 'Só tu, com a tua conta. A administração da plataforma tem acesso a números de utilização (quantos clientes, quantos pedidos à IA) e não ao conteúdo.'],
]

const heroWords = ['Do', 'anúncio', 'ao', 'acompanhamento,']
const playerSeconds = 7
const videoSeconds = 11

function HeroPlayer() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  // O separador do vídeo fica mais tempo, para o visitante ver o resultado.
  const seconds = sceneTabs[active].kind === 'video' ? videoSeconds : playerSeconds

  useEffect(() => {
    if (paused || reducedMotion()) return
    const timer = setTimeout(() => setActive((value) => (value + 1) % sceneTabs.length), seconds * 1000)
    return () => clearTimeout(timer)
  }, [active, paused, seconds])

  return (
    <div className="lp-player" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="lp-player-tabs" role="tablist" aria-label="Destaques do produto">
        {sceneTabs.map(({ kind, label, icon: Icon }, index) => (
          <button key={kind} type="button" role="tab" id={`tab-${kind}`} aria-selected={active === index} aria-controls="player-panel" className={active === index ? 'is-active' : ''} onClick={() => setActive(index)}>
            <Icon size={15} /> <span>{label}</span>
            {active === index && <i key={`${index}-${paused}`} style={{ animationDuration: `${seconds}s`, animationPlayState: paused ? 'paused' : 'running' }} />}
          </button>
        ))}
      </div>
      <div className="lp-window">
        <div className="lp-window-bar" aria-hidden="true"><i /><i /><i /><span>ImoAssistenteAI · ao vivo</span></div>
        <div id="player-panel" role="tabpanel" aria-labelledby={`tab-${sceneTabs[active].kind}`}><Scene key={active} kind={sceneTabs[active].kind} /></div>
      </div>
    </div>
  )
}

// A janela desloca-se um pouco mais devagar do que a página, o que dá profundidade ao fazer scroll.
function Parallax({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [36, -36])
  return <motion.div ref={ref} style={{ y }}>{children}</motion.div>
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  const { scrollYProgress } = useScroll()

  return (
    <main className="lp">
      <motion.div className="lp-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />
      <header className="lp-header">
        <a className="brand" href="#inicio" aria-label="ImoAssistenteAI, início" onClick={closeMenu}>Imo<span>Assistente</span>AI</a>
        <button className="lp-menu-toggle" type="button" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={menuOpen ? 'lp-nav is-open' : 'lp-nav'} aria-label="Navegação principal">
          <a href="#destaques" onClick={closeMenu}>Destaques</a>
          <a href="#painel" onClick={closeMenu}>O painel</a>
          <a href="#como-funciona" onClick={closeMenu}>Como funciona</a>
          <a href="#perguntas" onClick={closeMenu}>Perguntas</a>
          <a className="lp-cta-small" href="/painel" onClick={closeMenu}>Entrar</a>
        </nav>
      </header>

      <section className="lp-hero" id="inicio">
        <div className="lp-orb lp-orb-a" aria-hidden="true" />
        <div className="lp-orb lp-orb-b" aria-hidden="true" />
        <div className="lp-hero-copy">
          <motion.p className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>PARA CONSULTORES IMOBILIÁRIOS</motion.p>
          <h1 aria-label="Do anúncio ao acompanhamento, tudo em movimento.">
            {heroWords.map((word, index) => (
              <motion.span className="lp-word" key={word} aria-hidden="true" initial={{ opacity: 0, y: 28, rotateX: -40 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.6, delay: 0.1 + index * 0.09, ease: [0.2, 0.8, 0.2, 1] }}>{word}&nbsp;</motion.span>
            ))}
            <motion.em className="lp-word" aria-hidden="true" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55 }}>tudo em movimento.</motion.em>
          </h1>
          <motion.p className="lp-lead" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.7 }}>
            Gera vídeos de imóveis, obtém análises automáticas com IA, acompanha cada cliente e envia a mensagem certa em segundos. Tudo no mesmo painel.
          </motion.p>
          <motion.div className="lp-actions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.85 }}>
            <a className="button button-primary lp-glow" href="/painel">Entrar com o Google <ArrowRight size={17} /></a>
            <a className="text-link" href="#destaques">Ver em ação</a>
          </motion.div>
          <p className="lp-fine">Sem instalar nada. Entras com a tua conta Google.</p>
        </div>
        <motion.div className="lp-hero-visual" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
          <HeroPlayer />
        </motion.div>
      </section>

      <div className="lp-ribbon" aria-hidden="true">
        <div className="lp-ribbon-track">
          {[...ribbon, ...ribbon, ...ribbon, ...ribbon].map((item, index) => <span key={`${item}-${index}`}>{item}<i>✦</i></span>)}
        </div>
      </div>

      <section className="lp-section" id="destaques">
        <div className="lp-heading">
          <p className="eyebrow">OS QUATRO DESTAQUES</p>
          <h2>O que a plataforma faz por ti, <em>a acontecer.</em></h2>
          <p>Cada demonstração repete-se enquanto está no ecrã. No painel, são estes os passos reais.</p>
        </div>

        <div className="lp-rows">
          {highlights.map((item, index) => (
            <motion.article className={index % 2 ? 'lp-row is-reversed' : 'lp-row'} key={item.id} id={item.id} initial={{ opacity: 0, y: 34 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.6 }}>
              <div className="lp-row-copy">
                <p className="eyebrow"><span className="lp-index">{String(index + 1).padStart(2, '0')}</span> {item.eyebrow}</p>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <ul>{item.points.map((point) => <li key={point}><Check size={15} /> <span>{point}</span></li>)}</ul>
              </div>
              <Parallax>
                <div className="lp-window lp-row-shot">
                  <div className="lp-window-bar" aria-hidden="true"><i /><i /><i /><span>ImoAssistenteAI · ao vivo</span></div>
                  <LoopScene kind={item.kind} />
                </div>
              </Parallax>
            </motion.article>
          ))}
        </div>
      </section>


      <section className="lp-gallery" id="painel">
        <div className="lp-heading">
          <p className="eyebrow">O PAINEL POR DENTRO</p>
          <h2>Capturas reais, <em>com dados de exemplo.</em></h2>
        </div>
        <div className="lp-gallery-track-wrap">
          <div className="lp-gallery-track">
            {[...gallery, ...gallery].map((shot, index) => (
              <figure className="lp-shot" key={`${shot.label}-${index}`} aria-hidden={index >= gallery.length}>
                <div className="lp-window"><div className="lp-window-bar" aria-hidden="true"><i /><i /><i /></div><img src={shot.src} width={1440} height={900} loading="lazy" alt={index < gallery.length ? shot.alt : ''} /></div>
                <figcaption>{shot.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-more">
        <div className="lp-heading">
          <p className="eyebrow">E AINDA NO PAINEL</p>
          <h2>O resto do dia a dia, <em>também organizado.</em></h2>
        </div>
        <div className="lp-more-grid">
          {more.map(({ icon: Icon, title, text }, index) => (
            <motion.article key={title} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5, delay: index * 0.08 }} whileHover={{ y: -6 }}>
              <Icon size={22} strokeWidth={1.5} />
              <h3>{title}</h3>
              <p>{text}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="lp-steps" id="como-funciona">
        <div className="lp-steps-inner">
          <div className="lp-heading is-left">
            <p className="eyebrow">COMO FUNCIONA</p>
            <h2>Em três passos, <em>sem configurações.</em></h2>
          </div>
          <ol>
            {steps.map(([number, title, text], index) => (
              <motion.li key={number} initial={{ opacity: 0, x: 28 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.6 }} transition={{ duration: 0.5, delay: index * 0.1 }}>
                <span>{number}</span><div><h3>{title}</h3><p>{text}</p></div>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-section" id="seguranca">
        <div className="lp-heading">
          <p className="eyebrow">CONFIANÇA</p>
          <h2>Os teus clientes são teus. <em>E a IA sabe o seu lugar.</em></h2>
        </div>
        <div className="lp-trust">
          {trust.map(({ icon: Icon, title, text }, index) => (
            <motion.article key={title} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5, delay: index * 0.1 }}>
              <Icon size={22} strokeWidth={1.5} /><h3>{title}</h3><p>{text}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="lp-section lp-faq" id="perguntas">
        <div className="lp-heading">
          <p className="eyebrow">PERGUNTAS FREQUENTES</p>
          <h2>O que costumam perguntar.</h2>
        </div>
        <div className="lp-faq-list">
          {questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
        </div>
      </section>

      <section className="lp-final">
        <div className="lp-orb lp-orb-c" aria-hidden="true" />
        <h2>Começa pelo que tens em mãos <em>hoje.</em></h2>
        <p>Entra, cria o teu primeiro cliente e vê o plano da semana a aparecer.</p>
        <a className="button button-primary lp-glow" href="/painel">Entrar com o Google <ArrowRight size={17} /></a>
      </section>

      <footer className="lp-footer">
        <a className="brand" href="#inicio">Imo<span>Assistente</span>AI</a>
        <p><Search size={13} /> Ferramenta de apoio ao consultor. A decisão e a responsabilidade profissional continuam a ser tuas.</p>
        <span>© 2026 IMOASSISTENTEAI</span>
      </footer>
    </main>
  )
}
