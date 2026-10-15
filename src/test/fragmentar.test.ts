import { describe, expect, it } from 'vitest'
import { detectarEncabezados, esTitulo, fragmentarPagina } from '../procesamiento/fragmentar'
import { construirTextoPagina } from '../procesamiento/textoPagina'

const oracion = (n: number) => `Esta es la oración número ${n} sobre el medio interno y los compartimentos líquidos del organismo.`

function pagina(parrafos: number, oracionesPorParrafo = 4) {
  const lineas: string[] = ['Rosario, Argentina. | fcm.unr.edu.ar 2026', 'FISIOLOGIA']
  let n = 0
  for (let p = 0; p < parrafos; p++) for (let o = 0; o < oracionesPorParrafo; o++) lineas.push(oracion(++n))
  return lineas.join('\n')
}

describe('fragmentarPagina', () => {
  it('produce fragmentos de ~150–300 palabras que no se salen de la página', () => {
    const texto = pagina(8)
    const { fragmentos } = fragmentarPagina(texto)
    expect(fragmentos.length).toBeGreaterThan(1)
    for (const f of fragmentos) {
      expect(f.palabras).toBeLessThanOrEqual(360)
      expect(f.inicio).toBeGreaterThanOrEqual(0)
      expect(f.fin).toBeLessThanOrEqual(texto.length)
    }
    expect(fragmentos.slice(0, -1).every((f) => f.palabras >= 120)).toBe(true)
  })
  it('respeta títulos y los guarda como contexto', () => {
    const { fragmentos } = fragmentarPagina(pagina(2))
    expect(fragmentos[0].titulo).toBe('FISIOLOGIA')
  })
  it('descarta encabezados repetidos y renglones de puntos', () => {
    const enc = detectarEncabezados(Array.from({ length: 10 }, (_, i) => `Rosario, Argentina. | fcm.unr.edu.ar 2026\nEl Ser Humano y Su Medio${i + 17}\nContenido ${i}`))
    const texto = 'Rosario, Argentina. | fcm.unr.edu.ar 2026\nEl Ser Humano y Su Medio20\nLluvia de ideas\n.............................................\n' + oracion(1)
    const { fragmentos } = fragmentarPagina(texto, { encabezados: enc })
    const todo = fragmentos.map((f) => f.texto).join(' ')
    expect(todo).not.toContain('Rosario')
    expect(todo).not.toContain('....')
    expect(todo).toContain('oración número 1')
  })
  it('las posiciones apuntan al texto de la página', () => {
    const texto = pagina(3)
    const { fragmentos } = fragmentarPagina(texto)
    expect(texto.slice(fragmentos[0].inicio, fragmentos[0].fin)).toContain('oración número 1')
  })
  it('reconoce títulos en mayúsculas', () => {
    expect(esTitulo('PROPUESTAS DISCIPLINARES')).toBe(true)
    expect(esTitulo('Sofía y Maira, de 15 años, consultan en el centro de salud.')).toBe(false)
  })
})

describe('construirTextoPagina', () => {
  it('arma el texto con saltos de renglón y conserva el tramo de cada ítem', () => {
    const r = construirTextoPagina([
      { str: 'Hola', hasEOL: false, transform: [1, 0, 0, 1, 10, 700], height: 10 },
      { str: ' mundo', hasEOL: true, transform: [1, 0, 0, 1, 40, 700], height: 10 },
      { str: 'chau', hasEOL: false, transform: [1, 0, 0, 1, 10, 680], height: 10 },
    ])
    expect(r.texto).toBe('Hola mundo\nchau')
    expect(r.tramos[2]).toEqual({ item: 2, inicio: 11, fin: 15 })
  })
})
