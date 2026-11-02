import { useEffect, type RefObject } from 'react'

// Dá a todos os blocos (`.dash-panel` com título) um botão para minimizar. Fica tudo no DOM, por isso as páginas não
// precisam de saber disto: o estado vai em `data-collapsed` e guarda-se no browser, por título do bloco.

const storageKey = 'casanexa-collapsed-blocks'
const skip = '.metric-card, .property-card, .appointment-form'
const headingChild = ':scope > :is(h2, h3, h4), :scope > * > :is(h2, h3, h4)'

function loadCollapsed() {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function saveCollapsed(collapsed: Set<string>) {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...collapsed]))
  } catch {
    // Sem armazenamento, os blocos continuam a minimizar-se, só não se lembram disso.
  }
}

/** O título do bloco: um dos dois primeiros elementos que seja (ou tenha) um h2, h3 ou h4, ou que se chame "heading". */
function findHeading(panel: HTMLElement) {
  for (const child of Array.from(panel.children).slice(0, 2)) {
    if (!(child instanceof HTMLElement)) continue
    if (child.matches('h2, h3, h4') || child.querySelector(headingChild) || (child.className.includes('heading') && child.querySelector('h2, h3, h4'))) return child
  }
  return null
}

function enhance(panel: HTMLElement, collapsed: Set<string>) {
  if (panel.dataset.collapsible || panel.matches(skip)) return
  const heading = findHeading(panel)
  // Os filtros da Carteira e do Histórico já têm o seu próprio botão de abrir e fechar.
  if (!heading || heading.querySelector('[aria-expanded]')) return
  panel.dataset.collapsible = 'true'
  heading.dataset.collapseHead = 'true'
  const key = (heading.querySelector('h2, h3, h4') ?? heading).textContent?.trim() ?? ''
  const eyebrow = heading.querySelector('.eyebrow')?.textContent?.trim() ?? ''
  const id = `${eyebrow}|${key}`
  // Blocos com data-collapse-memory="off" (o calendário) abrem sempre abertos: o estado não é guardado.
  const remember = panel.dataset.collapseMemory !== 'off'

  // Chevron à esquerda do título, como no "Filtrar a carteira"; o título todo também abre e fecha.
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'collapse-toggle'
  button.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
  const apply = (isCollapsed: boolean) => {
    if (isCollapsed) panel.dataset.collapsed = 'true'
    else delete panel.dataset.collapsed
    button.setAttribute('aria-expanded', String(!isCollapsed))
    button.setAttribute('aria-label', `${isCollapsed ? 'Expandir' : 'Minimizar'} o bloco ${key}`.trim())
    button.title = isCollapsed ? 'Expandir bloco' : 'Minimizar bloco'
  }
  heading.addEventListener('click', (event) => {
    const target = event.target
    const control = target instanceof Element ? target.closest('button, a, input, select, textarea, label') : null
    if (control && control !== button) return
    const next = panel.dataset.collapsed !== 'true'
    if (remember) {
      if (next) collapsed.add(id)
      else collapsed.delete(id)
      saveCollapsed(collapsed)
    }
    apply(next)
  })
  apply(remember && collapsed.has(id))
  heading.prepend(button)
}

/** Torna minimizáveis os blocos que aparecem dentro de `ref`, agora e sempre que a página mudar. */
export function useCollapsiblePanels(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const collapsed = loadCollapsed()
    const run = () => root.querySelectorAll<HTMLElement>('.dash-panel').forEach((panel) => enhance(panel, collapsed))
    run()
    let frame = 0
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(run)
    })
    observer.observe(root, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [ref])
}
