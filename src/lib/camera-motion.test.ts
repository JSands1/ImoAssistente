import { describe, expect, it } from 'vitest'
import { cameraMotion, defaultMotionSettings, motionLimits, parseMotionSettings, photoLayers } from './camera-motion'

describe('parseMotionSettings', () => {
  it('sem dados guardados fica com o movimento original', () => {
    expect(parseMotionSettings(undefined)).toEqual(defaultMotionSettings)
    expect(parseMotionSettings('lixo')).toEqual(defaultMotionSettings)
  })

  it('aceita o que é válido, limita ao permitido e ignora o inválido', () => {
    const parsed = parseMotionSettings({ transitionSeconds: 99, entry: 'muito', slideSeconds: 6 })
    expect(parsed).toMatchObject({ transitionSeconds: motionLimits.transitionSeconds.max, entry: defaultMotionSettings.entry, slideSeconds: 6 })
  })

  it('zoom, deslize, inclinação, flutuação e desfoque são sempre os valores fixos', () => {
    const parsed = parseMotionSettings({ zoom: 4, pan: 0, tilt: 3, float: 0, blur: 1 })
    expect(parsed).toMatchObject({ zoom: 1.5, pan: 1.7, tilt: 0, float: 0.65, blur: 0.1 })
  })
})

describe('cameraMotion', () => {
  it('sem inclinação a foto quase não roda', () => {
    for (const progress of [0, 0.3, 1]) {
      expect(Math.abs(cameraMotion(progress, 0, defaultMotionSettings, 12.3).rotate)).toBeLessThan(0.01)
    }
  })

  it('o zoom e o deslize aumentam com a intensidade', () => {
    const forte = { ...defaultMotionSettings, zoom: 3, pan: 2 }
    expect(cameraMotion(1, 0, forte).scale).toBeGreaterThan(cameraMotion(1, 0).scale)
    expect(Math.abs(cameraMotion(1, 0, forte).panX)).toBeGreaterThan(Math.abs(cameraMotion(1, 0).panX))
  })

  it('o arranque rápido avança mais cedo e depois trava', () => {
    const gimbal = { ...defaultMotionSettings, entry: 1 }
    const early = (settings: typeof gimbal) => Math.abs(cameraMotion(0.15, 0, settings).panX - cameraMotion(0, 0, settings).panX)
    const late = (settings: typeof gimbal) => Math.abs(cameraMotion(0.95, 0, settings).panX - cameraMotion(0.75, 0, settings).panX)
    expect(early(gimbal)).toBeGreaterThan(early(defaultMotionSettings) * 2)
    expect(late(gimbal)).toBeLessThan(late(defaultMotionSettings) / 2)
  })

  it('nunca mostra margens, nem com tudo no máximo', () => {
    const maximo = Object.fromEntries(Object.entries(motionLimits).map(([key, limit]) => [key, limit.max])) as typeof defaultMotionSettings
    for (const settings of [defaultMotionSettings, maximo]) {
      for (let index = 0; index < 5; index += 1) {
        for (let step = 0; step <= 20; step += 1) {
          const motion = cameraMotion(step / 20, index, settings, step)
          expect(Math.abs(motion.panX)).toBeLessThanOrEqual(1)
          expect(Math.abs(motion.panY)).toBeLessThanOrEqual(1)
          expect(motion.scale).toBeGreaterThan(1 + Math.abs(motion.rotate) * 1.8)
        }
      }
    }
  })
})

describe('photoLayers', () => {
  it('mostra só a primeira foto no início', () => {
    expect(photoLayers(0.2, 3).map((layer) => [layer.index, layer.alpha])).toEqual([[0, 1]])
  })

  it('mistura a foto anterior com a nova durante a transição', () => {
    const layers = photoLayers(5.35, 3)
    expect(layers.map((layer) => layer.index)).toEqual([0, 1])
    expect(layers[1].alpha).toBeCloseTo(0.5)
  })

  it('depois da transição só fica a foto nova', () => {
    expect(photoLayers(6, 3).map((layer) => layer.index)).toEqual([1])
  })

  it('respeita a duração e a transição escolhidas', () => {
    const settings = { ...defaultMotionSettings, slideSeconds: 4, transitionSeconds: 2 }
    expect(photoLayers(5, 3, settings).map((layer) => layer.index)).toEqual([0, 1])
    expect(photoLayers(6.5, 3, settings).map((layer) => layer.index)).toEqual([1])
  })

  it('não passa da última foto', () => {
    expect(photoLayers(99, 3).map((layer) => layer.index)).toEqual([2])
    expect(photoLayers(1, 0)).toEqual([])
  })
})
