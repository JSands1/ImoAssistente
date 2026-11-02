export type PlanPage = { page: number; dataUrl: string }

export type RenderedPlan = {
  pages: PlanPage[]
  totalPages: number
  fileName: string
}

const maxFileBytes = 40 * 1024 * 1024
// Resolução suficiente para ler áreas e nomes de divisões em texto pequeno.
const maxEdge = 2200
// Limita o número de páginas enviadas à IA para controlar tempo e custo.
export const maxPlanPages = 4

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isImage(file: File) {
  return file.type === 'image/png' || file.type === 'image/jpeg' || /\.(?:png|jpe?g)$/iu.test(file.name)
}

async function imageToCanvas(file: File) {
  const image = new Image()
  const url = URL.createObjectURL(file)
  try {
    image.src = url
    await image.decode()
    const scale = Math.min(2.5, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não foi possível preparar a imagem da planta.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Converte o PDF ou imagem em páginas JPEG, no browser, para enviar à IA.
export async function renderPlan(file: File): Promise<RenderedPlan> {
  if (!isPdf(file) && !isImage(file)) throw new Error('Formato não suportado. Escolhe um PDF, PNG ou JPEG.')
  if (file.size > maxFileBytes) throw new Error(`O documento excede o limite de ${Math.round(maxFileBytes / 1024 / 1024)} MB.`)

  if (!isPdf(file)) {
    const canvas = await imageToCanvas(file)
    return { pages: [{ page: 1, dataUrl: canvas.toDataURL('image/jpeg', 0.85) }], totalPages: 1, fileName: file.name }
  }

  const [pdfjs, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  try {
    if (pdf.numPages === 0) throw new Error('O PDF não contém páginas.')
    const pages: PlanPage[] = []
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, maxPlanPages); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(2.5, maxEdge / Math.max(base.width, base.height)) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))
      const context = canvas.getContext('2d')
      if (!context) throw new Error(`Não foi possível renderizar a página ${pageNumber}.`)
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, canvasContext: context, viewport }).promise
      pages.push({ page: pageNumber, dataUrl: canvas.toDataURL('image/jpeg', 0.85) })
      page.cleanup()
    }
    return { pages, totalPages: pdf.numPages, fileName: file.name }
  } finally {
    await pdf.destroy()
  }
}
