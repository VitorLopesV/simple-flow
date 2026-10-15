/**
 * Estilo de máscara para ícones SVG com `fill` fixo: aplique em um elemento com `bg-current`
 * e a cor do ícone passa a acompanhar o texto do pai (hover, estado ativo...).
 * A URL vai entre aspas porque o Vite pode inlinar o arquivo como data URI.
 */
export function iconMaskStyle(url: string) {
  return {
    maskImage: `url("${url}")`,
    WebkitMaskImage: `url("${url}")`,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
  }
}
