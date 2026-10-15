import { paqueteActivo } from '../contenido'
import { db, nuevoId } from './db'
import type {
  Alcance, Chat, ContenidoGuia, Evento, Fragmento, Fuente, Nota, Pagina, Resaltado, Tema, UsoIA,
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
  actualizarVarios: (lista: ({ id: string } & Partial<Fragmento>)[]) =>
    db.fragmentos.bulkUpdate(lista.map(({ id, ...changes }) => ({ key: id, changes }))),
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

// ───────────────────────── Borrado total ─────────────────────────

export async function borrarTodo() {
  await db.delete()
  await db.open()
}

