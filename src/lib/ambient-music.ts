// Músicas de fundo por omissão. São geradas no browser, sem ficheiros nem ligação à internet.

export type MusicStyleId = 'piano' | 'acustico' | 'ambiente' | 'caixa' | 'lounge'

type Chord = { bass: number; notes: number[] }

type MusicStyle = {
  id: MusicStyleId
  label: string
  hint: string
  chords: Chord[]
  /** 'arpejo' toca as notas do acorde uma a uma; 'pad' toca-as todas juntas, devagar. */
  mode: 'arpejo' | 'pad'
  /** Que nota do acorde toca em cada passo do arpejo. */
  pattern: number[]
  /** Segundos entre notas do arpejo. */
  step: number
  /** Notas do arpejo por acorde (em 'pad', é a duração do acorde em passos). */
  chordSteps: number
  wave: OscillatorType
  /** [múltiplo da frequência, intensidade] dos harmónicos que dão o timbre. */
  partials: Array<[number, number]>
  attack: number
  length: number
  level: number
  bassLevel: number
  /** Corta os agudos (Hz): mais baixo, som mais quente. */
  warmth: number
  echoSeconds: number
  echoFeedback: number
  echoMix: number
  volume: number
}

const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12)

export const musicStyles: MusicStyle[] = [
  {
    id: 'piano', label: 'Piano suave', hint: 'Arpejos calmos de piano elétrico.',
    chords: [{ bass: 36, notes: [60, 64, 67, 71] }, { bass: 33, notes: [57, 60, 64, 67] }, { bass: 41, notes: [57, 60, 64, 69] }, { bass: 43, notes: [55, 59, 62, 64] }],
    mode: 'arpejo', pattern: [0, 1, 2, 3, 2, 1, 2, 1], step: 0.5, chordSteps: 8,
    wave: 'sine', partials: [[1, 1], [2, 0.18]], attack: 0.015, length: 2.2, level: 0.3, bassLevel: 0.5, warmth: 2400, echoSeconds: 0.75, echoFeedback: 0.35, echoMix: 0.35, volume: 0.3,
  },
  {
    id: 'acustico', label: 'Guitarra acústica', hint: 'Dedilhado alegre e luminoso.',
    chords: [{ bass: 43, notes: [55, 59, 62, 67] }, { bass: 38, notes: [57, 62, 66, 69] }, { bass: 40, notes: [55, 59, 64, 67] }, { bass: 36, notes: [55, 60, 64, 67] }],
    mode: 'arpejo', pattern: [0, 2, 1, 3, 2, 1, 3, 1], step: 0.375, chordSteps: 8,
    wave: 'triangle', partials: [[1, 1], [2, 0.12]], attack: 0.006, length: 1.3, level: 0.28, bassLevel: 0.45, warmth: 3200, echoSeconds: 0.3, echoFeedback: 0.2, echoMix: 0.15, volume: 0.32,
  },
  {
    id: 'ambiente', label: 'Ambiente calmo', hint: 'Acordes longos e suaves, sem melodia.',
    chords: [{ bass: 36, notes: [55, 60, 64, 71] }, { bass: 41, notes: [57, 60, 65, 69] }, { bass: 33, notes: [55, 60, 64, 67] }, { bass: 43, notes: [55, 59, 62, 69] }],
    mode: 'pad', pattern: [0], step: 1, chordSteps: 6,
    wave: 'sine', partials: [[1, 1], [2, 0.15]], attack: 1.6, length: 7.5, level: 0.13, bassLevel: 0.16, warmth: 1800, echoSeconds: 0.9, echoFeedback: 0.45, echoMix: 0.4, volume: 0.36,
  },
  {
    id: 'caixa', label: 'Caixa de música', hint: 'Notas agudas e delicadas, como sinos pequenos.',
    chords: [{ bass: 48, notes: [72, 76, 79, 84] }, { bass: 53, notes: [72, 77, 81, 84] }, { bass: 55, notes: [71, 74, 79, 83] }, { bass: 45, notes: [72, 76, 81, 84] }],
    mode: 'arpejo', pattern: [0, 1, 2, 3, 2, 1, 0, 1], step: 0.4, chordSteps: 8,
    wave: 'sine', partials: [[1, 1], [2.76, 0.1]], attack: 0.004, length: 1.7, level: 0.22, bassLevel: 0.2, warmth: 5000, echoSeconds: 0.5, echoFeedback: 0.3, echoMix: 0.3, volume: 0.34,
  },
  {
    id: 'lounge', label: 'Lounge elegante', hint: 'Acordes de jazz, lentos e sofisticados.',
    chords: [{ bass: 38, notes: [62, 65, 69, 72] }, { bass: 43, notes: [59, 62, 65, 69] }, { bass: 36, notes: [60, 64, 67, 71] }, { bass: 33, notes: [60, 64, 67, 70] }],
    mode: 'arpejo', pattern: [0, 2, 1, 3, 3, 1, 2, 0], step: 0.6, chordSteps: 8,
    wave: 'sine', partials: [[1, 1], [2, 0.25], [3, 0.06]], attack: 0.02, length: 2.6, level: 0.26, bassLevel: 0.5, warmth: 2000, echoSeconds: 0.9, echoFeedback: 0.4, echoMix: 0.3, volume: 0.3,
  },
]

export const defaultMusicStyle: MusicStyleId = 'piano'

export const parseMusicStyle = (value: unknown): MusicStyleId => musicStyles.find((style) => style.id === value)?.id ?? defaultMusicStyle

function playNote(context: AudioContext, output: AudioNode, style: MusicStyle, note: number, at: number, level: number, attack: number, length: number) {
  const gain = context.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(level, at + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  gain.connect(output)
  for (const [multiple, share] of style.partials) {
    const oscillator = context.createOscillator()
    const part = context.createGain()
    oscillator.type = style.wave
    oscillator.frequency.value = midiToHz(note) * multiple
    part.gain.value = share
    oscillator.connect(part).connect(gain)
    oscillator.start(at)
    oscillator.stop(at + length + 0.05)
  }
}

/** Liga a música escolhida ao `destination` (com o volume dela) e devolve a função que a pára. */
export function startAmbientMusic(context: AudioContext, destination: AudioNode, styleId: MusicStyleId = defaultMusicStyle): () => void {
  const style = musicStyles.find((item) => item.id === styleId) ?? musicStyles[0]

  const level = context.createGain()
  level.gain.value = style.volume
  level.connect(destination)

  const soften = context.createBiquadFilter()
  soften.type = 'lowpass'
  soften.frequency.value = style.warmth
  const echo = context.createDelay(1.5)
  echo.delayTime.value = style.echoSeconds
  const feedback = context.createGain()
  feedback.gain.value = style.echoFeedback
  const echoTone = context.createBiquadFilter()
  echoTone.type = 'lowpass'
  echoTone.frequency.value = 1400
  const wet = context.createGain()
  wet.gain.value = style.echoMix

  soften.connect(level)
  soften.connect(echo)
  echo.connect(echoTone)
  echoTone.connect(feedback).connect(echo)
  echoTone.connect(wet).connect(level)

  let step = 0
  let nextAt = context.currentTime + 0.1
  const schedule = () => {
    while (nextAt < context.currentTime + 1.5) {
      const chord = style.chords[Math.floor(step / style.chordSteps) % style.chords.length]
      const position = step % style.chordSteps
      if (position === 0) {
        playNote(context, soften, style, chord.bass, nextAt, style.bassLevel, style.mode === 'pad' ? style.attack : 0.02, style.mode === 'pad' ? style.length : 4.5)
        if (style.mode === 'pad') for (const note of chord.notes) playNote(context, soften, style, note, nextAt, style.level, style.attack, style.length)
      }
      if (style.mode === 'arpejo') playNote(context, soften, style, chord.notes[style.pattern[position % style.pattern.length]], nextAt, style.level, style.attack, style.length)
      step += 1
      nextAt += style.step
    }
  }
  schedule()
  const timer = window.setInterval(schedule, 250)
  return () => window.clearInterval(timer)
}
