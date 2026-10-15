import { buscarFrase } from '../busqueda/normalizar'
import { etiquetaFragmento } from '../chat/preguntar'
import { fraseEnTexto, limpiarMarcas } from '../citas/verificar'
import { iaJSON } from '../ia/cliente'
import { armarPromptTarjetas, ESQUEMA_TARJETAS, SISTEMA_TARJETAS, type TarjetaIA, type TiposPedidos } from '../ia/prompts/tarjetas'
import { chats, fragmentos as repoFragmentos, tarjetas as repoTarjetas } from '../repositorio'
import type { Alcance, Fragmento, Tarjeta } from '../repositorio/tipos'
import type { BorradorTarjeta } from './crear'
import { numerosCloze } from './fsrs'

/** De dónde salen las tarjetas. */
export type OrigenGeneracion =
  | { tipo: 'alcance'; alcance: Alcance }
  | { tipo: 'seleccion'; texto: string; fuenteId: string; pagina: number }
  | { tipo: 'chat'; chatId: string; mensajeId: string }

export interface Propuesta extends BorradorTarjeta {
  clave: string
  frase: string
  /** La frase de respaldo aparece textualmente en el fragmento enlazado. */
  verificada: boolean
}

/** Tarjetas por llamada y fragmentos por llamada (cuidan la cuota sin perder calidad). */
export const TARJETAS_POR_LOTE = 20
const FRAGMENTOS_POR_LOTE = 14

/**
 * Reparte fragmentos de un alcance: primero los que todavía no tienen tarjetas,
 * espaciados a lo largo del material (no todos de las primeras páginas).
 */
export function elegirFragmentos(lista: Fragmento[], cuantos: number, tarjetasPorFragmento: Map<string, number>): Fragmento[] {
  const utiles = lista
    .filter((f) => f.palabras >= 40)
    .sort((a, b) => a.fuenteId.localeCompare(b.fuenteId) || a.pagina - b.pagina || a.inicio - b.inicio)
  if (utiles.length <= cuantos) return utiles
  const sin = utiles.filter((f) => !tarjetasPorFragmento.get(f.id))
  if (sin.length >= cuantos) {
    const paso = sin.length / cuantos
    return Array.from({ length: cuantos }, (_, i) => sin[Math.floor(i * paso)])
  }
  const con = utiles.filter((f) => tarjetasPorFragmento.get(f.id)).sort((a, b) => tarjetasPorFragmento.get(a.id)! - tarjetasPorFragmento.get(b.id)!)
  return [...sin, ...con.slice(0, cuantos - sin.length)]
}

/** Valida y convierte lo que devolvió la IA (descarta lo vacío o mal formado). */
export function aPropuestas(crudas: TarjetaIA[], frags: Fragmento[], extra: Partial<BorradorTarjeta> = {}): Propuesta[] {
  const salida: Propuesta[] = []
  for (const [i, c] of crudas.entries()) {
    const f = frags[c.f - 1]
    const frente = limpiarMarcas(c.frente ?? '')
    const dorso = limpiarMarcas(c.dorso ?? '')
    const cloze = limpiarMarcas(c.cloze ?? '')
    const tipo = c.tipo === 'cloze' || (!frente && numerosCloze(cloze).length) ? 'cloze' : 'basica'
    if (tipo === 'cloze' && !numerosCloze(cloze).length) continue
    if (tipo === 'basica' && (!frente || !dorso)) continue
    salida.push({
      clave: `p${i}-${Math.random().toString(36).slice(2, 7)}`,
      tipo, frente: tipo === 'basica' ? frente : '', dorso, cloze: tipo === 'cloze' ? cloze : undefined,
      fragmentoId: f?.id, fuenteId: f?.fuenteId, pagina: f?.pagina,
      unidadId: f?.unidadId, disciplinaId: f?.disciplinaId, temaId: f?.temaId,
      etiquetas: [], origen: 'ia', ...extra,
      frase: c.frase ?? '', verificada: !!f && !!c.frase && fraseEnTexto(c.frase, f.texto),
    })
  }
  return salida
}

async function llamar(frags: Fragmento[], cantidad: number, tipos: TiposPedidos, foco?: { titulo: string; texto: string }, existentes?: string[]) {
  const etiquetas = await Promise.all(frags.map(etiquetaFragmento))
  const prompt = armarPromptTarjetas({ fragmentos: frags.map((f, i) => ({ texto: f.texto, etiqueta: etiquetas[i] })), cantidad, tipos, foco, existentes })
  const r = await iaJSON<{ tarjetas?: TarjetaIA[] }>([{ rol: 'usuario', texto: prompt }], ESQUEMA_TARJETAS, {
    sistema: SISTEMA_TARJETAS, uso: 'lote', funcion: 'tarjetas', temperatura: 0.4,
  })
  return aPropuestas(r.tarjetas ?? [], frags)
}

const resumenTarjeta = (t: Tarjeta) => (t.tipo === 'cloze' ? (t.cloze ?? '') : t.frente).slice(0, 120)

/** Genera propuestas (no guarda nada: la vista previa decide qué se acepta). */
export async function generarTarjetas(origen: OrigenGeneracion, cantidad: number, tipos: TiposPedidos, alProgreso?: (hechos: number, total: number) => void): Promise<Propuesta[]> {
  const todas = await repoTarjetas.todas()

  if (origen.tipo === 'alcance') {
    const lista = await repoFragmentos.enAlcance(origen.alcance)
    if (!lista.length) throw new Error('No hay material procesado en ese alcance. Cargá o procesá fuentes primero.')
    const porFragmento = new Map<string, number>()
    for (const t of todas) if (t.fragmentoId) porFragmento.set(t.fragmentoId, (porFragmento.get(t.fragmentoId) ?? 0) + 1)
    const lotes = Math.ceil(cantidad / TARJETAS_POR_LOTE)
    const elegidos = elegirFragmentos(lista, Math.min(lista.length, lotes * FRAGMENTOS_POR_LOTE, Math.max(3, Math.ceil(cantidad * 0.7))), porFragmento)
    const existentes = todas.filter((t) => t.fragmentoId && elegidos.some((f) => f.id === t.fragmentoId)).map(resumenTarjeta)
    const salida: Propuesta[] = []
    for (let i = 0; i < lotes; i++) {
      alProgreso?.(i, lotes)
      const frags = elegidos.filter((_, k) => k % lotes === i)
      if (!frags.length) continue
      const n = i === lotes - 1 ? cantidad - TARJETAS_POR_LOTE * (lotes - 1) : TARJETAS_POR_LOTE
      salida.push(...await llamar(frags, n, tipos, undefined, existentes))
    }
    alProgreso?.(lotes, lotes)
    return salida.slice(0, cantidad)
  }

  if (origen.tipo === 'seleccion') {
    const dePagina = (await repoFragmentos.dePagina(origen.fuenteId, origen.pagina)).sort((a, b) => a.inicio - b.inicio)
    // Fragmentos de la página que contienen la selección (o algún tramo); si no, la página entera.
    const tramos = origen.texto.split(/(?<=[.;:])\s+/).filter((t) => t.length > 25)
    const contienen = dePagina.filter((f) => buscarFrase(f.texto, origen.texto.slice(0, 80)) || tramos.some((t) => buscarFrase(f.texto, t.slice(0, 80))))
    const frags = (contienen.length ? contienen : dePagina).slice(0, 4)
    if (!frags.length) throw new Error('Esta página todavía no tiene fragmentos procesados.')
    return llamar(frags, cantidad, tipos, { titulo: 'SELECCIÓN DEL ESTUDIANTE', texto: origen.texto }, todas.filter((t) => frags.some((f) => f.id === t.fragmentoId)).map(resumenTarjeta))
  }

  const chat = await chats.obtener(origen.chatId)
  const m = chat?.mensajes.find((x) => x.id === origen.mensajeId)
  if (!m) throw new Error('No encontré esa respuesta del chat.')
  const citados = [...new Set((m.segmentos ?? []).flatMap((s) => s.citas.filter((c) => c.verificada && c.fragmentoId).map((c) => c.fragmentoId!)))]
  const ids = citados.length ? citados : (m.fragmentoIds ?? [])
  const frags = await repoFragmentos.varios(ids.slice(0, 10))
  if (!frags.length) throw new Error('Esa respuesta no tiene fragmentos de tus fuentes para respaldar tarjetas.')
  const pregunta = chat!.mensajes[chat!.mensajes.indexOf(m) - 1]?.texto ?? ''
  const texto = `Pregunta: ${pregunta}\nRespuesta: ${(m.segmentos ?? []).map((s) => s.texto).join('\n')}`
  return llamar(frags, cantidad, tipos, { titulo: 'RESPUESTA DEL CHAT', texto }, todas.filter((t) => frags.some((f) => f.id === t.fragmentoId)).map(resumenTarjeta))
}
