import { useEffect, useRef, useState } from 'react'
import { useInView } from 'motion/react'
import { Check, CalendarCheck, MessageCircle, Music2, Play, TriangleAlert } from 'lucide-react'
import livingRoom from '../assets/landing/foto-sala-1.jpg'
import staircase from '../assets/landing/foto-sala-2.jpg'
import kitchen from '../assets/landing/foto-cozinha.jpg'
import exterior from '../assets/landing/foto-exterior.jpg'
import { reducedMotion, type SceneKind } from './landing-motion'
import './LandingScenes.css'

// Fotografias de exemplo (Unsplash), guardadas no projeto para não dependerem de um serviço externo.
const photos = [
  { src: livingRoom, position: '70% 50%' },
  { src: kitchen, position: '50% 50%' },
  { src: staircase, position: '30% 50%' },
  { src: exterior, position: '50% 60%' },
]

// Os primeiros 2 segundos do clip têm uma legenda sem sentido gerada pela IA: a demonstração começa depois dela.
const videoStartAt = 2.4

// Cada palavra entra com um pequeno atraso, para dar a ideia de texto a ser escrito.
function Typed({ text, start, step = 0.07 }: { text: string; start: number; step?: number }) {
  return <>{text.split(' ').map((word, index) => <span className="sc-word" style={{ animationDelay: `${start + index * step}s` }} key={`${word}-${index}`}>{word} </span>)}</>
}

function VideoScene() {
  return (
    <div className="sc sc-video">
      <div className="sc-photos">
        {photos.map(({ src, position }, index) => (
          <figure style={{ animationDelay: `${index * 0.22}s` }} key={src}>
            <img src={src} alt="" style={{ objectPosition: position }} />
            <span>{String(index + 1).padStart(2, '0')}</span>
          </figure>
        ))}
      </div>
      <div className="sc-chips">
        <span><Music2 size={12} /> Piano suave</span>
        <span>Legendas</span>
        <span>Movimento suave</span>
      </div>
      <div className="sc-action">
        <button className="sc-btn is-press" type="button" tabIndex={-1} aria-hidden="true"><Play size={13} /> Gerar vídeo</button>
        <div className="sc-progress" aria-hidden="true"><span /><b className="sc-pct" /></div>
      </div>
      <div className="sc-result">
        <video
          src="/videos/exemplo-imovel.mp4"
          muted
          autoPlay
          playsInline
          preload="auto"
          aria-label="Vídeo de exemplo gerado a partir das fotografias"
          onLoadedMetadata={(event) => { event.currentTarget.currentTime = videoStartAt }}
          onEnded={(event) => { event.currentTarget.currentTime = videoStartAt; void event.currentTarget.play().catch(() => undefined) }}
        />
        <span className="sc-ready"><Check size={12} /> Vídeo pronto · imagem animada por IA</span>
      </div>
    </div>
  )
}

function AnaliseScene() {
  return (
    <div className="sc sc-analise">
      <div className="sc-chips"><span>T2</span><span>Oeiras</span><span>85 m²</span><span>Classe energética C</span></div>
      <div className="sc-thinking"><i /><i /><i /> A gerar a análise</div>
      <div className="sc-block" style={{ animationDelay: '1.1s' }}>
        <h4>Resumo</h4>
        <p><Typed text="Apartamento T2 com varanda e garagem, em zona bem servida de transportes." start={1.3} step={0.06} /></p>
      </div>
      <div className="sc-block sc-two" style={{ animationDelay: '2.3s' }}>
        <div><h4>Vantagens</h4><p className="sc-line is-good"><Check size={13} /> Garagem incluída</p><p className="sc-line is-good"><Check size={13} /> Exposição solar a sul</p></div>
        <div><h4>A rever</h4><p className="sc-line is-warn"><TriangleAlert size={13} /> Cozinha por atualizar</p><p className="sc-line is-warn"><TriangleAlert size={13} /> Falta a área da varanda</p></div>
      </div>
      <div className="sc-block sc-tip" style={{ animationDelay: '3.2s' }}>
        <h4>Sugestão de valorização</h4>
        <p>Pintura e home staging antes das fotografias.</p>
        <div className="sc-chips"><span>Impacto alto</span><span>Esforço baixo</span></div>
      </div>
      <p className="sc-note" style={{ animationDelay: '3.8s' }}>Rascunho gerado por IA, para rever.</p>
    </div>
  )
}

function ClientesScene() {
  const rows = [
    { name: 'Ana Ferreira', before: 'Follow-up em atraso', after: 'Contactada hoje', delay: 1.6 },
    { name: 'Marta Lopes', before: 'Sem contacto há 21 dias', after: 'Contactada hoje', delay: 2.6 },
    { name: 'Rui Santos', before: '', after: 'Visita quinta às 10:00', delay: 0, plain: true },
    { name: 'Carlos Mendes', before: '', after: 'Próximo contacto a 5/11', delay: 0, plain: true },
  ]
  return (
    <div className="sc sc-clientes">
      <div className="sc-head"><strong>Os clientes estão a ser bem acompanhados?</strong></div>
      <div className="sc-meter"><div className="sc-progress is-slim"><span /></div><small>Contactados dentro do prazo</small></div>
      <ul className="sc-clients">
        {rows.map((row, index) => (
          <li style={{ animationDelay: `${index * 0.18}s` }} key={row.name}>
            <span className="sc-avatar">{row.name.split(' ').map((part) => part[0]).join('')}</span>
            <strong>{row.name}</strong>
            {row.plain
              ? <span className="sc-pill is-neutral"><CalendarCheck size={12} /> {row.after}</span>
              : <span className="sc-swap" style={{ ['--d' as string]: `${row.delay}s` }}><span className="sc-pill is-warn"><TriangleAlert size={12} /> {row.before}</span><span className="sc-pill is-good"><Check size={12} /> {row.after}</span></span>}
          </li>
        ))}
      </ul>
      <div className="sc-days">
        <span>Quinta<b>3</b></span><span>Sexta<b>1</b></span><span>Segunda<b>2</b></span><span>Terça<b>2</b></span>
        <small>tarefas por dia</small>
      </div>
    </div>
  )
}

function MensagensScene() {
  return (
    <div className="sc sc-mensagens">
      <div className="sc-templates">
        {['Primeiro contacto', 'Seguimento da procura', 'Confirmar visita'].map((title, index) => (
          <span className={index === 1 ? 'is-active' : ''} style={{ animationDelay: `${index * 0.15}s` }} key={title}>{title}</span>
        ))}
      </div>
      <div className="sc-to"><span className="sc-avatar">AF</span><div><strong>Ana Ferreira</strong><small>912 000 000</small></div></div>
      <div className="sc-bubble">
        <p><Typed text="Olá Ana, como vai a procura de casa? Há alguns dias que não falamos." start={0.9} step={0.075} /></p>
        <p><Typed text="Surgiram duas opções em Oeiras dentro do teu orçamento. Queres ver?" start={2.6} step={0.075} /></p>
      </div>
      <div className="sc-send">
        <button className="sc-btn is-send" type="button" tabIndex={-1} aria-hidden="true"><MessageCircle size={13} /> Enviar no WhatsApp</button>
        <span className="sc-logged"><Check size={13} /> Contacto registado na ficha</span>
      </div>
    </div>
  )
}

export function Scene({ kind }: { kind: SceneKind }) {
  if (kind === 'video') return <VideoScene />
  if (kind === 'analise') return <AnaliseScene />
  if (kind === 'clientes') return <ClientesScene />
  return <MensagensScene />
}

// Repete a animação enquanto a cena está visível. Fora do ecrã, ou com movimento reduzido, fica parada no estado final.
export function LoopScene({ kind, every = kind === 'video' ? 11000 : 9000 }: { kind: SceneKind; every?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { amount: 0.4 })
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (!visible || reducedMotion()) return
    const timer = setInterval(() => setRound((value) => value + 1), every)
    return () => clearInterval(timer)
  }, [visible, every])

  return <div ref={ref}><Scene key={`${visible}-${round}`} kind={kind} /></div>
}
