/**
 * Texto de una página a partir de los ítems de pdf.js.
 * Lo usan el worker (para fragmentar) y el visor (para resaltar): como es el mismo
 * código, las posiciones [inicio, fin) de los fragmentos coinciden en ambos lados.
 */
export interface ItemTexto {
  str: string
  hasEOL?: boolean
  transform?: number[]
  height?: number
}

export interface TextoPagina {
  texto: string
  /** Para cada ítem de texto: su índice original y su posición en `texto`. */
  tramos: { item: number; inicio: number; fin: number }[]
}

export function construirTextoPagina(items: ItemTexto[]): TextoPagina {
  let texto = ''
  const tramos: TextoPagina['tramos'] = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (typeof it.str !== 'string') continue
    const inicio = texto.length
    texto += it.str
    tramos.push({ item: i, inicio, fin: texto.length })
    if (it.hasEOL) {
      texto += '\n'
      continue
    }
    let k = i + 1
    while (k < items.length && typeof items[k].str !== 'string') k++
    const sig = items[k]
    if (sig?.transform && it.transform) {
      const dy = Math.abs(sig.transform[5] - it.transform[5])
      const alto = Math.max(it.height ?? 0, 4)
      if (dy > alto * 0.6 && !texto.endsWith('\n')) texto += '\n'
    }
  }
  return { texto, tramos }
}
