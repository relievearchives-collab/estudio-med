import { etiquetaFragmento } from '../chat/preguntar'
import { fraseEnTexto, limpiarMarcas } from '../citas/verificar'
import { iaJSON } from '../ia/cliente'
import { armarPromptPreguntas, ESQUEMA_PREGUNTAS, SISTEMA_PREGUNTAS, type PreguntaIA } from '../ia/prompts/preguntas'
import { chats, fragmentos as repoFragmentos, preguntas as repoPreguntas } from '../repositorio'
import type { Alcance, Fragmento, Pregunta } from '../repositorio/tipos'
import { elegirFragmentos } from '../tarjetas/generar'

/** De dónde salen las preguntas. */
export type OrigenPreguntas =
  | { tipo: 'alcance'; alcance: Alcance }
  | { tipo: 'chat'; chatId: string; mensajeId: string }

export type PreguntaNueva = Omit<Pregunta, 'id' | 'creada' | 'actualizada'>

/** Preguntas por llamada (llevan explicación por opción: más texto que una tarjeta) y fragmentos por llamada. */
export const PREGUNTAS_POR_LOTE = 8
const FRAGMENTOS_POR_LOTE = 10

/** Valida lo que devolvió la IA: 4–5 opciones distintas, una correcta válida, enunciado; enlaza y verifica la cita. */
export function aPreguntas(crudas: PreguntaIA[], frags: Fragmento[]): PreguntaNueva[] {
  const salida: PreguntaNueva[] = []
  for (const c of crudas) {
    const enunciado = limpiarMarcas(c.enunciado ?? '')
    const opciones = (c.opciones ?? []).map((o) => ({ texto: limpiarMarcas(o.texto ?? ''), explicacion: limpiarMarcas(o.explicacion ?? '') })).filter((o) => o.texto)
    if (!enunciado || opciones.length < 3 || opciones.length > 6) continue
    if (new Set(opciones.map((o) => o.texto.toLowerCase())).size !== opciones.length) continue
    if (!Number.isInteger(c.correcta) || c.correcta < 0 || c.correcta >= opciones.length) continue
    const f = frags[c.f - 1]
    salida.push({
      enunciado, opciones, correcta: c.correcta, explicacion: limpiarMarcas(c.explicacion ?? opciones[c.correcta].explicacion),
      fragmentoId: f?.id, fuenteId: f?.fuenteId, pagina: f?.pagina, frase: c.frase,
      verificada: !!f && !!c.frase && fraseEnTexto(c.frase, f.texto),
      unidadId: f?.unidadId, disciplinaId: f?.disciplinaId, temaId: f?.temaId, origen: 'ia',
    })
  }
  return salida
}

async function llamar(frags: Fragmento[], cantidad: number, foco?: { titulo: string; texto: string }, existentes?: string[]) {
  const etiquetas = await Promise.all(frags.map(etiquetaFragmento))
  const prompt = armarPromptPreguntas({ fragmentos: frags.map((f, i) => ({ texto: f.texto, etiqueta: etiquetas[i] })), cantidad, foco, existentes })
  const r = await iaJSON<{ preguntas?: PreguntaIA[] }>([{ rol: 'usuario', texto: prompt }], ESQUEMA_PREGUNTAS, {
    sistema: SISTEMA_PREGUNTAS, uso: 'lote', funcion: 'preguntas', temperatura: 0.5,
  })
  return aPreguntas(r.preguntas ?? [], frags)
}

/**
 * Genera preguntas y las guarda en el banco (se pueden editar, reportar o borrar después).
 * Las que no tienen respaldo verificado quedan marcadas para revisar.
 */
export async function generarPreguntas(origen: OrigenPreguntas, cantidad: number, alProgreso?: (hechos: number, total: number) => void): Promise<Pregunta[]> {
  const banco = await repoPreguntas.todas()
  let nuevas: PreguntaNueva[] = []
  if (origen.tipo === 'alcance') {
    const lista = await repoFragmentos.enAlcance(origen.alcance)
    if (!lista.length) throw new Error('No hay material procesado en ese alcance. Cargá o procesá fuentes primero.')
    const usadas = new Map<string, number>()
    for (const p of banco) if (p.fragmentoId) usadas.set(p.fragmentoId, (usadas.get(p.fragmentoId) ?? 0) + 1)
    const lotes = Math.ceil(cantidad / PREGUNTAS_POR_LOTE)
    const elegidos = elegirFragmentos(lista, Math.min(lista.length, lotes * FRAGMENTOS_POR_LOTE, Math.max(3, cantidad)), usadas)
    const existentes = banco.filter((p) => elegidos.some((f) => f.id === p.fragmentoId)).map((p) => p.enunciado.slice(0, 120))
    for (let i = 0; i < lotes; i++) {
      alProgreso?.(i, lotes)
      const frags = elegidos.filter((_, k) => k % lotes === i)
      if (!frags.length) continue
      const n = i === lotes - 1 ? cantidad - PREGUNTAS_POR_LOTE * (lotes - 1) : PREGUNTAS_POR_LOTE
      nuevas.push(...await llamar(frags, n, undefined, existentes))
    }
    alProgreso?.(lotes, lotes)
  } else {
    const chat = await chats.obtener(origen.chatId)
    const m = chat?.mensajes.find((x) => x.id === origen.mensajeId)
    if (!m) throw new Error('No encontré esa respuesta del chat.')
    const citados = [...new Set((m.segmentos ?? []).flatMap((s) => s.citas.filter((c) => c.verificada && c.fragmentoId).map((c) => c.fragmentoId!)))]
    const frags = await repoFragmentos.varios((citados.length ? citados : (m.fragmentoIds ?? [])).slice(0, 10))
    if (!frags.length) throw new Error('Esa respuesta no tiene fragmentos de tus fuentes para respaldar preguntas.')
    const pregunta = chat!.mensajes[chat!.mensajes.indexOf(m) - 1]?.texto ?? ''
    nuevas = await llamar(frags, cantidad, { titulo: 'RESPUESTA DEL CHAT', texto: `Pregunta: ${pregunta}\nRespuesta: ${(m.segmentos ?? []).map((s) => s.texto).join('\n')}` })
  }
  return repoPreguntas.crear(nuevas.slice(0, cantidad))
}

/** Regenera una pregunta reportada como mala con el mismo fragmento; reemplaza la anterior. */
export async function regenerarPregunta(p: Pregunta): Promise<Pregunta | null> {
  const f = p.fragmentoId ? await repoFragmentos.obtener(p.fragmentoId) : undefined
  if (!f) throw new Error('La pregunta no tiene un fragmento de origen para regenerarla.')
  const [nueva] = await llamar([f], 1, undefined, [p.enunciado])
  if (!nueva) return null
  const reemplazo: Pregunta = { ...p, ...nueva, reportada: undefined, actualizada: Date.now() }
  await repoPreguntas.guardar(reemplazo)
  return reemplazo
}
