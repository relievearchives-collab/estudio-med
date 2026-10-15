import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calcularDerivados, sanearEstudios } from '../caso/derivados'
import { db } from '../repositorio/db'
import { casos, fragmentos, fuentes, intentos } from '../repositorio'
import type { EstudioCaso } from '../repositorio/tipos'
import { hco3HH } from '../simuladores/formulas/acidobase'

const respuestas: unknown[] = []
const llamadas: { texto: string; uso?: string }[] = []
vi.mock('../ia/cliente', () => ({
  iaJSON: vi.fn(async (msgs: { texto: string }[], _e: unknown, op: { uso?: string }) => { llamadas.push({ texto: msgs[0].texto, uso: op.uso }); return respuestas.shift() }),
}))
const { aCaso, crearCaso, derivadosPedidos, interpretar, proceso, revelar } = await import('../caso/caso')

const lab = (clave: EstudioCaso['clave'], valor: number, extra: Partial<EstudioCaso> = {}): EstudioCaso => ({ nombre: String(clave), grupo: 'laboratorio', resultado: String(valor), clave, valor, relevante: true, ...extra })

describe('valores del caso (código)', () => {
  it('descarta valores imposibles y claves desconocidas, conserva el texto', () => {
    const r = sanearEstudios([lab('na', 400), { ...lab('k', 4), clave: 'xx' as never }, lab('glucemia', 90)])
    expect(r[0]).toMatchObject({ clave: undefined, valor: undefined, resultado: '400' })
    expect(r[1].clave).toBeUndefined()
    expect(r[2]).toMatchObject({ clave: 'glucemia', valor: 90 })
  })

  it('corrige el HCO3 de una gasometría incoherente con Henderson-Hasselbalch', () => {
    const r = sanearEstudios([lab('ph', 7.2), lab('pco2', 25), lab('hco3', 30, { unidad: 'mEq/L' })])
    const hco3 = r.find((e) => e.clave === 'hco3')!
    expect(hco3.valor).toBeCloseTo(hco3HH(7.2, 25), 1)
    expect(hco3.ajustado).toContain('Henderson-Hasselbalch')
    // Una coherente no se toca
    const ok = sanearEstudios([lab('ph', 7.4), lab('pco2', 40), lab('hco3', 24)])
    expect(ok.find((e) => e.clave === 'hco3')!.ajustado).toBeUndefined()
  })

  it('calcula osmolaridad, anión gap, TFG, FENa y gasometría solo con los datos completos', () => {
    const d = calcularDerivados([lab('na', 140), lab('glucemia', 90), lab('urea', 30), lab('cl', 104), lab('hco3', 12), lab('creatinina', 1),
      lab('orinaNa', 40), lab('orinaCreatinina', 100), lab('ph', 7.28), lab('pco2', 26)], { edad: 40, sexo: 'mujer' })
    const por = Object.fromEntries(d.map((x) => [x.nombre, x]))
    // 2·140 + 90/18 + 30/6 = 290
    expect(por['Osmolaridad plasmática calculada'].valor).toBe('290 mOsm/L')
    expect(por['Anión gap'].valor).toBe('24 mEq/L')
    expect(por['Anión gap'].lectura).toBe('aumentado')
    expect(por['TFG estimada (CKD-EPI 2021)'].valor).toMatch(/^7\d mL/)
    expect(por['Fracción excretada de sodio'].valor).toBe('0,29 %')
    expect(por['Gasometría'].valor).toContain('acidosis metabólica')
    expect(calcularDerivados([lab('na', 140)], { edad: 40, sexo: 'mujer' })).toEqual([])
    // Sin TFG en menores (CKD-EPI es para adultos)
    expect(calcularDerivados([lab('creatinina', 0.5)], { edad: 9, sexo: 'hombre' })).toEqual([])
  })
})

const CASO_IA = {
  titulo: 'Dieta hiperproteica', paciente: { edad: 15, sexo: 'mujer', descripcion: 'Adolescente sana.' }, motivo: 'Consulta por un video sobre daño renal.',
  interrogatorio: [
    { pregunta: '¿Qué comés?', respuesta: 'Mucha proteína.', relevante: true },
    { pregunta: '¿Tomás agua?', respuesta: 'Poca.', relevante: true },
    { pregunta: '¿Hacés deporte?', respuesta: 'Sí.', relevante: true },
    { pregunta: '¿Color favorito?', respuesta: 'Azul.', relevante: false },
    { pregunta: '', respuesta: 'vacía', relevante: true },
  ],
  examen: [{ sistema: 'Signos vitales', hallazgo: 'Normales.', relevante: true }, { sistema: 'Piel', hallazgo: 'Normal.', relevante: false }],
  estudios: [
    { nombre: 'Urea', grupo: 'laboratorio', resultado: '45 mg/dL', clave: 'urea', valor: 45, unidad: 'mg/dL', relevante: true },
    { nombre: 'Creatinina', grupo: 'laboratorio', resultado: '0,7 mg/dL', clave: 'creatinina', valor: 0.7, unidad: 'mg/dL', relevante: true },
    { nombre: 'Radiografía de tórax', grupo: 'imagen', resultado: 'Normal.', relevante: false },
  ],
  consigna: '¿Qué le explicarías?', puntos: ['La urea aumenta con la ingesta proteica', 'La TFG se mantiene normal', 'Importancia de la hidratación'],
  f: 1, frase: 'depende de la presión neta de filtración',
}
const TEXTO = 'La tasa de filtrado glomerular depende de la presión neta de filtración y del coeficiente de filtración. ' + 'relleno '.repeat(40)

describe('flujo del caso con IA simulada', () => {
  beforeEach(async () => {
    await db.delete(); await db.open()
    respuestas.length = 0; llamadas.length = 0
    ;(await import('../busqueda/hibrida')).invalidarIndice()
  })

  it('valida el caso de la IA', () => {
    const frs = [{ id: 'f1', fuenteId: 'g', pagina: 42, inicio: 0, fin: 1, texto: TEXTO, palabras: 60 }]
    const c = aCaso(CASO_IA as never, frs)!
    expect(c.interrogatorio).toHaveLength(4)
    expect(c.verificada).toBe(true)
    expect(aCaso({ ...CASO_IA, puntos: ['uno'] } as never, frs)).toBeNull()
    expect(aCaso({ ...CASO_IA, paciente: { edad: 300, sexo: 'mujer', descripcion: '' } } as never, frs)).toBeNull()
  })

  it('caso completo: revelar, valores derivados de lo pedido, interpretación con nota por código y proceso', async () => {
    const f = await fuentes.crear({ nombre: 'Guía', tipo: 'texto', esGuia: true })
    await fragmentos.reemplazarDeFuente(f.id, Array.from({ length: 5 }, (_, i) => ({ id: `fr-${i}`, fuenteId: f.id, pagina: 40 + i, inicio: 0, fin: 1, texto: TEXTO, palabras: 60, unidadId: 'up3', disciplinaId: 'fisiologia' })))
    respuestas.push(CASO_IA)
    const c = await crearCaso('up3')
    expect(llamadas[0].texto).toContain('SITUACIÓN PROBLEMÁTICA')
    expect(c.etapa).toBe('interrogatorio')

    await revelar(c.id, 'preguntados', 0)
    await revelar(c.id, 'preguntados', 3)
    await revelar(c.id, 'preguntados', 0)
    await revelar(c.id, 'pedidos', 1)
    let actual = (await casos.obtener(c.id))!
    expect(actual.preguntados).toEqual([0, 3])
    // Con creatinina sola no hay TFG porque la paciente tiene 15 años
    expect(derivadosPedidos(actual)).toEqual([])

    await expect(interpretar(c.id, 'corta')).rejects.toThrow()
    respuestas.push({ cubiertos: [1, 3, 8], errores: ['Dijo que la proteína daña siempre el riñón.'], devolucion: [{ texto: 'Bien la urea.', citas: [{ f: 1, frase: 'depende de la presión neta de filtración' }] }] })
    actual = await interpretar(c.id, 'La urea sube porque come mucha proteína; tiene que hidratarse. La proteína daña siempre el riñón.')
    // 2 de 3 puntos → 6,67 → 6,5; −1,5 → 5
    expect(actual.evaluacion).toMatchObject({ cubiertos: [0, 2], nota: 5 })
    expect(actual.evaluacion!.devolucion[0].citas[0].verificada).toBe(true)
    expect(actual.etapa).toBe('devolucion')
    expect((await intentos.todos())[0]).toMatchObject({ origen: 'caso', correcta: false, unidadId: 'up3' })

    const p = proceso(actual)
    expect(p.interrogatorio).toMatchObject({ relevantes: 1, totalRelevantes: 3, innecesarios: 1, faltaron: ['¿Tomás agua?', '¿Hacés deporte?'] })
    expect(p.estudios).toMatchObject({ relevantes: 1, totalRelevantes: 2, innecesarios: 0 })
  })

  it('sin material avisa antes de llamar a la IA', async () => {
    await expect(crearCaso('up6')).rejects.toThrow('No hay material')
    expect(llamadas).toHaveLength(0)
  })
})
