import { describe, expect, it } from 'vitest'
import { buscarFrase, limpiarRenglones, normalizar, normalizarConMapa } from '../busqueda/normalizar'
import { fraseEnTexto, limpiarMarcas, verificarRespuesta } from '../citas/verificar'
import type { Fragmento } from '../repositorio/tipos'

describe('normalizar', () => {
  it('ignora tildes, mayúsculas, puntuación y espacios', () => {
    expect(normalizar('  La  Filtración   GLOMERULAR, ¿depende?  ')).toBe('la filtracion glomerular depende')
  })
  it('une palabras cortadas por guion al final de renglón', () => {
    expect(normalizar('una película tan del-\ngada y vibrante')).toBe('una pelicula tan delgada y vibrante')
    expect(normalizar('del- \n  gada')).toBe('delgada')
  })
  it('respeta guiones que no son de corte', () => {
    expect(normalizar('equilibrio ácido-base')).toBe('equilibrio acido base')
  })
  it('convierte superíndices y comillas', () => {
    expect(normalizar('Ca²⁺ “hidratarse”')).toBe('ca2 hidratarse')
  })
  it('el mapa apunta al texto original', () => {
    const o = 'Él  dijo: “sí”'
    const n = normalizarConMapa(o)
    expect(n.texto).toBe('el dijo si')
    expect(o[n.mapa[n.texto.indexOf('si')]]).toBe('s')
  })
})

describe('buscarFrase', () => {
  const pagina = 'El riñón tiene importancia capital. En\neste órgano maravilloso, la estruc-\ntura está tan óptimamente adaptada a\nla función que es imposible analizar.'
  it('encuentra la frase aunque cruce renglones y cortes de guion', () => {
    const r = buscarFrase(pagina, 'la estructura está tan optimamente adaptada a la funcion')
    expect(r).not.toBeNull()
    expect(pagina.slice(r!.inicio, r!.fin)).toBe('la estruc-\ntura está tan óptimamente adaptada a\nla función')
  })
  it('devuelve null si no está', () => {
    expect(buscarFrase(pagina, 'el hígado sintetiza albúmina')).toBeNull()
  })
})

describe('limpiarRenglones', () => {
  it('une renglones y saca guiones de corte', () => {
    expect(limpiarRenglones(['la estruc-', 'tura está', '  adaptada'])).toBe('la estructura está adaptada')
  })
})

const frag = (id: string, texto: string): Fragmento => ({ id, fuenteId: 'g', pagina: 42, inicio: 0, fin: texto.length, texto, palabras: 10 })

describe('verificación de citas', () => {
  const enviados = [
    frag('a', 'Factores determinantes del filtrado glomerular: aplicación de la ecuación de Starling para intercambio capilar.'),
    frag('b', 'Tasa de filtrado glomerular (TFG). Concepto y unidades. Fracción de filtración.'),
  ]
  it('acepta frases textuales con diferencias de tildes y espacios', () => {
    expect(fraseEnTexto('aplicacion de la  ecuacion de Starling', enviados[0].texto)).toBe(true)
  })
  it('acepta elisiones con "..."', () => {
    expect(fraseEnTexto('Factores determinantes ... ecuación de Starling', enviados[0].texto)).toBe(true)
  })
  it('rechaza frases que no están o que son demasiado cortas', () => {
    expect(fraseEnTexto('la ecuación de Henderson', enviados[0].texto)).toBe(false)
    expect(fraseEnTexto('de la', enviados[0].texto)).toBe(false)
  })
  it('marca citas verificadas, no verificadas y fuera de rango', () => {
    const r = verificarRespuesta(
      {
        respuesta: [
          { texto: 'La TFG depende de las fuerzas de Starling [F1].', citas: [{ f: 1, frase: 'aplicación de la ecuación de Starling' }] },
          { texto: 'La fracción de filtración es 20 %.', citas: [{ f: 2, frase: 'la fracción de filtración es del 20 %' }] },
          { texto: 'Algo más.', citas: [{ f: 9, frase: 'Tasa de filtrado glomerular' }] },
        ],
        fueraDeFuentes: '  ',
      },
      enviados,
    )
    expect(r.segmentos[0].citas[0].verificada).toBe(true)
    expect(r.segmentos[0].texto).toBe('La TFG depende de las fuerzas de Starling.')
    expect(r.segmentos[1].citas[0].verificada).toBe(false)
    expect(r.segmentos[1].cifraSinCita).toBe(true)
    expect(r.segmentos[2].citas[0].verificada).toBe(false)
    expect(r.segmentos[2].citas[0].fragmentoId).toBeUndefined()
    expect(r.usados).toEqual(['a'])
    expect(r.fueraDeFuentes).toBeUndefined()
  })
  it('limpia marcas [F1, F2]', () => {
    expect(limpiarMarcas('Texto [F1, F2] final [F3].')).toBe('Texto final.')
  })
})
