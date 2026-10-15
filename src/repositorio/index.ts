import { paqueteActivo } from '../contenido'
import { db, nuevoId } from './db'
import {
  armarTarjetas, camposComunes, claveEnGrupo, clavesDeBorrador, tarjetaDeClave, type BorradorTarjeta,
} from '../tarjetas/crear'
import type {
  Alcance, Chat, ContenidoGuia, EstadoFSRS, EstructuraAtlas, Evento, FichaEditada, Fragmento, Fuente, ImagenTarjeta, Nota, Pagina, Resaltado, Tarjeta, Tema, UsoIA,
} from './tipos'

export { nuevoId }
export type * from './tipos'

// ───────────────────────── Ajustes ─────────────────────────

export interface Ajustes {
  proveedorIA: 'gemini' | 'groq'
  claveIA: string
  claveGroq: string
  modeloChat: string
  modeloLote: string
  fechasParciales: Record<string, string>
  bienvenidaCompleta: boolean
  ultimoBackup: number
  retencion: number
  nuevasPorDia: number
  limiteDiarioIA: number
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  proveedorIA: 'gemini',
  claveIA: '',
  claveGroq: '',
  // Verificados en ai.google.dev (oct. 2026): Flash y Flash-Lite con nivel gratuito.
  modeloChat: 'gemini-3.8-flash',
  modeloLote: 'gemini-3.5-flash-lite',
  fechasParciales: {},
  bienvenidaCompleta: false,
  ultimoBackup: 0,
  retencion: 0.9,
  nuevasPorDia: 25,
  limiteDiarioIA: 0,
}

export async function leerAjustes(): Promise<Ajustes> {
  const filas = await db.ajustes.toArray()
  const a: Record<string, unknown> = { ...AJUSTES_POR_DEFECTO }
  for (const f of filas) a[f.clave] = f.valor
  return a as unknown as Ajustes
}

export async function guardarAjuste<K extends keyof Ajustes>(clave: K, valor: Ajustes[K]) {
  await db.ajustes.put({ clave, valor })
}

// ───────────────────────── Temas ─────────────────────────

/** Siembra el árbol de temas del paquete activo (solo agrega los que faltan; respeta ediciones). */
export async function sembrarTemas() {
  const existentes = new Set(await db.temas.toCollection().primaryKeys())
  const nuevos: Tema[] = paqueteActivo.temas
    .filter((t) => !existentes.has(t.id))
    .map((t, i) => ({ ...t, orden: i, origen: 'paquete' as const }))
  if (nuevos.length) await db.temas.bulkAdd(nuevos)
}

export const temas = {
  todos: () => db.temas.toArray().then((ts) => ts.filter((t) => !t.oculto).sort((a, b) => a.orden - b.orden)),
  deUnidad: (unidadId: string) => db.temas.where('unidadId').equals(unidadId).toArray().then((ts) => ts.filter((t) => !t.oculto).sort((a, b) => a.orden - b.orden)),
  obtener: (id: string) => db.temas.get(id),
  async crear(unidadId: string, disciplinaId: string, nombre: string) {
    const orden = (await db.temas.count()) + 1000
    const t: Tema = { id: nuevoId('tema-'), unidadId, disciplinaId, nombre, orden, origen: 'usuario' }
    await db.temas.add(t)
    return t
  },
  renombrar: (id: string, nombre: string) => db.temas.update(id, { nombre }),
  /** Los temas del paquete se ocultan (para no volver a sembrarlos); los del usuario se borran. */
  async borrar(id: string) {
    const t = await db.temas.get(id)
    if (!t) return
    if (t.origen === 'paquete') await db.temas.update(id, { oculto: true })
    else await db.temas.delete(id)
  },
}

export const contenidoGuia = {
  todo: () => db.contenidoGuia.toArray(),
  deUnidad: (unidadId: string) => db.contenidoGuia.get(unidadId),
  guardar: (c: ContenidoGuia[]) => db.contenidoGuia.bulkPut(c),
}

// ───────────────────────── Fuentes ─────────────────────────

export const fuentes = {
  todas: () => db.fuentes.orderBy('creada').toArray(),
  obtener: (id: string) => db.fuentes.get(id),
  async crear(f: Omit<Fuente, 'id' | 'creada' | 'estado' | 'progreso' | 'paginas' | 'unidadIds'>) {
    const fuente: Fuente = { ...f, id: nuevoId('f-'), creada: Date.now(), estado: 'en_cola', progreso: 0, paginas: 0, unidadIds: [] }
    await db.fuentes.add(fuente)
    return fuente
  },
  actualizar: (id: string, cambios: Partial<Fuente>) => db.fuentes.update(id, cambios),
  renombrar: (id: string, nombre: string) => db.fuentes.update(id, { nombre }),
  async borrar(id: string) {
    await db.transaction('rw', [db.fuentes, db.paginas, db.fragmentos, db.resaltados, db.contenidoGuia], async () => {
      await db.fuentes.delete(id)
      await db.paginas.where('fuenteId').equals(id).delete()
      await db.fragmentos.where('fuenteId').equals(id).delete()
      await db.resaltados.where('fuenteId').equals(id).delete()
      await db.contenidoGuia.filter((c) => c.fuenteId === id).delete()
    })
  },
  guia: () => db.fuentes.filter((f) => f.esGuia).first(),
}

export const paginas = {
  obtener: (fuenteId: string, numero: number) => db.paginas.get([fuenteId, numero]),
  deFuente: (fuenteId: string) => db.paginas.where('fuenteId').equals(fuenteId).sortBy('numero'),
  guardar: (p: Pagina[]) => db.paginas.bulkPut(p),
}

// ───────────────────────── Fragmentos ─────────────────────────

export const fragmentos = {
  todos: () => db.fragmentos.toArray(),
  contar: () => db.fragmentos.count(),
  obtener: (id: string) => db.fragmentos.get(id),
  varios: (ids: string[]) => db.fragmentos.bulkGet(ids).then((fs) => fs.filter((f): f is Fragmento => !!f)),
  deFuente: (fuenteId: string) => db.fragmentos.where('fuenteId').equals(fuenteId).toArray(),
  dePagina: (fuenteId: string, pagina: number) => db.fragmentos.where('[fuenteId+pagina]').equals([fuenteId, pagina]).toArray(),
  async reemplazarDeFuente(fuenteId: string, nuevos: Fragmento[]) {
    await db.transaction('rw', db.fragmentos, async () => {
      await db.fragmentos.where('fuenteId').equals(fuenteId).delete()
      await db.fragmentos.bulkAdd(nuevos)
    })
  },
  guardarEmbeddings: (lista: { id: string; embedding: Float32Array }[]) =>
    db.fragmentos.bulkUpdate(lista.map((l) => ({ key: l.id, changes: { embedding: l.embedding } }))),
  /** Actualiza fragmentos; si cambian unidad/disciplina/tema, se completan en sus tarjetas que no los tengan. */
  async actualizarVarios(lista: ({ id: string } & Partial<Fragmento>)[]) {
    await db.fragmentos.bulkUpdate(lista.map(({ id, ...changes }) => ({ key: id, changes })))
    const porFragmento = new Map(lista.map((c) => [c.id, c]))
    await db.tarjetas.where('fragmentoId').anyOf([...porFragmento.keys()]).modify((t) => {
      const c = porFragmento.get(t.fragmentoId!)!
      if (t.temaId) return
      if (c.temaId) t.temaId = c.temaId
      if (c.unidadId && !t.unidadId) t.unidadId = c.unidadId
      if (c.disciplinaId && !t.disciplinaId) t.disciplinaId = c.disciplinaId
    })
  },
  /** Fragmentos dentro de un alcance de estudio. */
  async enAlcance(a: Alcance): Promise<Fragmento[]> {
    switch (a.tipo) {
      case 'unidad': return db.fragmentos.where('unidadId').equals(a.unidadId ?? '').toArray()
      case 'disciplina': return db.fragmentos.where('disciplinaId').equals(a.disciplinaId ?? '').toArray()
      case 'tema': return db.fragmentos.where('temaId').equals(a.temaId ?? '').toArray()
      case 'fuentes': return db.fragmentos.where('fuenteId').anyOf(a.fuenteIds ?? []).toArray()
      default: return db.fragmentos.toArray()
    }
  },
}

// ───────────────────────── Chats ─────────────────────────

export const chats = {
  todos: () => db.chats.orderBy('actualizado').reverse().toArray(),
  obtener: (id: string) => db.chats.get(id),
  async crear(alcance: Alcance, titulo = 'Nueva conversación') {
    const c: Chat = { id: nuevoId('c-'), titulo, alcance, mensajes: [], creado: Date.now(), actualizado: Date.now() }
    await db.chats.add(c)
    return c
  },
  guardar: (c: Chat) => db.chats.put({ ...c, actualizado: Date.now() }),
  borrar: (id: string) => db.chats.delete(id),
}

// ───────────────────────── Notas ─────────────────────────

export const notas = {
  todas: () => db.notas.orderBy('actualizada').reverse().toArray(),
  obtener: (id: string) => db.notas.get(id),
  async crear(n: Partial<Nota> & { titulo: string; markdown: string }) {
    const nota: Nota = { temaIds: [], fragmentoIds: [], origen: 'manual', ...n, id: nuevoId('n-'), creada: Date.now(), actualizada: Date.now() }
    await db.notas.add(nota)
    return nota
  },
  guardar: (n: Nota) => db.notas.put({ ...n, actualizada: Date.now() }),
  borrar: (id: string) => db.notas.delete(id),
}

// ───────────────────────── Resaltados ─────────────────────────

export const resaltados = {
  dePagina: (fuenteId: string, pagina: number) => db.resaltados.where('[fuenteId+pagina]').equals([fuenteId, pagina]).toArray(),
  deFuente: (fuenteId: string) => db.resaltados.where('fuenteId').equals(fuenteId).toArray(),
  async crear(r: Omit<Resaltado, 'id' | 'creado'>) {
    const nuevo: Resaltado = { ...r, id: nuevoId('r-'), creado: Date.now() }
    await db.resaltados.add(nuevo)
    return nuevo
  },
  actualizar: (id: string, c: Partial<Resaltado>) => db.resaltados.update(id, c),
  borrar: (id: string) => db.resaltados.delete(id),
}

// ───────────────────────── Uso de IA y caché ─────────────────────────

export function hoyISO(d = new Date()) {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

export const usoIA = {
  hoy: async (): Promise<UsoIA> => (await db.usoIA.get(hoyISO())) ?? { fecha: hoyISO(), llamadas: 0, tokens: 0 },
  async sumar(tokens: number) {
    const u = await usoIA.hoy()
    await db.usoIA.put({ ...u, llamadas: u.llamadas + 1, tokens: u.tokens + tokens })
  },
  async marcarAgotado() {
    const u = await usoIA.hoy()
    await db.usoIA.put({ ...u, agotado: true })
  },
  historial: () => db.usoIA.toArray(),
}

export const cacheIA = {
  async leer(hash: string) {
    const c = await db.cacheIA.get(hash)
    // 30 días de vida
    if (c && Date.now() - c.fecha < 30 * 864e5) return c.respuesta
    return undefined
  },
  guardar: (hash: string, respuesta: string) => db.cacheIA.put({ hash, respuesta, fecha: Date.now() }),
  vaciar: () => db.cacheIA.clear(),
}

// ───────────────────────── Estadísticas locales ─────────────────────────

export const eventos = {
  registrar: (tipo: string, detalle?: string, duracion?: number) =>
    db.eventos.add({ tipo, detalle, duracion, fecha: Date.now() } as Evento),
  todos: () => db.eventos.toArray(),
}

// ───────────────────────── Tarjetas (Fase 2) ─────────────────────────

export const tarjetas = {
  todas: () => db.tarjetas.toArray(),
  contar: () => db.tarjetas.count(),
  obtener: (id: string) => db.tarjetas.get(id),
  deGrupo: (t: Tarjeta) => (t.grupoId ? db.tarjetas.filter((x) => x.grupoId === t.grupoId).toArray() : Promise.resolve([t])),
  deFragmento: (fragmentoId: string) => db.tarjetas.where('fragmentoId').equals(fragmentoId).toArray(),
  async crear(borradores: BorradorTarjeta[]) {
    const nuevas = borradores.flatMap((b) => armarTarjetas(b))
    await db.tarjetas.bulkAdd(nuevas)
    return nuevas
  },
  /** Agrega tarjetas ya armadas (importar CSV). */
  agregar: (ts: Tarjeta[]) => db.tarjetas.bulkAdd(ts),
  /**
   * Guarda la edición de una tarjeta y sus hermanas: los campos comunes se copian a todo el grupo;
   * si aparece un hueco/máscara nuevo se crea su tarjeta y si se quitó uno se borra (conservando el FSRS del resto).
   */
  async editar(t: Tarjeta, b: BorradorTarjeta) {
    const grupo = await tarjetas.deGrupo(t)
    const claves = clavesDeBorrador(b)
    const existentes = new Map(grupo.map((x) => [claveEnGrupo(x), x]))
    const grupoId = t.grupoId ?? (claves.length > 1 ? nuevoId('g-') : undefined)
    const ahora = Date.now()
    await db.transaction('rw', db.tarjetas, async () => {
      for (const [clave, x] of existentes) if (!claves.includes(clave)) await db.tarjetas.delete(x.id)
      for (const clave of claves) {
        const x = existentes.get(clave)
        if (x) await db.tarjetas.put({ ...x, ...camposComunes(b), grupoId, actualizada: ahora })
        else await db.tarjetas.add(tarjetaDeClave(b, clave, grupoId, ahora))
      }
    })
  },
  suspender: (id: string, suspendida: boolean) => db.tarjetas.update(id, { suspendida }),
  /** Borra la tarjeta y todas sus hermanas (la "nota" entera), con su historial. */
  async borrar(t: Tarjeta) {
    const grupo = await tarjetas.deGrupo(t)
    const ids = grupo.map((x) => x.id)
    await db.transaction('rw', [db.tarjetas, db.revisiones, db.imagenesTarjeta], async () => {
      await db.tarjetas.bulkDelete(ids)
      await db.revisiones.where('tarjetaId').anyOf(ids).delete()
      if (t.imagenId && !(await db.tarjetas.where('imagenId').equals(t.imagenId).count())) await db.imagenesTarjeta.delete(t.imagenId)
    })
  },
  /** Guarda una respuesta del repaso: estado FSRS nuevo + log + evento para estadísticas. */
  async responder(t: Tarjeta, calificacion: number, nuevo: EstadoFSRS, duracion?: number) {
    const ahora = Date.now()
    await db.transaction('rw', [db.tarjetas, db.revisiones, db.eventos], async () => {
      await db.tarjetas.update(t.id, { fsrs: nuevo, vence: nuevo.due, estado: nuevo.state, actualizada: ahora })
      await db.revisiones.add({
        tarjetaId: t.id, fecha: ahora, calificacion, antes: t.fsrs, intervalo: nuevo.scheduled_days,
        estabilidad: nuevo.stability, dificultad: nuevo.difficulty, duracion,
      })
      await db.eventos.add({ tipo: 'repaso', detalle: String(calificacion), fecha: ahora, duracion: duracion ? Math.round(duracion / 1000) : undefined })
    })
  },
  /** Deshace el último repaso: vuelve la tarjeta al estado anterior. Devuelve la tarjeta. */
  async deshacerUltimo(): Promise<Tarjeta | undefined> {
    const r = await db.revisiones.orderBy('id').last()
    if (!r) return undefined
    const t = await db.tarjetas.get(r.tarjetaId)
    await db.transaction('rw', [db.tarjetas, db.revisiones, db.eventos], async () => {
      if (t) await db.tarjetas.update(t.id, { fsrs: r.antes, vence: r.antes.due, estado: r.antes.state })
      await db.revisiones.delete(r.id!)
      const ev = await db.eventos.where('tipo').equals('repaso').last()
      if (ev?.id !== undefined) await db.eventos.delete(ev.id)
    })
    return t ? { ...t, fsrs: r.antes, vence: r.antes.due, estado: r.antes.state } : undefined
  },
}

export const revisiones = {
  todas: () => db.revisiones.toArray(),
  desde: (fecha: number) => db.revisiones.where('fecha').aboveOrEqual(fecha).toArray(),
}

export const imagenesTarjeta = {
  async guardar(archivo: Blob, nombre?: string) {
    const img: ImagenTarjeta = { id: nuevoId('img-'), archivo, mime: archivo.type || 'image/png', nombre, creada: Date.now() }
    await db.imagenesTarjeta.add(img)
    return img
  },
  obtener: (id: string) => db.imagenesTarjeta.get(id),
  todas: () => db.imagenesTarjeta.toArray(),
  /** Borra imágenes que no quedaron usadas por ninguna tarjeta (ej. se canceló una oclusión) y tienen más de un día. */
  async limpiarHuerfanas() {
    const usadas = new Set(await db.tarjetas.orderBy('imagenId').uniqueKeys())
    const viejas = await db.imagenesTarjeta.filter((i) => !usadas.has(i.id) && Date.now() - i.creada > 864e5).primaryKeys()
    await db.imagenesTarjeta.bulkDelete(viejas)
  },
}

// ───────────────────────── Atlas 3D (Fase 3) ─────────────────────────

export const atlas = {
  estados: () => db.estructurasAtlas.toArray(),
  estado: (id: string) => db.estructurasAtlas.get(id),
  /** Estructuras ya practicadas que vencen hasta `hasta` (para "Hoy" y el Modo Museo). */
  vencidas: (hasta: number) => db.estructurasAtlas.where('vence').belowOrEqual(hasta).toArray(),
  /**
   * Guarda una respuesta del Modo Museo o de "¿Dónde está?": estado FSRS nuevo + evento
   * 'museo' para estadísticas y racha. `nuevo` lo calcula src/tarjetas/fsrs.ts.
   */
  async responder(id: string, escena: string, acierto: boolean, nuevo: EstadoFSRS) {
    const ahora = Date.now()
    await db.transaction('rw', [db.estructurasAtlas, db.eventos], async () => {
      const previo = await db.estructurasAtlas.get(id)
      await db.estructurasAtlas.put({
        id, escena, fsrs: nuevo, vence: nuevo.due, estado: nuevo.state,
        aciertos: (previo?.aciertos ?? 0) + (acierto ? 1 : 0), fallos: (previo?.fallos ?? 0) + (acierto ? 0 : 1), ultimo: ahora,
      })
      await db.eventos.add({ tipo: 'museo', detalle: `${id}:${acierto ? 'ok' : 'fallo'}`, fecha: ahora })
    })
  },
}

export const fichasAtlas = {
  todas: () => db.fichasEditadas.toArray(),
  obtener: (id: string) => db.fichasEditadas.get(id),
  guardar: (id: string, cambios: Record<string, string>, revisado: boolean) =>
    db.fichasEditadas.put({ id, cambios, revisado, actualizada: Date.now() } satisfies FichaEditada),
  restaurar: (id: string) => db.fichasEditadas.delete(id),
}

export type { EstructuraAtlas }

// ───────────────────────── Borrado total ─────────────────────────

export async function borrarTodo() {
  await db.delete()
  await db.open()
}

