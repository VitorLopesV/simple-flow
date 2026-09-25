import { describe, expect, it } from 'vitest'

import { TAMANHO_MAXIMO_IMAGEM, validarArquivoImagem } from './imagem'

function arquivo(tipo: string, tamanho = 10): File {
  return new File([new Uint8Array(tamanho)], 'foto', { type: tipo })
}

describe('validarArquivoImagem', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('aceita %s', (tipo) => {
    expect(validarArquivoImagem(arquivo(tipo))).toBeNull()
  })

  it.each(['image/gif', 'application/pdf', 'text/plain'])('rejeita %s', (tipo) => {
    expect(validarArquivoImagem(arquivo(tipo))).toBe('Use uma imagem JPG, PNG ou WebP.')
  })

  it('rejeita arquivo acima de 5 MB e aceita o limite exato', () => {
    expect(validarArquivoImagem(arquivo('image/png', TAMANHO_MAXIMO_IMAGEM + 1))).toBe(
      'A imagem deve ter no máximo 5 MB.',
    )
    expect(validarArquivoImagem(arquivo('image/png', TAMANHO_MAXIMO_IMAGEM))).toBeNull()
  })
})
