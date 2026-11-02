import { startAmbientMusic, type MusicStyleId } from './ambient-music'

export type JoinClip = { url: string; caption: string; duration: number }
export type JoinOverlay = { reference: string; location: string; title: string; priceLine: string }
export type JoinMusic = { enabled: boolean; file: File | null; style: MusicStyleId }

const width = 1280
const height = 720

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawClipFrame(context: CanvasRenderingContext2D, video: HTMLVideoElement, caption: string, overlay: JoinOverlay) {
  context.fillStyle = '#000'
  context.fillRect(0, 0, width, height)
  if (video.videoWidth && video.videoHeight) {
    const scale = Math.max(width / video.videoWidth, height / video.videoHeight)
    const drawWidth = video.videoWidth * scale
    const drawHeight = video.videoHeight * scale
    context.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
  }

  const shade = context.createLinearGradient(0, 390, 0, height)
  shade.addColorStop(0, 'rgba(8, 9, 10, 0)')
  shade.addColorStop(1, 'rgba(8, 9, 10, 0.82)')
  context.fillStyle = shade
  context.fillRect(0, 370, width, 350)

  context.fillStyle = '#f0bd78'
  context.font = '500 18px sans-serif'
  context.fillText(`${overlay.reference}  ·  ${overlay.location}`, 72, 600)
  context.fillStyle = '#ffffff'
  context.font = '600 34px sans-serif'
  const lines = wrapLines(context, caption || overlay.title, 1120).slice(0, 2)
  lines.forEach((line, index) => context.fillText(line, 72, 641 + index * 37))
  context.fillStyle = 'rgba(255,255,255,0.85)'
  context.font = '400 17px sans-serif'
  context.fillText(`${overlay.priceLine}  ·  ImoAssistenteAI`, 72, 706)

  // Aviso fixo: o movimento é gerado por IA e não é uma filmagem do imóvel.
  context.font = '500 14px sans-serif'
  const badge = 'Imagem animada por IA'
  const badgeWidth = context.measureText(badge).width + 24
  context.fillStyle = 'rgba(8, 9, 10, 0.68)'
  context.fillRect(40, 36, badgeWidth, 30)
  context.fillStyle = '#ffffff'
  context.fillText(badge, 52, 56)
}

function waitFor(video: HTMLVideoElement, event: 'loadeddata') {
  return new Promise<void>((resolve, reject) => {
    video.addEventListener(event, () => resolve(), { once: true })
    video.addEventListener('error', () => reject(new Error('Não foi possível ler um dos vídeos. Confirma que é um MP4 ou WebM.')), { once: true })
  })
}

// Grava os clips, um a seguir ao outro, num único vídeo com legenda, marca da app, aviso de IA e música (os clips ficam sem som).
export async function joinClips(clips: JoinClip[], overlay: JoinOverlay, music: JoinMusic, onProgress: (percent: number) => void): Promise<Blob> {
  if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('Este browser não permite exportar vídeo. Experimenta uma versão recente do Chrome ou Edge.')
  }

  let audioContext: AudioContext | undefined
  let audioElement: HTMLAudioElement | undefined
  let audioUrl = ''
  let stopMusic: (() => void) | undefined
  let canvasStream: MediaStream | undefined
  let recorder: MediaRecorder | undefined
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não foi possível preparar o vídeo neste browser.')
    canvasStream = canvas.captureStream(30)

    let audioTrack: MediaStreamTrack | undefined
    if (music.enabled) {
      audioContext = new AudioContext()
      await audioContext.resume()
      const destination = audioContext.createMediaStreamDestination()
      const master = audioContext.createGain()
      master.gain.value = music.file ? 0.16 : 1
      master.connect(destination)
      if (music.file) {
        audioUrl = URL.createObjectURL(music.file)
        audioElement = new Audio(audioUrl)
        audioElement.loop = true
        audioContext.createMediaElementSource(audioElement).connect(master)
        await audioElement.play()
      } else {
        stopMusic = startAmbientMusic(audioContext, master, music.style)
      }
      audioTrack = destination.stream.getAudioTracks()[0]
    }

    const stream = new MediaStream([...canvasStream.getVideoTracks(), ...(audioTrack ? [audioTrack] : [])])
    const mimeType = ['video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type))
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: BlobPart[] = []
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder!.onerror = () => reject(new Error('O browser interrompeu a gravação.'))
      recorder!.onstop = () => resolve(new Blob(chunks, { type: recorder!.mimeType || 'video/webm' }))
    })

    const total = clips.reduce((sum, clip) => sum + clip.duration, 0) || 1
    let finished = 0
    recorder.start(500)

    for (const clip of clips) {
      video.src = clip.url
      await waitFor(video, 'loadeddata')
      await video.play()
      await new Promise<void>((resolve, reject) => {
        video.onerror = () => reject(new Error('Não foi possível ler um dos vídeos.'))
        const draw = () => {
          drawClipFrame(context, video, clip.caption, overlay)
          onProgress(Math.min(99, Math.round(((finished + video.currentTime) / total) * 100)))
          if (video.ended) resolve()
          else requestAnimationFrame(draw)
        }
        draw()
      })
      finished += clip.duration
    }

    recorder.stop()
    const blob = await stopped
    onProgress(100)
    return blob
  } finally {
    video.pause()
    video.removeAttribute('src')
    stopMusic?.()
    audioElement?.pause()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    void audioContext?.close()
    canvasStream?.getTracks().forEach((track) => track.stop())
    recorder?.stream.getTracks().forEach((track) => track.stop())
  }
}
