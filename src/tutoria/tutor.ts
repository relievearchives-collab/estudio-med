import { buscarFragmentos } from '../busqueda/hibrida'
import { etiquetaFragmento } from '../chat/preguntar'
import { fraseEnTexto, limpiarMarcas, verificarRespuesta } from '../citas/verificar'
import { paqueteActivo, unidadPorId } from '../contenido'
import { iaJSON, iaTexto } from '../ia/cliente'
import {
  armarPromptAsignar, armarPromptCierre, armarPromptFaltantes, ESQUEMA_ASIGNAR, ESQUEMA_CIERRE, ESQUEMA_FALTANTES, INICIO_TUTOR,
  SISTEMA_ASIGNAR, SISTEMA_CIERRE, SISTEMA_FALTANTES, sistemaTutor, type CierreIA, type GuiaTemas,
} from '../ia/prompts/tutoria'
import type { MensajeIA } from '../ia/proveedor'
import { embeberConsulta } from '../procesamiento/cola'
import { contenidoGuia, eventos, fragmentos as repoFragmentos, tarjetas as repoTarjetas, temas as repoTemas, tutorias } from '../repositorio'
import type { FaltanteTutoria, Fragmento, Tema, TarjetaSugerida, Tutoria } from '../repositorio/tipos'
import { aPropuestas } from '../tarjetas/generar'
import { aplicarAsignacion, disciplinasSinCubrir, priorizarFaltantes, temasSinCubrir, type AsignacionIA } from './cobertura'

/** Cuántos "te faltó pensar en…" se muestran como máximo (repartidos entre disciplinas). */
export const MAX_FALTANTES = 6
const FRAGMENTOS_CIERRE = 10

export const nombreDisciplina = (id: string) => paqueteActivo.disciplinas.find((d) => d.id === id)?.nombre ?? id

/** Situación problemática: el texto oficial de la guía importada o, si no está, el resumen propio del paquete. */
export async function situacionDe(unidadId: string) {
  const c = await contenidoGuia.deUnidad(unidadId)
  return c?.situacion || unidadPorId(unidadId)?.resumenSituacion || ''
}

function guiaDe(temas: Tema[]): GuiaTemas[] {
  const disciplinas = [...new Set(temas.map((t) => t.disciplinaId))]
  return disciplinas.map((d) => ({ disciplina: nombreDisciplina(d), temas: temas.filter((t) => t.disciplinaId === d).map((t) => t.nombre) }))
}

const listaTemas = (temas: Tema[]) => temas.map((t) => ({ nombre: t.nombre, disciplina: nombreDisciplina(t.disciplinaId) }))

/** Embedding de la consulta si el modelo local está listo; si no, búsqueda solo por texto. */
async function vectorDe(texto: string) {
  try { return await embeberConsulta(texto, 15000) } catch { return null }
}

async function obtener(id: string): Promise<Tutoria> {
  const t = await tutorias.obtener(id)
  if (!t) throw new Error('No encontré esa tutoría.')
  return t
}

/** El estudiante habla (o arranca la tutoría) y el tutor responde con preguntas, nunca con respuestas. */
export async function responderTutor(id: string, texto?: string): Promise<Tutoria> {
  let t = await obtener(id)
  if (texto?.trim()) {
    t = (await tutorias.actualizar(id, { mensajes: [...t.mensajes, { rol: 'estudiante', texto: texto.trim(), fecha: Date.now() }] }))!
  }
  const u = unidadPorId(t.unidadId)
  const temas = await repoTemas.deUnidad(t.unidadId)
  const sistema = sistemaTutor({
    unidad: u ? `${u.sigla} · ${u.titulo}` : t.unidadId, situacion: await situacionDe(t.unidadId), ideas: t.ideas, hipotesis: t.hipotesis, guia: guiaDe(temas),
  })
  const mensajes: MensajeIA[] = [{ rol: 'usuario', texto: INICIO_TUTOR }, ...t.mensajes.map((m) => ({ rol: m.rol === 'tutor' ? 'modelo' as const : 'usuario' as const, texto: m.texto }))]
  const r = await iaTexto(mensajes, { sistema, uso: 'chat', funcion: 'tutoria', temperatura: 0.6 })
  return (await tutorias.actualizar(id, { mensajes: [...t.mensajes, { rol: 'tutor', texto: limpiarMarcas(r), fecha: Date.now() }] }))!
}

/**
 * Preguntas de aprendizaje: la IA dice a qué temas apunta cada una; el código calcula qué temas
 * de la UP quedaron afuera y busca en las fuentes un fragmento para citar en cada "te faltó…".
 */
export async function analizarPreguntas(id: string, textos: string[]): Promise<Tutoria> {
  const t = await obtener(id)
  if (!textos.length) throw new Error('Escribí al menos una pregunta de aprendizaje.')
  const temas = await repoTemas.deUnidad(t.unidadId)
  const r = await iaJSON<{ asignaciones?: AsignacionIA[] }>([{ rol: 'usuario', texto: armarPromptAsignar(textos, listaTemas(temas)) }], ESQUEMA_ASIGNAR, {
    sistema: SISTEMA_ASIGNAR, uso: 'lote', funcion: 'tutoria', temperatura: 0,
  })
  const preguntas = aplicarAsignacion(textos, r.asignaciones ?? [], temas)
  const faltan = priorizarFaltantes(temasSinCubrir(temas, preguntas), MAX_FALTANTES)

  // Hasta 2 fragmentos por tema faltante: primero los asignados a ese tema, si no, los mejores de la UP.
  const frags: Fragmento[] = []
  const porTema: number[][] = []
  // Embeddings en paralelo: si el modelo local está ocupado, se espera una sola vez y no una por tema.
  const vectores = await Promise.all(faltan.map((x) => vectorDe(x.nombre)))
  for (const [k, tema] of faltan.entries()) {
    const vector = vectores[k]
    let encontrados = await buscarFragmentos(tema.nombre, { alcance: { tipo: 'tema', temaId: tema.id }, limite: 2, vector })
    if (!encontrados.length) encontrados = await buscarFragmentos(tema.nombre, { alcance: { tipo: 'unidad', unidadId: t.unidadId }, limite: 1, vector })
    porTema.push(encontrados.map((f) => {
      const i = frags.findIndex((x) => x.id === f.id)
      if (i >= 0) return i + 1
      frags.push(f)
      return frags.length
    }))
  }

  let faltantes: FaltanteTutoria[] = []
  if (faltan.length) {
    const etiquetas = await Promise.all(frags.map(etiquetaFragmento))
    const prompt = armarPromptFaltantes(
      await situacionDe(t.unidadId),
      faltan.map((x, i) => ({ nombre: x.nombre, disciplina: nombreDisciplina(x.disciplinaId), fragmentos: porTema[i] })),
      frags.map((f, i) => ({ texto: f.texto, etiqueta: etiquetas[i] })),
    )
    const rf = await iaJSON<{ faltantes?: { t: number; texto: string; f: number; frase: string }[] }>([{ rol: 'usuario', texto: prompt }], ESQUEMA_FALTANTES, {
      sistema: SISTEMA_FALTANTES, uso: 'lote', funcion: 'tutoria', temperatura: 0.3,
    })
    // Cada tema faltante aparece aunque la IA lo omita: la lista la decide el código.
    faltantes = faltan.map((tema, i) => {
      const x = (rf.faltantes ?? []).find((y) => y.t === i + 1)
      const frag = x && Number.isInteger(x.f) && x.f >= 1 ? frags[x.f - 1] : undefined
      return {
        temaId: tema.id, disciplinaId: tema.disciplinaId,
        texto: limpiarMarcas(x?.texto ?? '') || `Te faltó pensar en ${tema.nombre}.`,
        cita: frag && x?.frase ? { n: x.f, fragmentoId: frag.id, frase: x.frase, verificada: fraseEnTexto(x.frase, frag.texto) } : undefined,
      }
    })
  }
  return (await tutorias.actualizar(id, { preguntas, faltantes, etapa: 'preguntas' }))!
}

/** Cierre: devolución de la explicación integradora (con citas), disciplinas que faltaron y tarjetas sugeridas. */
export async function cerrarTutoria(id: string, explicacion: string): Promise<Tutoria> {
  const t = await obtener(id)
  if (explicacion.trim().length < 40) throw new Error('Escribí una explicación un poco más completa (al menos un par de oraciones).')
  const temas = await repoTemas.deUnidad(t.unidadId)
  const situacion = await situacionDe(t.unidadId)
  const consulta = `${situacion.slice(0, 300)} ${explicacion.slice(0, 600)}`
  const frags = await buscarFragmentos(consulta, { alcance: { tipo: 'unidad', unidadId: t.unidadId }, limite: FRAGMENTOS_CIERRE, vector: await vectorDe(consulta) })
  if (!frags.length) throw new Error('No hay material procesado de esta unidad para darte una devolución con citas. Importá la guía o cargá apuntes.')
  const etiquetas = await Promise.all(frags.map(etiquetaFragmento))
  const prompt = armarPromptCierre({ situacion, explicacion, temas: listaTemas(temas), fragmentos: frags.map((f, i) => ({ texto: f.texto, etiqueta: etiquetas[i] })) })
  const r = await iaJSON<CierreIA>([{ rol: 'usuario', texto: prompt }], ESQUEMA_CIERRE, { sistema: SISTEMA_CIERRE, uso: 'chat', funcion: 'tutoria', temperatura: 0.3 })

  const cubiertos = (r.cubiertos ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= temas.length).map((n) => temas[n - 1].id)
  const segmentos = verificarRespuesta({ respuesta: r.devolucion ?? [] }, frags).segmentos
  const tarjetas: TarjetaSugerida[] = aPropuestas((r.tarjetas ?? []).map((x) => ({ ...x, tipo: x.tipo === 'cloze' ? 'cloze' : 'basica' })), frags).map((p) => ({
    tipo: p.tipo === 'cloze' ? 'cloze' : 'basica', frente: p.frente, dorso: p.dorso, cloze: p.cloze, fragmentoId: p.fragmentoId, frase: p.frase, verificada: p.verificada,
  }))
  await eventos.registrar('tutoria', t.unidadId)
  return (await tutorias.actualizar(id, {
    explicacion: explicacion.trim(), etapa: 'cierre', terminada: Date.now(),
    devolucion: { segmentos, disciplinasFaltantes: disciplinasSinCubrir(temas, cubiertos), fragmentoIds: frags.map((f) => f.id), tarjetas },
  }))!
}

/** Guarda en el mazo las tarjetas sugeridas elegidas (con unidad, disciplina y tema del fragmento que las respalda). */
export async function guardarSugeridas(id: string, indices: number[]): Promise<number> {
  const t = await obtener(id)
  const lista = t.devolucion?.tarjetas ?? []
  const elegidas = indices.filter((i) => lista[i] && !lista[i].guardada)
  if (!elegidas.length) return 0
  const frags = new Map((await repoFragmentos.varios(elegidas.map((i) => lista[i].fragmentoId).filter((x): x is string => !!x))).map((f) => [f.id, f]))
  await repoTarjetas.crear(elegidas.map((i) => {
    const s = lista[i]
    const f = s.fragmentoId ? frags.get(s.fragmentoId) : undefined
    return {
      tipo: s.tipo, frente: s.frente, dorso: s.dorso, cloze: s.cloze, fragmentoId: f?.id, fuenteId: f?.fuenteId, pagina: f?.pagina,
      unidadId: f?.unidadId ?? t.unidadId, disciplinaId: f?.disciplinaId, temaId: f?.temaId, etiquetas: ['tutoria'], origen: 'ia' as const,
    }
  }))
  await tutorias.actualizar(id, { devolucion: { ...t.devolucion!, tarjetas: lista.map((s, i) => (elegidas.includes(i) ? { ...s, guardada: true } : s)) } })
  return elegidas.length
}
