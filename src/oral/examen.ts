import { buscarFragmentos } from '../busqueda/hibrida'
import { etiquetaFragmento } from '../chat/preguntar'
import { fraseEnTexto, limpiarMarcas, verificarRespuesta } from '../citas/verificar'
import { iaJSON } from '../ia/cliente'
import {
  armarPromptOralEvaluar, armarPromptOralPreguntas, ESQUEMA_ORAL_EVALUAR, ESQUEMA_ORAL_PREGUNTAS, SISTEMA_ORAL_EVALUAR, SISTEMA_ORAL_PREGUNTAS,
  type EvaluacionOralIA, type PreguntaOralIA,
} from '../ia/prompts/oral'
import { fragmentos as repoFragmentos, intentos, orales } from '../repositorio'
import type { Alcance, ExamenOral, Fragmento, PreguntaOral } from '../repositorio/tipos'
import { elegirFragmentos } from '../tarjetas/generar'

// ───────────────────────── Nota (código, no IA) ─────────────────────────

/** Lo que vale un punto que recién aparece después de la repregunta. */
export const PESO_CON_AYUDA = 0.7
/** Lo que se descuenta por cada error conceptual. */
export const DESCUENTO_ERROR = 1.5
export const APROBADO = 6

const redondearMedio = (n: number) => Math.round(n * 2) / 2

/**
 * Nota 0–10 de una pregunta: proporción de puntos clave cubiertos (los que necesitaron repregunta valen
 * menos) menos un descuento por error conceptual. Redondeada a 0,5.
 */
export function notaPregunta(total: number, cubiertosPrimera: number, cubiertos: number, errores: number) {
  if (total <= 0) return 0
  const solos = Math.min(cubiertosPrimera, cubiertos)
  const base = (10 * (solos + PESO_CON_AYUDA * (cubiertos - solos))) / total
  return Math.max(0, Math.min(10, redondearMedio(base - DESCUENTO_ERROR * errores)))
}

/** Promedio de las preguntas calificadas, con un decimal. */
export function notaFinal(notas: number[]) {
  if (!notas.length) return 0
  return Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10
}

/** Índices válidos (1..n de la IA → 0..n-1), sin repetidos. */
export function indicesValidos(nums: number[] | undefined, total: number) {
  return [...new Set((nums ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= total).map((n) => n - 1))].sort((a, b) => a - b)
}

/** Valida las preguntas de la IA (enunciado, 2–5 puntos) y verifica la frase de respaldo. */
export function aPreguntasOrales(crudas: PreguntaOralIA[], frags: Fragmento[]): PreguntaOral[] {
  const salida: PreguntaOral[] = []
  for (const c of crudas) {
    const enunciado = limpiarMarcas(c.enunciado ?? '')
    const puntos = (c.puntos ?? []).map((p) => limpiarMarcas(p)).filter(Boolean)
    if (!enunciado || puntos.length < 2 || puntos.length > 5) continue
    const f = Number.isInteger(c.f) && c.f >= 1 ? frags[c.f - 1] : undefined
    salida.push({
      enunciado, puntos, fragmentoId: f?.id, frase: c.frase, verificada: !!f && !!c.frase && fraseEnTexto(c.frase, f.texto),
      unidadId: f?.unidadId, disciplinaId: f?.disciplinaId, temaId: f?.temaId,
      turnos: [{ rol: 'examinador', texto: enunciado }], cubiertos: [], errores: [], repreguntada: false,
    })
  }
  return salida
}

// ───────────────────────── Flujo ─────────────────────────

export async function crearExamen(alcance: Alcance, titulo: string, cantidad: number): Promise<ExamenOral> {
  const lista = await repoFragmentos.enAlcance(alcance)
  if (!lista.length) throw new Error('No hay material procesado en ese alcance. Importá la guía o cargá apuntes.')
  const frags = elegirFragmentos(lista, Math.min(10, Math.max(cantidad + 2, 4)), new Map())
  const etiquetas = await Promise.all(frags.map(etiquetaFragmento))
  const r = await iaJSON<{ preguntas?: PreguntaOralIA[] }>(
    [{ rol: 'usuario', texto: armarPromptOralPreguntas(frags.map((f, i) => ({ texto: f.texto, etiqueta: etiquetas[i] })), cantidad) }],
    ESQUEMA_ORAL_PREGUNTAS, { sistema: SISTEMA_ORAL_PREGUNTAS, uso: 'lote', funcion: 'oral', temperatura: 0.6 },
  )
  const preguntas = aPreguntasOrales(r.preguntas ?? [], frags).slice(0, cantidad)
  if (!preguntas.length) throw new Error('La IA no devolvió preguntas válidas. Probá de nuevo.')
  return orales.crear({ alcance, titulo, preguntas })
}

/** Fragmento de la pregunta y los más cercanos a ella, para evaluar con respaldo. */
async function fragmentosParaEvaluar(p: PreguntaOral, alcance: Alcance) {
  const propio = p.fragmentoId ? await repoFragmentos.obtener(p.fragmentoId) : undefined
  const cercanos = await buscarFragmentos(`${p.enunciado} ${p.puntos.join(' ')}`, { alcance, limite: 4 })
  return [...(propio ? [propio] : []), ...cercanos.filter((f) => f.id !== propio?.id)].slice(0, 4)
}

/**
 * El estudiante responde (hablando o escribiendo). La IA dice qué puntos cubrió y qué errores dijo;
 * el código decide si corresponde una repregunta (una sola, si faltan puntos) y calcula la nota.
 */
export async function responder(id: string, texto: string, op: { reintento?: boolean } = {}): Promise<ExamenOral> {
  const ex = await orales.obtener(id)
  if (!ex) throw new Error('No encontré ese examen.')
  const respuesta = texto.trim() || 'No sé.'
  const p: PreguntaOral = { ...ex.preguntas[ex.actual] }
  if (p.nota !== undefined) return ex
  // Reintento: la respuesta ya quedó guardada (la IA falló la vez anterior); se vuelve a evaluar sin duplicarla.
  if (!op.reintento || p.turnos[p.turnos.length - 1]?.rol !== 'estudiante') {
    p.turnos = [...p.turnos, { rol: 'estudiante', texto: respuesta }]
    // Se guarda la respuesta antes de llamar a la IA: si falla, no se pierde.
    await orales.actualizar(id, { preguntas: ex.preguntas.map((x, i) => (i === ex.actual ? p : x)) })
  }

  const frags = await fragmentosParaEvaluar(p, ex.alcance)
  const etiquetas = await Promise.all(frags.map(etiquetaFragmento))
  const r = await iaJSON<EvaluacionOralIA>([{ rol: 'usuario', texto: armarPromptOralEvaluar({
    pregunta: p.enunciado, puntos: p.puntos, turnos: p.turnos, fragmentos: frags.map((f, i) => ({ texto: f.texto, etiqueta: etiquetas[i] })),
  }) }], ESQUEMA_ORAL_EVALUAR, { sistema: SISTEMA_ORAL_EVALUAR, uso: 'chat', funcion: 'oral', temperatura: 0.2 })

  p.cubiertos = [...new Set([...p.cubiertos, ...indicesValidos(r.cubiertos, p.puntos.length)])].sort((a, b) => a - b)
  p.errores = [...new Set([...p.errores, ...(r.errores ?? []).map((e) => limpiarMarcas(e)).filter(Boolean)])]
  if (!p.cubiertosPrimera) p.cubiertosPrimera = p.cubiertos
  const repregunta = limpiarMarcas(r.repregunta ?? '')
  if (!p.repreguntada && p.cubiertos.length < p.puntos.length && repregunta) {
    p.repreguntada = true
    p.turnos = [...p.turnos, { rol: 'examinador', texto: repregunta }]
  } else {
    p.nota = notaPregunta(p.puntos.length, p.cubiertosPrimera.length, p.cubiertos.length, p.errores.length)
    p.devolucion = verificarRespuesta({ respuesta: r.devolucion ?? [] }, frags).segmentos.filter((s) => s.texto)
    await intentos.registrar([{
      origen: 'oral', enunciado: p.enunciado, respuesta: p.turnos.filter((t) => t.rol === 'estudiante').map((t) => t.texto).join('\n'),
      correcta: p.nota >= APROBADO, unidadId: p.unidadId, disciplinaId: p.disciplinaId, temaId: p.temaId,
    }])
  }
  return (await orales.actualizar(id, { preguntas: ex.preguntas.map((x, i) => (i === ex.actual ? p : x)) }))!
}

/** Pasa a la siguiente pregunta; después de la última, cierra el examen con la nota final. */
export async function siguiente(id: string): Promise<ExamenOral> {
  const ex = await orales.obtener(id)
  if (!ex) throw new Error('No encontré ese examen.')
  if (ex.actual < ex.preguntas.length - 1) return (await orales.actualizar(id, { actual: ex.actual + 1 }))!
  const notas = ex.preguntas.map((p) => p.nota).filter((n): n is number => n !== undefined)
  return (await orales.actualizar(id, { terminado: Date.now(), nota: notaFinal(notas) }))!
}
