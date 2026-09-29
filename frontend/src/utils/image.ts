export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024

/** Mensagem de erro se o arquivo não serve como foto; `null` se está ok. */
export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Use uma imagem JPG, PNG ou WebP.'
  if (file.size > MAX_IMAGE_SIZE) return 'A imagem deve ter no máximo 5 MB.'
  return null
}

/**
 * Recorta a imagem em quadrado (centralizado) e reduz para `side` px, devolvendo um
 * data URL JPEG. Guardar a foto reduzida mantém o payload e o localStorage pequenos.
 */
export async function resizeImage(file: File, side = 256): Promise<string> {
  const image = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas indisponível')

    const crop = Math.min(image.width, image.height)
    const x = (image.width - crop) / 2
    const y = (image.height - crop) / 2
    context.drawImage(image, x, y, crop, crop, 0, 0, side, side)

    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    image.close()
  }
}
