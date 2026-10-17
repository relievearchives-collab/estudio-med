import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bordeCaja, disponerMapa, mapaAMarkdown, niveles, partirLineas, tablaAMarkdown } from '../esquemas/layout'
import { db } from '../repositorio/db'
import { fragmentos, fuentes } from '../repositorio'
import type { MapaConceptual } from '../repositorio/tipos'

const respuestas: unknown[] = []
const llamadas: { texto: string; sistema?: string }[] = []
vi.mock('../ia/cliente', () => ({
  iaJSON: vi.fn(async (msgs: { texto: string }[], _e: unknown, op: { sistema?: string }) => { llamadas.push({ texto: msgs[0].texto, sistema: op.sistema }); return respuestas.shift() }),
}))
vi.mock('../procesamiento/cola', () => ({ embeberConsulta: async () => null }))
const { aMapa, aTabla, generarEsquema } = await import('../esquemas/generar')

const TEXTO = 'La arteriola aferente lleva sangre al glomérulo y la arteriola eferente la saca; su contracción aumenta la presión capilar glomerular. ' + 'relleno '.repeat(30)
const FRS = [{ id: 'f1', fuenteId: 'g', pagina: 42, inicio: 0, fin: 1, texto: TEXTO, palabras: 60 }]
const FRASE = 'la arteriola eferente la saca; su contracción aumenta la presión'

describe('validación de lo que devuelve la IA', () => {
  it('tabla: recorta columnas, completa celdas faltantes y verifica cada cita', () => {
    const t = aTabla({ columnas: ['Aferente', 'Eferente', '', 'C', 'D', 'E'], filas: [
      { aspecto: 'Función [F1]', celdas: [{ texto: 'Lleva sangre', f: 1, frase: 'La arteriola aferente lleva sangre al glomérulo' }, { texto: 'Saca sangre', f: 1, frase: FRASE }] },
      { aspecto: 'Contracción', celdas: [{ texto: 'Baja la PCG', f: 1, frase: 'frase inventada que no está' }] },
      { aspecto: '', celdas: [{ texto: 'sin aspecto', f: 0, frase: '' }] },
    ] }, FRS)!
    expect(t.columnas).toEqual(['Aferente', 'Eferente', 'C', 'D'])
    expect(t.filas).toHaveLength(2)
    expect(t.filas[0].aspecto).toBe('Función')
    expect(t.filas[0].celdas.map((c) => c.cita?.verificada)).toEqual([true, true, undefined, undefined])
    expect(t.filas[1].celdas[0].cita?.verificada).toBe(false)
    expect(t.filas[1].celdas[1]).toEqual({ texto: '' })
    expect(aTabla({ columnas: ['solo una'], filas: [] }, FRS)).toBeNull()
  })

  it('mapa: ids únicos y relaciones solo entre nodos existentes, sin repetidas ni bucles', () => {
    const m = aMapa({ nodos: [
      { id: 'n1', texto: 'Filtración', f: 1, frase: FRASE }, { id: 'n2', texto: 'Aferente', f: 0, frase: '' },
      { id: 'n2', texto: 'Duplicado', f: 0, frase: '' }, { id: 'n3', texto: 'Eferente', f: 9, frase: 'x' }, { id: '', texto: 'sin id', f: 0, frase: '' },
    ], relaciones: [
      { desde: 'n1', hasta: 'n2', etiqueta: 'depende de' }, { desde: 'n1', hasta: 'n2', etiqueta: 'repetida' }, { desde: 'n1', hasta: 'n3', etiqueta: 'depende de' },
      { desde: 'n3', hasta: 'n3', etiqueta: 'bucle' }, { desde: 'n1', hasta: 'n9', etiqueta: 'inexistente' },
    ] }, FRS)!
    expect(m.nodos.map((n) => n.texto)).toEqual(['Filtración', 'Aferente', 'Eferente'])
    expect(m.relaciones).toHaveLength(2)
    expect(m.nodos[0].cita?.verificada).toBe(true)
    expect(m.nodos[2].cita).toBeUndefined()
  })
})

const MAPA: MapaConceptual = {
  nodos: [{ id: 'a', texto: 'Tasa de filtrado glomerular' }, { id: 'b', texto: 'Presión neta' }, { id: 'c', texto: 'Kf' }, { id: 'd', texto: 'Presión capilar glomerular' }, { id: 'e', texto: 'Isla' }],
  relaciones: [{ desde: 'a', hasta: 'b', etiqueta: 'depende de' }, { desde: 'a', hasta: 'c', etiqueta: 'depende de' }, { desde: 'b', hasta: 'd', etiqueta: 'incluye' }, { desde: 'd', hasta: 'a', etiqueta: 'determina' }],
}

describe('layout del mapa', () => {
  it('corta el texto en renglones y limita a 4', () => {
    expect(partirLineas('Presión capilar glomerular', 20)).toEqual(['Presión capilar', 'glomerular'])
    expect(partirLineas('uno dos tres cuatro cinco seis siete ocho nueve diez once doce', 8)).toHaveLength(4)
    expect(partirLineas('', 20)).toEqual([''])
  })

  it('niveles por distancia desde las raíces, con ciclos e islas', () => {
    const n = niveles(MAPA)
    expect(Object.fromEntries(n)).toEqual({ a: 0, b: 1, c: 1, d: 2, e: 0 })
    // Solo un ciclo, sin raíz: arranca del primero sin colgarse
    expect(niveles({ nodos: [{ id: 'x', texto: 'x' }, { id: 'y', texto: 'y' }], relaciones: [{ desde: 'x', hasta: 'y', etiqueta: '' }, { desde: 'y', hasta: 'x', etiqueta: '' }] }).get('y')).toBe(1)
  })

  it('las cajas no se superponen y respeta las posiciones movidas a mano', () => {
    const { cajas, ancho, alto } = disponerMapa(MAPA)
    const lista = [...cajas.values()]
    for (const [i, p] of lista.entries()) for (const q of lista.slice(i + 1)) {
      const separadas = Math.abs(p.x - q.x) >= (p.w + q.w) / 2 || Math.abs(p.y - q.y) >= (p.h + q.h) / 2
      expect(separadas).toBe(true)
    }
    expect(lista.every((c) => c.x - c.w / 2 >= 0 && c.x + c.w / 2 <= ancho && c.y + c.h / 2 <= alto)).toBe(true)
    const movido = disponerMapa({ ...MAPA, nodos: MAPA.nodos.map((n) => (n.id === 'c' ? { ...n, x: 900, y: 50 } : n)) })
    expect(movido.cajas.get('c')).toMatchObject({ x: 900, y: 50 })
    expect(movido.ancho).toBeGreaterThan(900)
  })

  it('la flecha sale del borde de la caja', () => {
    const c = { x: 100, y: 100, w: 160, h: 40, lineas: [] }
    expect(bordeCaja(c, { x: 400, y: 100 })).toEqual({ x: 180, y: 100 })
    expect(bordeCaja(c, { x: 100, y: 300 })).toEqual({ x: 100, y: 120 })
  })
})

describe('exportar a Markdown', () => {
  it('tabla con referencias y barras escapadas', () => {
    const md = tablaAMarkdown({ columnas: ['A|1', 'B'], filas: [{ aspecto: 'Función', celdas: [{ texto: 'x', cita: { n: 1, frase: 'f', verificada: true, fragmentoId: 'f1' } }, { texto: 'y' }] }] }, (c) => (c.cita ? '(Guía, pág. 42)' : ''))
    expect(md).toBe('| Aspecto | A\\|1 | B |\n| --- | --- | --- |\n| **Función** | x (Guía, pág. 42) | y |')
  })

  it('mapa como viñetas desde las raíces, cada nodo una vez', () => {
    const md = mapaAMarkdown(MAPA)
    expect(md.split('\n')).toEqual([
      '- **Tasa de filtrado glomerular**',
      '  - *depende de* → **Presión neta**',
      '    - *incluye* → **Presión capilar glomerular**',
      '      - *determina* → **Tasa de filtrado glomerular** (ver arriba)',
      '  - *depende de* → **Kf**',
      '- **Isla**',
    ])
  })
})

describe('generar con IA simulada', () => {
  beforeEach(async () => {
    await db.delete(); await db.open(); respuestas.length = 0; llamadas.length = 0
    ;(await import('../busqueda/hibrida')).invalidarIndice()
  })

  it('busca en el alcance, pide el tipo correcto y guarda', async () => {
    const f = await fuentes.crear({ nombre: 'Guía', tipo: 'texto', esGuia: true })
    await fragmentos.reemplazarDeFuente(f.id, [{ id: 'fr-1', fuenteId: f.id, pagina: 42, inicio: 0, fin: 1, texto: TEXTO, palabras: 60, unidadId: 'up3' }])
    respuestas.push({ titulo: 'Arteriolas', nodos: [{ id: 'n1', texto: 'Arteriolas', f: 1, frase: FRASE }, { id: 'n2', texto: 'Aferente', f: 1, frase: FRASE }, { id: 'n3', texto: 'Eferente', f: 1, frase: FRASE }], relaciones: [{ desde: 'n1', hasta: 'n2', etiqueta: 'son' }, { desde: 'n1', hasta: 'n3', etiqueta: 'son' }] })
    const e = await generarEsquema('mapa', 'arteriola aferente y eferente', { tipo: 'unidad', unidadId: 'up3' })
    expect(llamadas[0].texto).toContain('MAPA CONCEPTUAL PEDIDO POR EL ESTUDIANTE: arteriola aferente y eferente')
    expect(llamadas[0].sistema).toContain('MAPAS CONCEPTUALES')
    expect(e).toMatchObject({ tipo: 'mapa', titulo: 'Arteriolas' })
    expect(e.mapa!.nodos.every((n) => n.cita?.verificada)).toBe(true)
  })

  it('sin material o sin consigna avisa sin llamar a la IA', async () => {
    await expect(generarEsquema('tabla', 'algo que no existe', { tipo: 'todo' })).rejects.toThrow('No encontré material')
    await expect(generarEsquema('tabla', ' ', { tipo: 'todo' })).rejects.toThrow('Escribí')
    expect(llamadas).toHaveLength(0)
  })
})
