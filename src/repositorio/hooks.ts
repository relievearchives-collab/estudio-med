import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { leerAjustes, usoIA, type Ajustes } from './index'
import type { Chat, ContenidoGuia, EstructuraAtlas, FichaEditada, Fuente, ImagenTarjeta, Nota, Revision, Intento, Tarjeta, Tema, Tutoria, UsoIA } from './tipos'

/** Consultas reactivas para la UI (se actualizan solas cuando cambian los datos). */

export const useAjustes = (): Ajustes | undefined => useLiveQuery(leerAjustes, [])
export const useFuentes = (): Fuente[] | undefined => useLiveQuery(() => db.fuentes.orderBy('creada').toArray(), [])
export const useFuente = (id?: string): Fuente | undefined => useLiveQuery(() => (id ? db.fuentes.get(id) : undefined), [id])
export const useTemas = (): Tema[] | undefined =>
  useLiveQuery(() => db.temas.toArray().then((ts) => ts.filter((t) => !t.oculto).sort((a, b) => a.orden - b.orden)), [])
export const useContenidoGuia = (): ContenidoGuia[] | undefined => useLiveQuery(() => db.contenidoGuia.toArray(), [])
export const useChats = (): Chat[] | undefined => useLiveQuery(() => db.chats.orderBy('actualizado').reverse().toArray(), [])
export const useChat = (id?: string): Chat | undefined => useLiveQuery(() => (id ? db.chats.get(id) : undefined), [id])
export const useNotas = (): Nota[] | undefined => useLiveQuery(() => db.notas.orderBy('actualizada').reverse().toArray(), [])
export const useUsoIAHoy = (): UsoIA | undefined => useLiveQuery(() => usoIA.hoy(), [])
export const useConteoFragmentos = (): number | undefined => useLiveQuery(() => db.fragmentos.count(), [])
/** Conteo de fragmentos por unidad (para mostrar cuánto material hay en cada UP). */
export const useFragmentosPorUnidad = (): Record<string, number> | undefined =>
  useLiveQuery(async () => {
    const r: Record<string, number> = {}
    await db.fragmentos.each((f) => { if (f.unidadId) r[f.unidadId] = (r[f.unidadId] ?? 0) + 1 })
    return r
  }, [])

// ───────────────────────── Tarjetas (Fase 2) ─────────────────────────

export const useTarjetas = (): Tarjeta[] | undefined => useLiveQuery(() => db.tarjetas.orderBy('creada').reverse().toArray(), [])
export const useConteoTarjetas = (): number | undefined => useLiveQuery(() => db.tarjetas.count(), [])
/** Repasos desde una fecha (ms), para la cola del día, la racha y los temas flojos. */
export const useRevisionesDesde = (desde: number): Revision[] | undefined =>
  useLiveQuery(() => db.revisiones.where('fecha').aboveOrEqual(desde).toArray(), [desde])
export const useImagenTarjeta = (id?: string): ImagenTarjeta | undefined => useLiveQuery(() => (id ? db.imagenesTarjeta.get(id) : undefined), [id])

// ───────────────────────── Atlas (Fase 3) ─────────────────────────

export const useEstadosAtlas = (): EstructuraAtlas[] | undefined => useLiveQuery(() => db.estructurasAtlas.toArray(), [])
export const useFichaEditada = (id?: string): FichaEditada | undefined | null =>
  useLiveQuery(async () => (id ? ((await db.fichasEditadas.get(id)) ?? null) : null), [id])
export const useTutorias = (): Tutoria[] | undefined => useLiveQuery(() => db.tutorias.orderBy('actualizada').reverse().toArray(), [])
/** undefined mientras carga; null si no existe. */
export const useTutoria = (id?: string): Tutoria | undefined | null =>
  useLiveQuery(async () => (id ? ((await db.tutorias.get(id)) ?? null) : null), [id])
export const useIntentos = (): Intento[] | undefined => useLiveQuery(() => db.intentos.toArray(), [])
