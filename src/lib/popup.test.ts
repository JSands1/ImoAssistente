import { describe, expect, it } from 'vitest'
import { popupFeatures, shouldUsePopup } from './popup'

describe('popupFeatures', () => {
  it('encosta a janela pequena ao canto superior direito da janela da app', () => {
    expect(popupFeatures({ screenX: 0, screenY: 0, outerWidth: 1400, outerHeight: 1000 })).toBe('popup=yes,width=520,height=780,left=864,top=48')
  })

  it('acompanha a janela da app noutro monitor', () => {
    expect(popupFeatures({ screenX: 1920, screenY: 100, outerWidth: 1400, outerHeight: 1000 })).toBe('popup=yes,width=520,height=780,left=2784,top=148')
  })

  it('reduz a janela quando o ecrã é pequeno, sem ficar demasiado pequena', () => {
    expect(popupFeatures({ screenX: 0, screenY: 0, outerWidth: 700, outerHeight: 600 })).toBe('popup=yes,width=520,height=520,left=164,top=48')
    expect(popupFeatures({ screenX: 0, screenY: 0, outerWidth: 300, outerHeight: 300 })).toContain('width=360,height=480')
  })
})

describe('shouldUsePopup', () => {
  it('usa a janela pequena num clique normal', () => {
    expect(shouldUsePopup({ ctrlKey: false, metaKey: false, shiftKey: false, button: 0 })).toBe(true)
  })

  it('deixa o browser abrir um separador com Ctrl, Cmd, Shift ou botão do meio', () => {
    expect(shouldUsePopup({ ctrlKey: true, metaKey: false, shiftKey: false, button: 0 })).toBe(false)
    expect(shouldUsePopup({ ctrlKey: false, metaKey: true, shiftKey: false, button: 0 })).toBe(false)
    expect(shouldUsePopup({ ctrlKey: false, metaKey: false, shiftKey: true, button: 0 })).toBe(false)
    expect(shouldUsePopup({ ctrlKey: false, metaKey: false, shiftKey: false, button: 1 })).toBe(false)
  })
})
