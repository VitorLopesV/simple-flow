import { describe, expect, it } from 'vitest'

import { MAX_IMAGE_SIZE, validateImageFile } from './image'

function file(type: string, size = 10): File {
  return new File([new Uint8Array(size)], 'foto', { type })
}

describe('validateImageFile', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('aceita %s', (type) => {
    expect(validateImageFile(file(type))).toBeNull()
  })

  it.each(['image/gif', 'application/pdf', 'text/plain'])('rejeita %s', (type) => {
    expect(validateImageFile(file(type))).toBe('Use uma imagem JPG, PNG ou WebP.')
  })

  it('rejeita arquivo acima de 5 MB e aceita o limite exato', () => {
    expect(validateImageFile(file('image/png', MAX_IMAGE_SIZE + 1))).toBe(
      'A imagem deve ter no máximo 5 MB.',
    )
    expect(validateImageFile(file('image/png', MAX_IMAGE_SIZE))).toBeNull()
  })
})
