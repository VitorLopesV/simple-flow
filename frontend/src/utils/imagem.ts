export const TIPOS_IMAGEM_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']
export const TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024

/** Mensagem de erro se o arquivo não serve como foto; `null` se está ok. */
export function validarArquivoImagem(arquivo: File): string | null {
  if (!TIPOS_IMAGEM_ACEITOS.includes(arquivo.type)) return 'Use uma imagem JPG, PNG ou WebP.'
  if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) return 'A imagem deve ter no máximo 5 MB.'
  return null
}

/**
 * Recorta a imagem em quadrado (centralizado) e reduz para `lado` px, devolvendo um
 * data URL JPEG. Guardar a foto reduzida mantém o payload e o localStorage pequenos.
 */
export async function redimensionarImagem(arquivo: File, lado = 256): Promise<string> {
  const imagem = await createImageBitmap(arquivo)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = lado
    canvas.height = lado

    const contexto = canvas.getContext('2d')
    if (!contexto) throw new Error('Canvas indisponível')

    const corte = Math.min(imagem.width, imagem.height)
    const x = (imagem.width - corte) / 2
    const y = (imagem.height - corte) / 2
    contexto.drawImage(imagem, x, y, corte, corte, 0, 0, lado, lado)

    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    imagem.close()
  }
}
