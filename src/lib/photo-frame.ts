import { cameraMotion, photoLayers, type MotionSettings } from './camera-motion'

export function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, scale = 1, alpha = 1, panX = 0, panY = 0, rotate = 0) {
  const canvas = context.canvas
  const fit = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * scale
  const width = image.naturalWidth * fit
  const height = image.naturalHeight * fit
  const x = (canvas.width - width) * (panX + 1) / 2
  const y = (canvas.height - height) * (panY + 1) / 2
  context.save()
  context.globalAlpha = alpha
  if (rotate !== 0) {
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate(rotate)
    context.translate(-canvas.width / 2, -canvas.height / 2)
  }
  context.drawImage(image, x, y, width, height)
  context.restore()
}

// Desenha as fotografias de um instante do vídeo (com a mistura da transição) e devolve o índice da foto que está a entrar.
export function drawPhotoFrame(context: CanvasRenderingContext2D, images: HTMLImageElement[], elapsed: number, settings: MotionSettings) {
  const { canvas } = context
  const layers = photoLayers(elapsed, images.length, settings)
  context.fillStyle = '#090a0b'
  context.fillRect(0, 0, canvas.width, canvas.height)

  for (const layer of layers) {
    const image = images[layer.index]
    if (!image) continue
    // Com desfoque de movimento, mistura instantes ligeiramente anteriores: a média dá o rasto do movimento.
    for (let sample = 0; sample < layer.blurSamples; sample += 1) {
      const back = sample * 0.012
      const motion = sample === 0 ? layer.motion : cameraMotion(Math.max(0, layer.progress - back), layer.index, settings, elapsed - back * settings.slideSeconds)
      drawCover(context, image, motion.scale, layer.alpha / (sample + 1), motion.panX, motion.panY, motion.rotate)
    }
  }
  return layers.length ? layers[layers.length - 1].index : 0
}
