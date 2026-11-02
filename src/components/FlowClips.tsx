import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowDown, ArrowUp, Check, Copy, Download, ExternalLink, Film, Loader2, Trash2, Upload, X } from 'lucide-react'
import { joinClips, type JoinOverlay, type JoinMusic } from '../lib/join-clips'
import { openInPopup, shouldUsePopup } from '../lib/popup'
import { makeZip } from '../lib/zip'
import './FlowClips.css'

type FlowPhoto = { file: File; caption: string }
type Clip = { id: string; file: File; url: string; caption: string; duration: number }

type FlowClipsProps = {
  photos: FlowPhoto[]
  overlay: JoinOverlay
  music: JoinMusic
}

const flowUrl = 'https://flow.google.com'
const suggestedPrompt = 'Anima esta fotografia com um movimento de câmara lento e suave. Não alteres a divisão, os móveis, as cores nem a luz, e não acrescentes pessoas ou objetos.'

function slug(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}

function extension(file: File) {
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(file.name)?.[1]
  return (fromName ?? file.type.split('/')[1] ?? 'jpg').toLowerCase()
}

function readDuration(url: string) {
  return new Promise<number>((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? video.duration : 8)
    video.onerror = () => resolve(0)
    video.src = url
  })
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Fluxo com o Google Flow: o Flow não pode ser aberto dentro da app (bloqueia iframes), por isso a app prepara as fotografias,
// recebe os clips que o consultor gerou lá e junta-os num único vídeo com legendas e música.
export default function FlowClips({ photos, overlay, music }: FlowClipsProps) {
  const [clips, setClips] = useState<Clip[]>([])
  const [zipping, setZipping] = useState(false)
  const [joining, setJoining] = useState(false)
  const [progress, setProgress] = useState(0)
  const [resultUrl, setResultUrl] = useState('')
  const [resultFormat, setResultFormat] = useState<'MP4' | 'WebM'>('MP4')
  const [status, setStatus] = useState('')
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const clipUrls = useRef<string[]>([])

  useEffect(() => () => clipUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])
  useEffect(() => {
    if (!resultUrl) return
    return () => URL.revokeObjectURL(resultUrl)
  }, [resultUrl])

  function clearResult() {
    setResultUrl('')
    setProgress(0)
  }

  async function downloadPhotos() {
    setZipping(true)
    try {
      const entries = await Promise.all(photos.map(async (photo, index) => {
        const label = slug(photo.caption)
        const name = `${String(index + 1).padStart(2, '0')}${label ? `-${label}` : ''}.${extension(photo.file)}`
        return { name, data: new Uint8Array(await photo.file.arrayBuffer()) }
      }))
      saveBlob(makeZip(entries), `${slug(overlay.reference) || 'imovel'}-fotos-para-flow.zip`)
      return true
    } catch {
      setStatus('Não foi possível preparar as fotografias.')
      return false
    } finally {
      setZipping(false)
    }
  }

  // O Flow não aceita instrução nem imagens por endereço, por isso um só clique deixa tudo pronto: a instrução fica na área de
  // transferência (Ctrl+V no Flow), as fotografias vão para as Transferências e o Flow abre ao lado.
  async function prepareAndOpen() {
    setStatus('')
    // A cópia tem de começar antes de a janela do Flow tirar o foco a esta página.
    const copying = navigator.clipboard.writeText(suggestedPrompt)
    openInPopup(flowUrl)
    const [copiedOk, photosOk] = await Promise.all([copying.then(() => true, () => false), photos.length ? downloadPhotos() : Promise.resolve(false)])
    setCopied(copiedOk)
    setStatus([
      copiedOk ? 'Instrução copiada: no Flow, cola-a com Ctrl+V.' : 'Não foi possível copiar a instrução: usa o botão de copiar no passo 2.',
      photosOk ? 'As fotografias ficaram descarregadas no ZIP: extrai-o e arrasta as imagens para o Flow.' : '',
    ].filter(Boolean).join(' '))
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(suggestedPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setStatus('Não foi possível copiar. Seleciona o texto e copia-o manualmente.')
    }
  }

  async function addClips(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []).filter((file) => file.type.startsWith('video/'))
    event.currentTarget.value = ''
    if (!files.length) {
      setStatus('Escolhe os ficheiros de vídeo que descarregaste do Flow.')
      return
    }
    clearResult()
    setStatus('')
    const additions = await Promise.all(files.map(async (file) => {
      const url = URL.createObjectURL(file)
      clipUrls.current.push(url)
      return { id: crypto.randomUUID(), file, url, caption: '', duration: await readDuration(url) }
    }))
    setClips((current) => [...current, ...additions])
  }

  function moveClip(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= clips.length) return
    clearResult()
    setClips((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function removeClip(id: string) {
    const clip = clips.find((item) => item.id === id)
    if (!clip) return
    URL.revokeObjectURL(clip.url)
    clipUrls.current = clipUrls.current.filter((url) => url !== clip.url)
    clearResult()
    setClips((current) => current.filter((item) => item.id !== id))
  }

  async function join() {
    if (!clips.length || joining) return
    setJoining(true)
    setProgress(0)
    setStatus('A juntar os clips no teu browser…')
    clearResult()
    try {
      const blob = await joinClips(clips, overlay, music, setProgress)
      setResultUrl(URL.createObjectURL(blob))
      setResultFormat(blob.type.startsWith('video/mp4') ? 'MP4' : 'WebM')
      setStatus('Vídeo pronto. Tem o aviso "Imagem animada por IA".')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível juntar os clips.')
    } finally {
      setJoining(false)
    }
  }

  const totalSeconds = Math.round(clips.reduce((sum, clip) => sum + clip.duration, 0))

  return (
    <section className="flow-clips dash-panel" aria-label="Clips do Google Flow">
      <div className="studio-photos-heading">
        <div><span className="eyebrow">GOOGLE FLOW · IA</span><h3>Anima as fotografias com o Flow</h3></div>
        <span className="studio-floorplan-duration"><Film size={14} /> Opcional</span>
      </div>
      <p className="flow-intro">O Flow abre numa janela ao lado da app, porque a Google não permite mostrá-lo dentro de outras páginas. Segue os 3 passos e volta aqui para juntar o resultado.</p>

      <ol className="flow-steps">
        <li>
          <span className="flow-step-number">1</span>
          <div>
            <strong>Leva as fotografias para o Flow</strong>
            <small>{photos.length ? `${photos.length} ${photos.length === 1 ? 'fotografia' : 'fotografias'}, pela ordem da sequência.` : 'Adiciona primeiro as fotografias do imóvel, acima.'}</small>
            <div className="flow-actions">
              <button className="dash-button primary" type="button" disabled={zipping} onClick={prepareAndOpen} title="Copia a instrução, descarrega as fotografias e abre o Flow ao lado da app"><ExternalLink size={14} /> Preparar e abrir o Flow</button>
              <button className="dash-button" type="button" disabled={!photos.length || zipping} onClick={() => { setStatus(''); void downloadPhotos() }}>{zipping ? <Loader2 className="studio-spinner" size={14} /> : <Download size={14} />} Só descarregar fotografias (ZIP)</button>
              <a className="dash-button" href={flowUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (shouldUsePopup(event)) { event.preventDefault(); openInPopup(flowUrl) } }}>Só abrir o Flow</a>
            </div>
          </div>
        </li>
        <li>
          <span className="flow-step-number">2</span>
          <div>
            <strong>No Flow, gera um clip por fotografia</strong>
            <small>Usa cada fotografia como imagem inicial e descarrega os vídeos. Sugestão de instrução, para o movimento não alterar o imóvel:</small>
            <div className="flow-prompt"><span>{suggestedPrompt}</span><button className="icon-button" type="button" aria-label="Copiar instrução" title="Copiar instrução" onClick={copyPrompt}>{copied ? <Check size={14} /> : <Copy size={14} />}</button></div>
          </div>
        </li>
        <li>
          <span className="flow-step-number">3</span>
          <div>
            <strong>Traz os clips de volta</strong>
            <small>Escolhe os ficheiros descarregados (vários de uma vez). A app junta-os com legendas, música e a marca.</small>
            <input ref={input} className="studio-file-input" type="file" accept="video/*" multiple onChange={addClips} aria-label="Escolher clips do Flow" />
            <div className="flow-actions"><button className="dash-button" type="button" onClick={() => input.current?.click()}><Upload size={14} /> Adicionar clips</button></div>
          </div>
        </li>
      </ol>

      {clips.length > 0 && <>
        <div className="flow-clip-list">{clips.map((clip, index) => <article className="flow-clip" key={clip.id}>
          <video src={clip.url} muted playsInline preload="metadata" aria-label={`Clip ${index + 1}`} />
          <div className="studio-photo-edit">
            <label htmlFor={`flow-caption-${clip.id}`}>Legenda do clip {String(index + 1).padStart(2, '0')} · {clip.duration ? `${clip.duration.toFixed(1)}s` : 'duração desconhecida'}</label>
            <input id={`flow-caption-${clip.id}`} value={clip.caption} maxLength={90} placeholder="Ex.: Sala ampla com luz natural" onChange={(event) => { clearResult(); setClips((current) => current.map((item) => item.id === clip.id ? { ...item, caption: event.target.value } : item)) }} />
          </div>
          <div className="studio-photo-controls">
            <button className="icon-button" type="button" aria-label={`Mover clip ${index + 1} para cima`} title="Mover para cima" disabled={index === 0} onClick={() => moveClip(index, -1)}><ArrowUp size={15} /></button>
            <button className="icon-button" type="button" aria-label={`Mover clip ${index + 1} para baixo`} title="Mover para baixo" disabled={index === clips.length - 1} onClick={() => moveClip(index, 1)}><ArrowDown size={15} /></button>
            <button className="icon-button studio-remove-photo" type="button" aria-label={`Remover clip ${index + 1}`} title="Remover clip" onClick={() => removeClip(clip.id)}><X size={15} /></button>
          </div>
        </article>)}</div>
        <p className="studio-photo-note">O som original dos clips é retirado. O vídeo final usa a música escolhida nas definições ao lado e fica com o aviso "Imagem animada por IA". Duração total: {totalSeconds}s.</p>
        <div className="flow-actions">
          <button className="dash-button primary" type="button" disabled={joining} onClick={join}>{joining ? <><Loader2 className="studio-spinner" size={14} /> A juntar {progress}%</> : <><Film size={14} /> Juntar clips em vídeo</>}</button>
          <button className="dash-button" type="button" disabled={joining} onClick={() => { clipUrls.current.forEach((url) => URL.revokeObjectURL(url)); clipUrls.current = []; clearResult(); setClips([]) }}><Trash2 size={14} /> Limpar clips</button>
        </div>
      </>}

      {resultUrl && <div className="flow-result">
        <video className="studio-video-result" controls playsInline src={resultUrl} />
        <a className="dash-button primary" href={resultUrl} download={`${slug(overlay.reference) || 'imovel'}-flow-imoassistenteai.${resultFormat.toLowerCase()}`}><Download size={15} /> Descarregar {resultFormat}</a>
      </div>}
      {status && <p className="flow-status" role="status">{status}</p>}
    </section>
  )
}
