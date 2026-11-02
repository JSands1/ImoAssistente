import { z } from 'zod'

// Movimento de câmara das fotografias do vídeo, ajustável. Zoom, deslize, inclinação, flutuação e desfoque são fixos; 5 s por foto por omissão.

export type MotionSettings = {
  /** Segundos que cada fotografia fica no vídeo. */
  slideSeconds: number
  /** Segundos que dura a transição (mistura) entre duas fotos. */
  transitionSeconds: number
  /** Intensidade do zoom: 1 é o original, 0 sem zoom. */
  zoom: number
  /** Intensidade do deslize lateral e vertical: 1 é o original. */
  pan: number
  /** Inclinação máxima da câmara, em graus. */
  tilt: number
  /** 0 a 1: quanto o movimento arranca depressa na transição e depois trava (efeito gimbal). */
  entry: number
  /** 0 a 1: ondulação lenta de voo enquanto a foto está parada. */
  float: number
  /** 0 a 1: desfoque de movimento durante o arranque. */
  blur: number
}

// Estes cinco valores são fixos (não se ajustam no ecrã); só a duração, a transição e o arranque são ajustáveis.
const fixedMotion = { zoom: 1.5, pan: 1.7, tilt: 0, float: 0.65, blur: 0.1 }

export const defaultMotionSettings: MotionSettings = { slideSeconds: 5, transitionSeconds: 0.7, entry: 0, ...fixedMotion }

export const motionLimits: Record<keyof MotionSettings, { min: number; max: number; step: number }> = {
  slideSeconds: { min: 3, max: 10, step: 0.5 },
  transitionSeconds: { min: 0.2, max: 2.5, step: 0.1 },
  zoom: { min: 0, max: 4, step: 0.1 },
  pan: { min: 0, max: 3, step: 0.1 },
  tilt: { min: 0, max: 4, step: 0.25 },
  entry: { min: 0, max: 1, step: 0.05 },
  float: { min: 0, max: 1, step: 0.05 },
  blur: { min: 0, max: 1, step: 0.05 },
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount

// Lê definições guardadas: o que faltar ou vier inválido fica com o valor original, e tudo fica dentro dos limites.
export function parseMotionSettings(input: unknown): MotionSettings {
  const raw = z.record(z.string(), z.unknown()).catch({}).parse(input)
  const next = { ...defaultMotionSettings }
  for (const key of Object.keys(defaultMotionSettings) as Array<keyof MotionSettings>) {
    const value = raw[key]
    if (typeof value === 'number' && Number.isFinite(value)) next[key] = clamp(value, motionLimits[key].min, motionLimits[key].max)
  }
  return { ...next, ...fixedMotion }
}

export type CameraMotion = { scale: number; panX: number; panY: number; rotate: number }

const paths = [
  { x: 0.7, y: -0.25 },
  { x: -0.7, y: 0.3 },
  { x: 0.2, y: 0.7 },
  { x: -0.35, y: -0.65 },
]

/** Posição da câmara numa foto. `progress` vai de 0 a 1; `seconds` é o tempo do vídeo (só para a ondulação). */
export function cameraMotion(progress: number, index: number, settings: MotionSettings = defaultMotionSettings, seconds = 0): CameraMotion {
  const t = clamp(progress, 0, 1)
  const smooth = t * t * (3 - 2 * t)
  const out = 1 - (1 - t) ** 4
  const eased = mix(smooth, out, settings.entry)
  const path = paths[index % paths.length]
  const tiltRadians = (settings.tilt * Math.PI) / 180

  const low = 1.045
  const high = low + 0.07 * settings.zoom
  // Ampliação extra para a foto, quando inclina, continuar a cobrir os cantos.
  const cover = 1.8 * tiltRadians + 0.02 * settings.float
  const scale = (index % 2 === 0 ? mix(low, high, eased) : mix(high, low, eased)) + cover

  const sway = settings.float
  return {
    scale,
    panX: clamp(path.x * settings.pan * (eased - 0.5) + Math.sin(seconds * 1.1 + index) * 0.07 * sway, -1, 1),
    panY: clamp(path.y * settings.pan * (eased - 0.5) + Math.sin(seconds * 0.8 + index * 2) * 0.05 * sway, -1, 1),
    rotate: (index % 2 === 0 ? 1 : -1) * tiltRadians * 2 * (eased - 0.5) + Math.sin(seconds * 0.9 + index * 3) * 0.004 * sway,
  }
}

export type PhotoLayer = { index: number; progress: number; motion: CameraMotion; alpha: number; blurSamples: number }

/** Que fotografias se desenham num instante do vídeo, por ordem (a de baixo primeiro). */
export function photoLayers(elapsed: number, count: number, settings: MotionSettings = defaultMotionSettings): PhotoLayer[] {
  if (count <= 0) return []
  const { slideSeconds, transitionSeconds } = settings
  const index = clamp(Math.floor(elapsed / slideSeconds), 0, count - 1)
  const progress = (elapsed - index * slideSeconds) / slideSeconds
  // A transição só mistura a foto nova com a anterior; a anterior fica na posição em que acabou.
  const sinceStart = elapsed - index * slideSeconds
  const fading = index > 0 && sinceStart < transitionSeconds
  const samples = settings.blur > 0 && progress < 0.3 ? 1 + Math.round(settings.blur * 4) : 1
  const current: PhotoLayer = { index, progress: clamp(progress, 0, 1), motion: cameraMotion(clamp(progress, 0, 1), index, settings, elapsed), alpha: fading ? sinceStart / transitionSeconds : 1, blurSamples: samples }
  if (!fading) return [current]
  return [{ index: index - 1, progress: 1, motion: cameraMotion(1, index - 1, settings, elapsed), alpha: 1, blurSamples: 1 }, current]
}

export function totalPhotoSeconds(count: number, settings: MotionSettings = defaultMotionSettings) {
  return count * settings.slideSeconds
}
