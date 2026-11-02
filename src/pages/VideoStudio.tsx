import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clapperboard,
  Download,
  ImagePlus,
  Loader2,
  MapPin,
  Music2,
  Pause,
  Play,
  Route,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { musicStyles, parseMusicStyle, startAmbientMusic, type MusicStyleId } from '../lib/ambient-music'
import MotionPanel from '../components/MotionPanel'
import FlowClips from '../components/FlowClips'
import { defaultMotionSettings, parseMotionSettings, type MotionSettings } from '../lib/camera-motion'
import { drawPhotoFrame } from '../lib/photo-frame'
import './VideoStudio.css'

type VideoProperty = { id: string; reference: string; title: string; zone: string; price: number; typology: string; bedrooms: number; details: string }
type Photo = { id: string; file: File; url: string; caption: string }
type FloorPlan = { name: string; url: string; width: number; height: number }
type RoomStop = { id: string; label: string; x: number; y: number }
type AdDetails = {
  title: string
  price: string
  location: string
  propertyType: string
  typology: string
  typologyOther: string
  bedrooms: string
  bathrooms: string
  areaM2: string
  constructionYear: string
  energyRating: string
  highlights: string
}

type VideoStudioProps = {
  properties: VideoProperty[]
  initialPropertyId: string
}

const motionStorageKey = 'casanexa-video-motion'
const roomSegmentSeconds = 3.2
const currentYear = new Date().getFullYear()

function formatPrice(price: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
}

function adTypology(details: AdDetails) {
  return details.typology === 'Outro' ? details.typologyOther?.trim() : details.typology
}

function createAdDetails(property: VideoProperty): AdDetails {
  return {
    title: property.title,
    price: String(property.price),
    location: property.zone,
    propertyType: property.title.toLowerCase().includes('moradia') ? 'Moradia' : 'Apartamento',
    typology: property.typology,
    typologyOther: '',
    bedrooms: String(property.bedrooms),
    bathrooms: '',
    areaM2: '',
    constructionYear: '',
    energyRating: 'Não indicado',
    highlights: property.details,
  }
}

const musicStyleKey = 'casanexa-video-music'

function loadMusicStyle(): MusicStyleId {
  try { return parseMusicStyle(localStorage.getItem(musicStyleKey)) } catch { return parseMusicStyle(undefined) }
}

function loadMotionSettings(): MotionSettings {
  try {
    const saved = localStorage.getItem(motionStorageKey)
    return saved ? parseMotionSettings(JSON.parse(saved)) : defaultMotionSettings
  } catch {
    return defaultMotionSettings
  }
}

function loadAdDetails(): Record<string, AdDetails> {
  try {
    const saved = localStorage.getItem('casanexa-video-ad-details')
    return saved ? JSON.parse(saved) as Record<string, AdDetails> : {}
  } catch {
    return {}
  }
}

function drawFloorPlanFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rooms: RoomStop[],
  roomIndex: number,
  progress: number,
  reference: string,
  details: AdDetails,
) {
  const canvas = context.canvas
  const fit = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
  const travel = Math.min(progress / 0.62, 1)
  const eased = travel * travel * (3 - 2 * travel)
  const previous = rooms[roomIndex - 1]
  const room = rooms[roomIndex]
  const focusX = (previous?.x ?? 0.5) + ((room?.x ?? 0.5) - (previous?.x ?? 0.5)) * eased
  const focusY = (previous?.y ?? 0.5) + ((room?.y ?? 0.5) - (previous?.y ?? 0.5)) * eased
  const zoom = 1.2 + Math.sin(progress * Math.PI) * 0.12
  const width = image.naturalWidth * fit * zoom
  const height = image.naturalHeight * fit * zoom
  const x = canvas.width / 2 - focusX * width
  const y = canvas.height / 2 - focusY * height

  context.fillStyle = '#111213'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, x, y, width, height)
  context.fillStyle = 'rgba(8, 9, 10, 0.2)'
  context.fillRect(0, 0, canvas.width, canvas.height)

  if (rooms.length > 1) {
    context.beginPath()
    rooms.slice(0, roomIndex + 1).forEach((stop, index) => {
      const pointX = x + stop.x * width
      const pointY = y + stop.y * height
      if (index === 0) context.moveTo(pointX, pointY)
      else context.lineTo(pointX, pointY)
    })
    context.strokeStyle = 'rgba(239, 189, 117, 0.8)'
    context.lineWidth = 4
    context.setLineDash([10, 8])
    context.stroke()
    context.setLineDash([])
  }

  if (room) {
    const pulse = 1 + Math.sin(progress * Math.PI * 2) * 0.12
    context.beginPath()
    context.arc(x + room.x * width, y + room.y * height, 35 * pulse, 0, Math.PI * 2)
    context.fillStyle = 'rgba(239, 189, 117, 0.2)'
    context.fill()
    context.strokeStyle = '#efbd75'
    context.lineWidth = 3
    context.stroke()
  }

  const shade = context.createLinearGradient(0, 390, 0, 720)
  shade.addColorStop(0, 'rgba(8, 9, 10, 0)')
  shade.addColorStop(1, 'rgba(8, 9, 10, 0.9)')
  context.fillStyle = shade
  context.fillRect(0, 370, canvas.width, 350)
  context.fillStyle = '#f0bd78'
  context.font = '500 18px sans-serif'
  context.fillText(`${reference}  ·  PERCURSO PELA PLANTA`, 72, 584)
  context.fillStyle = '#ffffff'
  context.font = '600 36px sans-serif'
  context.fillText(room?.label ?? 'Planta do imóvel', 72, 630, 1120)
  context.fillStyle = 'rgba(255,255,255,0.82)'
  context.font = '400 15px sans-serif'
  context.fillText(`${details.propertyType}  ·  ${adTypology(details) || 'Imóvel'}  ·  ${details.areaM2 ? `${details.areaM2} m²` : details.location}`, 72, 675, 1120)
  context.fillStyle = 'rgba(255,255,255,0.85)'
  context.font = '400 17px sans-serif'
  context.fillText(`${details.price ? formatPrice(Number(details.price)) : 'Preço sob consulta'}  ·  ${rooms.length ? `${roomIndex + 1} de ${rooms.length} divisões` : 'Visita à planta'}  ·  ImoAssistenteAI`, 72, 706, 1120)
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.trim().split(/\s+/)
  let line = ''
  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word
    if (context.measureText(nextLine).width > maxWidth && line) {
      context.fillText(line, x, y)
      line = word
      y += lineHeight
    } else {
      line = nextLine
    }
  }
  if (line) context.fillText(line, x, y)
}

export default function VideoStudio({ properties, initialPropertyId }: VideoStudioProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null)
  const [roomStops, setRoomStops] = useState<RoomStop[]>([])
  const [roomName, setRoomName] = useState('')
  const [isMarkingRoom, setIsMarkingRoom] = useState(false)
  const [selectedPropertyId, setSelectedPropertyId] = useState(initialPropertyId)
  const [adDetailsByPropertyId, setAdDetailsByPropertyId] = useState(loadAdDetails)
  const [motion, setMotion] = useState(loadMotionSettings)
  const [includeMusic, setIncludeMusic] = useState(true)
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicStyle, setMusicStyle] = useState<MusicStyleId>(loadMusicStyle)
  const [listening, setListening] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [videoFormat, setVideoFormat] = useState<'MP4' | 'WebM'>('MP4')
  const [videoUrl, setVideoUrl] = useState('')
  const [status, setStatus] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const floorPlanInput = useRef<HTMLInputElement>(null)
  const photoUrls = useRef<string[]>([])
  const floorPlanUrl = useRef('')
  const selectedProperty = properties.find((property) => property.id === selectedPropertyId) ?? properties[0]
  const adDetails = selectedProperty ? adDetailsByPropertyId[selectedProperty.id] ?? createAdDetails(selectedProperty) : undefined

  useEffect(() => () => {
    photoUrls.current.forEach((url) => URL.revokeObjectURL(url))
    if (floorPlanUrl.current) URL.revokeObjectURL(floorPlanUrl.current)
  }, [])

  useEffect(() => {
    if (!videoUrl) return
    return () => URL.revokeObjectURL(videoUrl)
  }, [videoUrl])

  // Ouvir o estilo de música escolhido sem gerar o vídeo; pára ao trocar de estilo, ao desligar a música ou ao gerar.
  const canListen = includeMusic && !musicFile && !isGenerating
  useEffect(() => {
    if (!listening || !canListen) return
    const context = new AudioContext()
    void context.resume()
    const stop = startAmbientMusic(context, context.destination, musicStyle)
    return () => { stop(); void context.close() }
  }, [listening, canListen, musicStyle])
  useEffect(() => {
    try { localStorage.setItem(motionStorageKey, JSON.stringify(motion)) } catch { /* sem armazenamento: usa só nesta sessão */ }
  }, [motion])
  useEffect(() => {
    localStorage.setItem('casanexa-video-ad-details', JSON.stringify(adDetailsByPropertyId))
  }, [adDetailsByPropertyId])

  function clearResult() {
    setVideoUrl('')
    setProgress(0)
    setStatus('')
  }

  function updateAdDetails<K extends keyof AdDetails>(field: K, value: AdDetails[K]) {
    if (!selectedProperty) return
    clearResult()
    setAdDetailsByPropertyId((current) => ({
      ...current,
      [selectedProperty.id]: {
        ...(current[selectedProperty.id] ?? createAdDetails(selectedProperty)),
        [field]: value,
      },
    }))
  }

  async function handleFloorPlanChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf && !file.type.startsWith('image/')) {
      setStatus('Escolhe uma imagem ou um PDF da planta para continuar.')
      return
    }

    let url = ''
    try {
      if (isPdf) {
        const [pdfjs, pdfWorker] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ])
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker.default
        const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
        try {
          const page = await pdf.getPage(1)
          const baseViewport = page.getViewport({ scale: 1 })
          const scale = Math.min(2.5, 2000 / Math.max(baseViewport.width, baseViewport.height))
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Não foi possível preparar a página do PDF.')
          await page.render({ canvas, canvasContext: context, viewport }).promise
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Não foi possível converter a planta PDF.')), 'image/png')
          })
          url = URL.createObjectURL(blob)
          page.cleanup()
        } finally {
          await pdf.destroy()
        }
      } else {
        url = URL.createObjectURL(file)
      }
      const image = new Image()
      image.src = url
      await image.decode()
      if (floorPlanUrl.current) URL.revokeObjectURL(floorPlanUrl.current)
      floorPlanUrl.current = url
      setFloorPlan({ name: file.name, url, width: image.naturalWidth, height: image.naturalHeight })
      setRoomStops([])
      setIsMarkingRoom(false)
      clearResult()
    } catch {
      if (url) URL.revokeObjectURL(url)
      setStatus('Não foi possível abrir esta imagem ou PDF da planta.')
    }
  }

  function addRoomAt(x: number, y: number) {
    const label = roomName.trim()
    if (!isMarkingRoom || !label) return
    setRoomStops((current) => [...current, { id: crypto.randomUUID(), label, x, y }])
    setRoomName('')
    setIsMarkingRoom(false)
    clearResult()
  }

  function handleFloorPlanClick(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    addRoomAt(
      Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    )
  }

  function handleFloorPlanKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isMarkingRoom || !['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    addRoomAt(0.5, 0.5)
  }

  function removeFloorPlan() {
    if (floorPlanUrl.current) URL.revokeObjectURL(floorPlanUrl.current)
    floorPlanUrl.current = ''
    setFloorPlan(null)
    setRoomStops([])
    setIsMarkingRoom(false)
    clearResult()
  }

  function addPhotos(files: FileList | File[]) {
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (!images.length) {
      setStatus('Escolhe ficheiros de imagem para continuar.')
      return
    }
    clearResult()
    const additions = images.map((file) => {
      const url = URL.createObjectURL(file)
      photoUrls.current.push(url)
      return { id: crypto.randomUUID(), file, url, caption: '' }
    })
    setPhotos((current) => [...current, ...additions])
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files) addPhotos(event.currentTarget.files)
    event.currentTarget.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    addPhotos(event.dataTransfer.files)
  }

  function removePhoto(id: string) {
    const photo = photos.find((item) => item.id === id)
    if (!photo) return
    URL.revokeObjectURL(photo.url)
    photoUrls.current = photoUrls.current.filter((url) => url !== photo.url)
    clearResult()
    setPhotos((current) => current.filter((item) => item.id !== id))
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= photos.length) return
    clearResult()
    setPhotos((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function updateCaption(id: string, caption: string) {
    clearResult()
    setPhotos((current) => current.map((photo) => photo.id === id ? { ...photo, caption } : photo))
  }

  function updateRoom(id: string, patch: Partial<RoomStop>) {
    clearResult()
    setRoomStops((current) => current.map((room) => room.id === id ? { ...room, ...patch } : room))
  }

  async function generateVideo() {
    if (!photos.length || !selectedProperty || isGenerating) return
    if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) {
      setStatus('Este browser não permite exportar vídeo. Experimenta uma versão recente do Chrome ou Edge.')
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setStatus('A preparar as fotografias…')
    clearResult()

    let audioContext: AudioContext | undefined
    let audioElement: HTMLAudioElement | undefined
    let stopMusic: (() => void) | undefined
    let canvasStream: MediaStream | undefined
    let recorder: MediaRecorder | undefined

    try {
      const images = await Promise.all(photos.map(async (photo) => {
        const image = new Image()
        image.src = photo.url
        await image.decode()
        return image
      }))
      let floorPlanImage: HTMLImageElement | undefined
      if (floorPlan) {
        floorPlanImage = new Image()
        floorPlanImage.src = floorPlan.url
        await floorPlanImage.decode()
      }

      const canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Não foi possível preparar o vídeo neste browser.')
      canvasStream = canvas.captureStream(30)

      let audioTrack: MediaStreamTrack | undefined
      if (includeMusic) {
        audioContext = new AudioContext()
        await audioContext.resume()
        const destination = audioContext.createMediaStreamDestination()
        const master = audioContext.createGain()
        master.gain.value = musicFile ? 0.16 : 1
        master.connect(destination)

        if (musicFile) {
          audioElement = new Audio(URL.createObjectURL(musicFile))
          audioElement.loop = true
          const source = audioContext.createMediaElementSource(audioElement)
          source.connect(master)
          await audioElement.play()
        } else {
          stopMusic = startAmbientMusic(audioContext, master, musicStyle)
        }
        audioTrack = destination.stream.getAudioTracks()[0]
      }

      const stream = new MediaStream([...canvasStream.getVideoTracks(), ...(audioTrack ? [audioTrack] : [])])
      const mimeType = ['video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type))
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }

      const motionSettings = motion
      const photoDuration = photos.length * motionSettings.slideSeconds
      const floorPlanDuration = floorPlanImage ? Math.max(roomStops.length, 1) * roomSegmentSeconds : 0
      const duration = photoDuration + floorPlanDuration
      const startedAt = performance.now()
      setStatus('A criar o vídeo no teu browser…')

      const recording = new Promise<Blob>((resolve, reject) => {
        recorder!.onerror = () => reject(new Error('O browser interrompeu a gravação.'))
        recorder!.onstop = () => resolve(new Blob(chunks, { type: recorder!.mimeType || 'video/webm' }))
        recorder!.start(500)

        const renderFrame = (time: number) => {
          const elapsed = Math.max(0, Math.min((time - startedAt) / 1000, duration))
          const currentAd = adDetails ?? createAdDetails(selectedProperty)
          if (floorPlanImage && elapsed >= photoDuration) {
            const planElapsed = elapsed - photoDuration
            const roomIndex = roomStops.length ? Math.min(Math.floor(planElapsed / roomSegmentSeconds), roomStops.length - 1) : 0
            const roomProgress = (planElapsed % roomSegmentSeconds) / roomSegmentSeconds
            drawFloorPlanFrame(context, floorPlanImage, roomStops, roomIndex, roomProgress, selectedProperty.reference, currentAd)
          } else {
            const slideIndex = drawPhotoFrame(context, images, elapsed, motionSettings)

            const shade = context.createLinearGradient(0, 390, 0, 720)
            shade.addColorStop(0, 'rgba(8, 9, 10, 0)')
            shade.addColorStop(1, 'rgba(8, 9, 10, 0.82)')
            context.fillStyle = shade
            context.fillRect(0, 370, canvas.width, 350)
            context.fillStyle = '#f0bd78'
            context.font = '500 18px sans-serif'
            context.fillText(`${selectedProperty.reference}  ·  ${currentAd.location}`, 72, 584)
            context.fillStyle = '#ffffff'
            context.font = '600 34px sans-serif'
            drawWrappedText(context, photos[slideIndex].caption || currentAd.title, 72, 625, 1120, 37)
            const propertyFacts = [
              currentAd.propertyType,
              adTypology(currentAd),
              currentAd.areaM2 && `${currentAd.areaM2} m²`,
              currentAd.bedrooms && `${currentAd.bedrooms} quartos`,
              currentAd.bathrooms && `${currentAd.bathrooms} casas de banho`,
              currentAd.constructionYear && `Construção ${currentAd.constructionYear}`,
              currentAd.energyRating !== 'Não indicado' && `Classe ${currentAd.energyRating}`,
              currentAd.highlights && currentAd.highlights.slice(0, 72),
            ].filter(Boolean).join('  ·  ')
            context.fillStyle = 'rgba(255,255,255,0.82)'
            context.font = '400 15px sans-serif'
            context.fillText(propertyFacts, 72, 675, 1120)
            context.fillStyle = 'rgba(255,255,255,0.85)'
            context.font = '400 17px sans-serif'
            context.fillText(`${currentAd.price ? formatPrice(Number(currentAd.price)) : 'Preço sob consulta'}  ·  ImoAssistenteAI`, 72, 706)
          }

          setProgress(Math.round((elapsed / duration) * 100))
          if (elapsed >= duration) {
            recorder!.stop()
            return
          }
          requestAnimationFrame(renderFrame)
        }
        requestAnimationFrame(renderFrame)
      })

      const blob = await recording
      const url = URL.createObjectURL(blob)
      setVideoUrl(url)
      setVideoFormat(blob.type.startsWith('video/mp4') ? 'MP4' : 'WebM')
      setProgress(100)
      setStatus('Vídeo pronto. As fotografias originais foram mantidas.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível gerar o vídeo.')
    } finally {
      stopMusic?.()
      audioElement?.pause()
      audioContext?.close()
      canvasStream?.getTracks().forEach((track) => track.stop())
      recorder?.stream.getTracks().forEach((track) => track.stop())
      setIsGenerating(false)
    }
  }

  return (
    <section className="video-studio">
      <header className="video-studio-heading">
        <div>
          <span className="eyebrow">ESTÚDIO DE VÍDEO</span>
          <h2>Um imóvel, um filme.</h2>
          <p>Transforma as fotografias do anúncio num vídeo curto, sem alterar o imóvel.</p>
        </div>
        <span className="studio-local-badge"><span /> PROCESSAMENTO LOCAL</span>
      </header>

      <div className="video-studio-layout">
        <div className="studio-main-column">
          {(videoUrl || isGenerating) && <section className="studio-preview-panel dash-panel" aria-label="Vídeo gerado">
            <div className="studio-preview-toolbar"><span><Clapperboard size={14} /> VÍDEO · 16:9</span><span>{photos.length} {photos.length === 1 ? 'fotografia' : 'fotografias'}</span></div>
            <div className="studio-preview has-photo">
              {videoUrl && <video className="studio-video-result" controls playsInline src={videoUrl} />}
              {isGenerating && <div className="studio-progress"><span style={{ width: `${progress}%` }} /></div>}
            </div>
          <div className="studio-preview-foot"><span>{isGenerating ? `A renderizar ${progress}%` : status || 'Movimento suave · transições discretas · legendas incorporadas'}</span>{videoUrl && <a className="dash-button primary" href={videoUrl} download={`${selectedProperty?.reference ?? 'imovel'}-imoassistenteai.${videoFormat.toLowerCase()}`}><Download size={15} /> Descarregar {videoFormat}</a>}</div>
          </section>}

          <input ref={fileInput} className="studio-file-input" type="file" accept="image/*" multiple onChange={handleFileChange} aria-label="Escolher fotografias do imóvel" />
          <div className={dragging ? 'studio-drop is-dragging' : 'studio-drop'} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
            <MotionPanel photoUrls={photos.map((photo) => photo.url)} settings={motion} onChange={(next) => { clearResult(); setMotion(next) }} onAddPhotos={() => fileInput.current?.click()} />
          </div>

          {photos.length > 0 && <section className="studio-photos-section">
            <div className="studio-photos-heading"><div><span className="eyebrow">SEQUÊNCIA</span><h3>Fotografias e legendas</h3></div><div className="studio-photo-actions"><span>{photos.length ? `${photos.length} na sequência` : 'Sem fotografias'}</span><button className="dash-button" type="button" title="Pode selecionar várias fotografias de uma vez" onClick={() => fileInput.current?.click()}><ImagePlus size={15} /> Adicionar mais fotos</button></div></div>
            {photos.length ? <div className="studio-photo-list">{photos.map((photo, index) => <article className="studio-photo-item" key={photo.id}>
              <div className="studio-photo-thumb"><img src={photo.url} alt={photo.caption || `Fotografia ${index + 1}`} /><span>{String(index + 1).padStart(2, '0')}</span></div>
              <div className="studio-photo-edit"><label htmlFor={`caption-${photo.id}`}>Legenda da fotografia</label><input id={`caption-${photo.id}`} value={photo.caption} maxLength={90} placeholder="Ex.: Sala ampla com luz natural" onChange={(event) => updateCaption(photo.id, event.target.value)} /></div>
              <div className="studio-photo-controls"><button className="icon-button" type="button" aria-label={`Mover fotografia ${index + 1} para cima`} title="Mover para cima" disabled={index === 0} onClick={() => movePhoto(index, -1)}><ArrowUp size={15} /></button><button className="icon-button" type="button" aria-label={`Mover fotografia ${index + 1} para baixo`} title="Mover para baixo" disabled={index === photos.length - 1} onClick={() => movePhoto(index, 1)}><ArrowDown size={15} /></button><button className="icon-button studio-remove-photo" type="button" aria-label={`Remover fotografia ${index + 1}`} title="Remover fotografia" onClick={() => removePhoto(photo.id)}><Trash2 size={15} /></button></div>
            </article>)}</div> : null}
            <p className="studio-photo-note">No seletor, use Ctrl+clique ou Shift+clique para escolher várias fotografias. Também pode adicionar mais imagens em seleções sucessivas. A ordem define a sequência do vídeo.</p>
          </section>}
        </div>

        <aside className="studio-settings dash-panel">
          <div className="panel-heading"><div><span className="eyebrow">DETALHES DO ANÚNCIO</span><h3>Personaliza o vídeo</h3></div><Clapperboard size={18} /></div>
          <label className="studio-field">Imóvel<select value={selectedProperty?.id ?? ''} onChange={(event) => { clearResult(); setSelectedPropertyId(event.target.value) }}>{properties.map((property) => <option key={property.id} value={property.id}>{property.reference} · {property.title}</option>)}</select></label>
          {adDetails && <div className="studio-ad-fields">
            <label className="studio-field">Título do anúncio<input value={adDetails.title} maxLength={90} onChange={(event) => updateAdDetails('title', event.target.value)} /></label>
            <div className="studio-ad-field-grid">
              <label className="studio-field">Preço (€)<input type="number" min="0" step="1000" value={adDetails.price} onChange={(event) => updateAdDetails('price', event.target.value)} /></label>
              <label className="studio-field">Localização<input value={adDetails.location} onChange={(event) => updateAdDetails('location', event.target.value)} /></label>
              <label className="studio-field">Tipo de imóvel<select value={adDetails.propertyType} onChange={(event) => updateAdDetails('propertyType', event.target.value)}><option>Apartamento</option><option>Moradia</option><option>Quinta</option><option>Terreno</option><option>Loja</option><option>Outro</option></select></label>
              <label className="studio-field">Tipologia<select value={adDetails.typology} onChange={(event) => updateAdDetails('typology', event.target.value)}><option>T0</option><option>T1</option><option>T2</option><option>T3</option><option>T4</option><option>T4+</option><option>T5+</option><option>Outro</option></select></label>
              {adDetails.typology === 'Outro' && <label className="studio-field">Especificar tipologia<input value={adDetails.typologyOther ?? ''} maxLength={40} placeholder="Ex.: T2 duplex" onChange={(event) => updateAdDetails('typologyOther', event.target.value)} /></label>}
              <label className="studio-field">Área (m²)<input type="number" min="0" step="1" placeholder="Ex.: 95" value={adDetails.areaM2} onChange={(event) => updateAdDetails('areaM2', event.target.value)} /></label>
              <label className="studio-field">Ano de construção<input type="number" min="1800" max={currentYear} placeholder="Ex.: 2018" value={adDetails.constructionYear} onChange={(event) => updateAdDetails('constructionYear', event.target.value)} /></label>
              <label className="studio-field">Quartos<input type="number" min="0" step="1" value={adDetails.bedrooms} onChange={(event) => updateAdDetails('bedrooms', event.target.value)} /></label>
              <label className="studio-field">Casas de banho<input type="number" min="0" step="1" placeholder="Ex.: 2" value={adDetails.bathrooms} onChange={(event) => updateAdDetails('bathrooms', event.target.value)} /></label>
              <label className="studio-field">Certificado energético<select value={adDetails.energyRating} onChange={(event) => updateAdDetails('energyRating', event.target.value)}>{['Não indicado', 'A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F', 'Isento', 'Em emissão'].map((rating) => <option key={rating}>{rating}</option>)}</select></label>
            </div>
            <label className="studio-field">Destaques do anúncio<textarea rows={2} value={adDetails.highlights} maxLength={240} placeholder="Ex.: Varanda, garagem, exposição solar" onChange={(event) => updateAdDetails('highlights', event.target.value)} /></label>
            <span className="studio-ad-note">Estes dados pertencem ao vídeo e não alteram o cadastro do imóvel.</span>
          </div>}
          <div className="studio-setting-divider" />
          <label className="studio-music-toggle"><input type="checkbox" checked={includeMusic} onChange={(event) => { clearResult(); setIncludeMusic(event.target.checked) }} /><span><strong><Music2 size={15} /> Música ambiente</strong><small>{musicFile ? musicFile.name : 'Música criada localmente, à tua escolha'}</small></span></label>
          {includeMusic && !musicFile && <div className="studio-music-style"><label className="studio-field">Estilo de música<select value={musicStyle} onChange={(event) => { const next = parseMusicStyle(event.target.value); try { localStorage.setItem(musicStyleKey, next) } catch { /* sem armazenamento */ } clearResult(); setMusicStyle(next) }}>{musicStyles.map((style) => <option key={style.id} value={style.id}>{style.label} · {style.hint}</option>)}</select></label><button className="dash-button studio-music-listen" type="button" disabled={isGenerating} aria-pressed={listening && canListen} onClick={() => setListening((value) => !value)}>{listening && canListen ? <><Pause size={14} /> Parar</> : <><Play size={14} /> Ouvir</>}</button></div>}
          {includeMusic && <label className="studio-music-upload"><Upload size={14} /><span>{musicFile ? 'Trocar faixa de música' : 'Usar a minha música'}</span><input type="file" accept="audio/*" onChange={(event) => { setMusicFile(event.currentTarget.files?.[0] ?? null); clearResult() }} /></label>}
          {musicFile && <button className="studio-clear-music" type="button" onClick={() => { setMusicFile(null); clearResult() }}><X size={13} /> Remover faixa personalizada</button>}
          <div className="studio-setting-divider" />
          <div className="studio-output-facts"><span>Duração estimada</span><strong>{photos.length ? `${photos.length * motion.slideSeconds + (floorPlan ? Math.max(roomStops.length, 1) * roomSegmentSeconds : 0)}s` : '—'}</strong><span>Formato de exportação</span><strong>{videoFormat} · 1280 × 720</strong></div>
          <button className="dash-button primary studio-generate" type="button" disabled={!photos.length || !selectedProperty || isGenerating} onClick={generateVideo}>{isGenerating ? <><Loader2 className="studio-spinner" size={15} /> A criar vídeo…</> : videoUrl ? <><Check size={15} /> Gerar novamente</> : <><Play size={15} /> Gerar vídeo</>}</button>
          <p className="studio-privacy">As fotografias são processadas neste browser e não são enviadas para um servidor.</p>
        </aside>
      </div>

      {selectedProperty && adDetails && <FlowClips
        photos={photos.map((photo) => ({ file: photo.file, caption: photo.caption }))}
        overlay={{ reference: selectedProperty.reference, location: adDetails.location, title: adDetails.title, priceLine: adDetails.price ? formatPrice(Number(adDetails.price)) : 'Preço sob consulta' }}
        music={{ enabled: includeMusic, file: musicFile, style: musicStyle }}
      />}

      <section className="studio-floorplan-section dash-panel">
        <div className="studio-photos-heading"><div><span className="eyebrow">PERCURSO PELA PLANTA</span><h3>Mostra cada divisão</h3></div><span className="studio-floorplan-duration"><Route size={14} /> {roomStops.length ? `${roomStops.length} ${roomStops.length === 1 ? 'divisão' : 'divisões'}` : 'Opcional'}</span></div>
        <input ref={floorPlanInput} className="studio-file-input" type="file" accept="image/*,.pdf,application/pdf" onChange={handleFloorPlanChange} aria-label="Carregar planta do imóvel" />
        {floorPlan ? <>
          <div className="studio-floorplan-file"><span><MapPin size={14} /> {floorPlan.name}</span><div><button className="verify-button" type="button" onClick={() => floorPlanInput.current?.click()}>Trocar planta</button><button className="row-remove" type="button" aria-label="Remover planta" onClick={removeFloorPlan}><Trash2 size={15} /></button></div></div>
          <div className={`studio-floorplan-canvas ${isMarkingRoom ? 'is-marking' : ''}`} style={{ aspectRatio: `${floorPlan.width} / ${floorPlan.height}`, maxWidth: `min(100%, ${Math.round(440 * floorPlan.width / floorPlan.height)}px)` }} role="button" tabIndex={isMarkingRoom ? 0 : -1} aria-label={isMarkingRoom ? 'Clica no centro da divisão que queres marcar' : 'Pré-visualização da planta'} aria-disabled={!isMarkingRoom} onClick={handleFloorPlanClick} onKeyDown={handleFloorPlanKeyDown}>
            <img src={floorPlan.url} alt={`Planta do imóvel: ${floorPlan.name}`} />
            {roomStops.map((room, index) => <span className="studio-room-marker" key={room.id} style={{ left: `${room.x * 100}%`, top: `${room.y * 100}%` }}><i>{index + 1}</i><strong>{room.label}</strong></span>)}
            {isMarkingRoom && <span className="studio-floorplan-crosshair"><MapPin size={18} /> Clica na divisão</span>}
          </div>
          <div className="studio-floorplan-controls"><label className="studio-field">Nome da divisão<input value={roomName} maxLength={36} placeholder="Ex.: Sala de estar" onChange={(event) => setRoomName(event.target.value)} /></label><button className="dash-button primary" type="button" disabled={!roomName.trim()} onClick={() => setIsMarkingRoom((current) => !current)}>{isMarkingRoom ? 'Cancelar marcação' : <><MapPin size={14} /> Marcar divisão</>}</button></div>
          {roomStops.length > 0 && <div className="studio-room-list">{roomStops.map((room, index) => <label className="studio-room-row" key={room.id}><span>{String(index + 1).padStart(2, '0')}</span><input aria-label={`Nome da divisão ${index + 1}`} value={room.label} maxLength={36} onChange={(event) => updateRoom(room.id, { label: event.target.value })} /><button className="row-remove" type="button" aria-label={`Remover divisão ${room.label}`} onClick={() => { clearResult(); setRoomStops((current) => current.filter((item) => item.id !== room.id)) }}><X size={14} /></button></label>)}</div>}
          <p className="studio-photo-note">Marca o centro de cada divisão na ordem em que queres apresentá-las. O vídeo fará um percurso animado pela planta; as localizações são definidas por ti.</p>
        </> : <div className="studio-upload-empty studio-floorplan-empty"><div><Route size={21} /><span><strong>Inclui uma visita guiada pela planta</strong><small>Carrega uma imagem ou PDF; no PDF, usamos a primeira página.</small></span></div><button className="dash-button" type="button" onClick={() => floorPlanInput.current?.click()}><Upload size={14} /> Carregar planta</button></div>}
      </section>

    </section>
  )
}