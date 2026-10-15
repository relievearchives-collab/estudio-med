import { buscarFragmentos } from '../busqueda/hibrida'
import { etiquetaFragmento } from '../chat/preguntar'
import { fraseEnTexto, limpiarMarcas, verificarRespuesta } from '../citas/verificar'
import { unidadPorId } from '../contenido'
import { iaJSON } from '../ia/cliente'
import { armarPromptCaso, armarPromptCasoEvaluar, ESQUEMA_CASO, ESQUEMA_CASO_EVALUAR, SISTEMA_CASO, SISTEMA_CASO_EVALUAR } from '../ia/prompts/caso'
import { indicesValidos, notaPregunta, APROBADO } from '../oral/examen'
import { casos, fragmentos as repoFragmentos, intentos } from '../repositorio'
import type { CasoClinico, CasoEnCurso, EstudioCaso, Fragmento } from '../repositorio/tipos'
import { elegirFragmentos } from '../tarjetas/generar'
import { situacionDe } from '../tutoria/tutor'
import { calcularDerivados, sanearEstudios } from './derivados'

type CasoIA = Partial<Omit<CasoClinico, 'verificada' | 'fragmentoId'>> & { f?: number }

const texto = (s: unknown) => (typeof s === 'string' ? limpiarMarcas(s) : '')

/** Valida el caso de la IA: descarta ítems vacíos, exige lo mínimo por paso, sanea los estudios y verifica el respaldo. */
export function aCaso(c: CasoIA, frags: Fragmento[]): CasoClinico | null {
  const interrogatorio = (c.interrogatorio ?? []).map((x) => ({ pregunta: texto(x.pregunta), respuesta: texto(x.respuesta), relevante: !!x.relevante })).filter((x) => x.pregunta && x.respuesta)
  const examen = (c.examen ?? []).map((x) => ({ sistema: texto(x.sistema), hallazgo: texto(x.hallazgo), relevante: !!x.relevante })).filter((x) => x.sistema && x.hallazgo)
  const estudios = sanearEstudios((c.estudios ?? []).map((x): EstudioCaso => ({
    nombre: texto(x.nombre), grupo: x.grupo ?? 'otro', resultado: texto(x.resultado), clave: x.clave, valor: x.valor, unidad: x.unidad, relevante: !!x.relevante,
  })).filter((x) => x.nombre && x.resultado))
  const puntos = (c.puntos ?? []).map(texto).filter(Boolean).slice(0, 5)
  const edad = Number.isInteger(c.paciente?.edad) && c.paciente!.edad >= 0 && c.paciente!.edad <= 110 ? c.paciente!.edad : null
  if (!texto(c.motivo) || edad === null || interrogatorio.length < 3 || examen.length < 2 || estudios.length < 2 || puntos.length < 2) return null
  const f = Number.isInteger(c.f) && c.f! >= 1 ? frags[c.f! - 1] : undefined
  return {
    titulo: texto(c.titulo) || 'Caso clínico', paciente: { edad, sexo: c.paciente?.sexo === 'hombre' ? 'hombre' : 'mujer', descripcion: texto(c.paciente?.descripcion) },
    motivo: texto(c.motivo), interrogatorio, examen, estudios, consigna: texto(c.consigna) || '¿Cómo interpretás lo que le pasa a la persona?', puntos,
    fragmentoId: f?.id, frase: c.frase, verificada: !!f && !!c.frase && fraseEnTexto(c.frase, f.texto),
  }
}

/** Cómo razonó: cuánto de lo relevante pidió y cuánto de lo que no hacía falta (código, no IA). */
export function proceso(c: CasoEnCurso) {
  const medir = <T extends { relevante: boolean }>(lista: T[], elegidos: number[], nombre: (x: T) => string) => ({
    relevantes: lista.filter((x, i) => x.relevante && elegidos.includes(i)).length,
    totalRelevantes: lista.filter((x) => x.relevante).length,
    innecesarios: lista.filter((x, i) => !x.relevante && elegidos.includes(i)).length,
    faltaron: lista.filter((x, i) => x.relevante && !elegidos.includes(i)).map(nombre),
  })
  return {
    interrogatorio: medir(c.caso.interrogatorio, c.preguntados, (x) => x.pregunta),
    examen: medir(c.caso.examen, c.examinados, (x) => x.sistema),
    estudios: medir(c.caso.estudios, c.pedidos, (x) => x.nombre),
  }
}

/** Valores derivados con los estudios que el estudiante ya pidió. */
export function derivadosPedidos(c: CasoEnCurso) {
  return calcularDerivados(c.caso.estudios.filter((_, i) => c.pedidos.includes(i)), c.caso.paciente)
}

export async function crearCaso(unidadId: string): Promise<CasoEnCurso> {
  const situacion = await situacionDe(unidadId)
  let frags = await buscarFragmentos(situacion, { alcance: { tipo: 'unidad', unidadId }, limite: 8 })
  if (frags.length < 3) frags = elegirFragmentos(await repoFragmentos.enAlcance({ tipo: 'unidad', unidadId }), 8, new Map())
  if (!frags.length) throw new Error('No hay material procesado de esta unidad. Importá la guía o cargá apuntes.')
  const etiquetas = await Promise.all(frags.map(etiquetaFragmento))
  const u = unidadPorId(unidadId)
  const r = await iaJSON<CasoIA>([{ rol: 'usuario', texto: armarPromptCaso(u ? `${u.sigla} · ${u.titulo}` : unidadId, situacion, frags.map((f, i) => ({ texto: f.texto, etiqueta: etiquetas[i] }))) }],
    ESQUEMA_CASO, { sistema: SISTEMA_CASO, uso: 'chat', funcion: 'caso', temperatura: 0.8 })
  const caso = aCaso(r, frags)
  if (!caso) throw new Error('La IA devolvió un caso incompleto. Probá de nuevo.')
  return casos.crear({ unidadId, caso })
}

export async function revelar(id: string, tipo: 'preguntados' | 'examinados' | 'pedidos', indice: number) {
  const c = await casos.obtener(id)
  if (!c || c[tipo].includes(indice)) return c
  return casos.actualizar(id, { [tipo]: [...c[tipo], indice] })
}

function resumenCaso(c: CasoClinico) {
  return [
    `Paciente: ${c.paciente.sexo}, ${c.paciente.edad} años. ${c.paciente.descripcion}`,
    `Motivo de consulta: ${c.motivo}`,
    `Interrogatorio: ${c.interrogatorio.map((x) => `${x.pregunta} → ${x.respuesta}`).join(' | ')}`,
    `Examen físico: ${c.examen.map((x) => `${x.sistema}: ${x.hallazgo}`).join(' | ')}`,
    `Estudios: ${c.estudios.map((x) => `${x.nombre}: ${x.resultado}`).join(' | ')}`,
    `Valores calculados por la app: ${calcularDerivados(c.estudios, c.paciente).map((d) => `${d.nombre} ${d.valor}`).join(' | ') || 'ninguno'}`,
  ].join('\n')
}

/** Corrige la interpretación: la IA dice qué puntos cubre y qué errores tiene; la nota la calcula el código. */
export async function interpretar(id: string, interpretacion: string): Promise<CasoEnCurso> {
  const c = await casos.obtener(id)
  if (!c) throw new Error('No encontré ese caso.')
  if (interpretacion.trim().length < 30) throw new Error('Escribí tu interpretación un poco más completa.')
  await casos.actualizar(id, { interpretacion: interpretacion.trim() })
  // Fragmento que respalda el caso + los más cercanos a lo esperado y a lo que escribió el estudiante.
  const principal = c.caso.fragmentoId ? await repoFragmentos.obtener(c.caso.fragmentoId) : undefined
  const cercanos = await buscarFragmentos(`${c.caso.puntos.join(' ')} ${interpretacion.slice(0, 400)}`, { alcance: { tipo: 'unidad', unidadId: c.unidadId }, limite: 6 })
  let frags = [...(principal ? [principal] : []), ...cercanos.filter((f) => f.id !== principal?.id)].slice(0, 6)
  if (frags.length < 3) frags = [...frags, ...elegirFragmentos(await repoFragmentos.enAlcance({ tipo: 'unidad', unidadId: c.unidadId }), 6, new Map()).filter((f) => !frags.some((x) => x.id === f.id))].slice(0, 6)
  const etiquetas = await Promise.all(frags.map(etiquetaFragmento))
  const r = await iaJSON<{ cubiertos?: number[]; errores?: string[]; devolucion?: { texto: string; citas?: { f: number; frase: string }[] }[] }>(
    [{ rol: 'usuario', texto: armarPromptCasoEvaluar({ resumenCaso: resumenCaso(c.caso), consigna: c.caso.consigna, puntos: c.caso.puntos, interpretacion, fragmentos: frags.map((f, i) => ({ texto: f.texto, etiqueta: etiquetas[i] })) }) }],
    ESQUEMA_CASO_EVALUAR, { sistema: SISTEMA_CASO_EVALUAR, uso: 'chat', funcion: 'caso', temperatura: 0.2 },
  )
  const cubiertos = indicesValidos(r.cubiertos, c.caso.puntos.length)
  const errores = [...new Set((r.errores ?? []).map(texto).filter(Boolean))]
  const nota = notaPregunta(c.caso.puntos.length, cubiertos.length, cubiertos.length, errores.length)
  const devolucion = verificarRespuesta({ respuesta: r.devolucion ?? [] }, frags).segmentos.filter((s) => s.texto)
  await intentos.registrar([{ origen: 'caso', enunciado: c.caso.titulo, respuesta: interpretacion.trim(), correcta: nota >= APROBADO, unidadId: c.unidadId, disciplinaId: principal?.disciplinaId, temaId: principal?.temaId }])
  return (await casos.actualizar(id, { evaluacion: { cubiertos, errores, devolucion, nota }, etapa: 'devolucion', terminado: Date.now() }))!
}
