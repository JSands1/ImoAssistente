import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Pause, Play, RotateCcw, SlidersHorizontal, Upload } from 'lucide-react'
import { defaultMotionSettings, motionLimits, type MotionSettings } from '../lib/camera-motion'
import { drawPhotoFrame } from '../lib/photo-frame'
import './MotionPanel.css'

type Props = {
  photoUrls: string[]
  settings: MotionSettings
  onChange: (settings: MotionSettings) => void
  /** Abre a escolha de fotografias (mostrado enquanto não há fotos). */
  onAddPhotos?: () => void
}

type Control = { key: keyof MotionSettings; label: string; hint: string; format: (value: number) => string }

const controls: Control[] = [
  { key: 'slideSeconds', label: 'Duração de cada foto', hint: 'Quanto tempo cada fotografia fica no vídeo.', format: (value) => `${value} s` },
  { key: 'transitionSeconds', label: 'Duração da transição', hint: 'Tempo da mistura entre duas fotos.', format: (value) => `${value.toFixed(1)} s` },
  { key: 'entry', label: 'Arranque na transição', hint: 'Mais alto: a câmara entra depressa e depois trava suavemente (efeito gimbal).', format: (value) => `${Math.round(value * 100)}%` },
]

const sameSettings = (a: MotionSettings, b: MotionSettings) => (Object.keys(a) as Array<keyof MotionSettings>).every((key) => a[key] === b[key])

export default function MotionPanel({ photoUrls, settings, onChange, onAddPhotos }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const settingsRef = useRef(settings)
  const imagesRef = useRef<HTMLImageElement[]>([])
  const clock = useRef({ seconds: 0, last: 0 })
  const [playing, setPlaying] = useState(true)
  const [loaded, setLoaded] = useState(0)
  const urlsKey = photoUrls.join('|')

  useEffect(() => { settingsRef.current = settings }, [settings])

  // Descodifica as fotografias (as primeiras quatro chegam para ver o movimento e a transição).
  useEffect(() => {
    let cancelled = false
    const urls = urlsKey ? urlsKey.split('|').slice(0, 4) : []
    Promise.all(urls.map(async (url) => {
      const image = new Image()
      image.src = url
      await image.decode()
      return image
    })).then((images) => {
      if (cancelled) return
      imagesRef.current = images
      clock.current = { seconds: 0, last: 0 }
      setLoaded(images.length)
    }).catch(() => { if (!cancelled) setLoaded(0) })
    return () => { cancelled = true }
  }, [urlsKey])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || loaded === 0) return
    let frame = 0
    const render = (now: number) => {
      const images = imagesRef.current
      const current = settingsRef.current
      const clockState = clock.current
      if (playing && clockState.last) clockState.seconds += (now - clockState.last) / 1000
      clockState.last = now
      // O ciclo dura o mesmo que as fotos mostradas, e repete-se.
      const total = Math.max(images.length, 2) * current.slideSeconds
      const elapsed = clockState.seconds % total
      drawPhotoFrame(context, images.length === 1 ? [images[0], images[0]] : images, elapsed, current)
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [loaded, playing])

  function update(key: keyof MotionSettings, value: number) {
    onChange({ ...settings, [key]: value })
  }

  return (
    <section className="motion-panel dash-panel" aria-label="Movimento da câmara">
      <div className="motion-heading">
        <div><span className="eyebrow">MOVIMENTO DA CÂMARA</span><h3>Ajusta e vê em tempo real</h3></div>
        <SlidersHorizontal size={18} />
      </div>

      <div className="motion-layout">
        <div className="motion-preview">
          <canvas ref={canvasRef} width={640} height={360} aria-label="Pré-visualização do movimento" />
          {loaded === 0 && <div className="motion-empty"><ImagePlus size={26} /><strong>Começa pelas fotografias do imóvel</strong><span>Arrasta imagens para aqui ou escolhe-as. O movimento aparece logo.</span>{onAddPhotos && <button className="dash-button primary" type="button" onClick={onAddPhotos}><Upload size={14} /> Escolher fotografias</button>}</div>}
          {loaded === 1 && <div className="motion-note">Com uma só foto não há transição; adiciona mais uma para a veres.</div>}
          <div className="motion-preview-bar">
            <button className="dash-button" type="button" onClick={() => setPlaying((value) => !value)} disabled={loaded === 0}>{playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pausar' : 'Continuar'}</button>
            <button className="dash-button" type="button" onClick={() => { clock.current = { seconds: 0, last: 0 } }} disabled={loaded === 0}><RotateCcw size={14} /> Do início</button>
            <span>{loaded > 0 ? `Ciclo com ${Math.max(loaded, 2)} fotos · ${(Math.max(loaded, 2) * settings.slideSeconds).toFixed(0)} s` : ''}</span>
          </div>
        </div>

        <div className="motion-controls">
          {controls.map((control) => {
            const limit = motionLimits[control.key]
            return (
              <label className="motion-slider" key={control.key} title={control.hint}>
                <span><b>{control.label}</b><output>{control.format(settings[control.key])}</output></span>
                <input type="range" min={limit.min} max={limit.max} step={limit.step} value={settings[control.key]} onChange={(event) => update(control.key, Number(event.target.value))} />
                <small>{control.hint}</small>
              </label>
            )
          })}
          <button className="dash-button quiet" type="button" onClick={() => onChange(defaultMotionSettings)} disabled={sameSettings(settings, defaultMotionSettings)}><RotateCcw size={14} /> Repor valores</button>
        </div>
      </div>
    </section>
  )
}
