import { nuevoId } from '../repositorio/db'
import type { Mascara, Tarjeta, TipoTarjeta } from '../repositorio/tipos'
import { estadoNuevo, numerosCloze } from './fsrs'

/** Lo que se edita de una tarjeta (sin estado FSRS). Una nota cloze u oclusión genera varias tarjetas. */
export interface BorradorTarjeta {
  tipo: TipoTarjeta
  frente: string
  dorso: string
  cloze?: string
  imagenId?: string
  mascaras?: Mascara[]
  fragmentoId?: string
  fuenteId?: string
  pagina?: number
  unidadId?: string
  disciplinaId?: string
  temaId?: string
  etiquetas?: string[]
  origen?: Tarjeta['origen']
}

/** Clave que distingue a cada tarjeta dentro de su grupo (número de hueco o id de máscara). */
export function claveEnGrupo(t: Pick<Tarjeta, 'tipo' | 'clozeN' | 'mascara'>) {
  return t.tipo === 'cloze' ? `c${t.clozeN}` : t.tipo === 'oclusion' ? `m${t.mascara}` : 'b'
}

/** Claves que debería tener el grupo según el borrador. */
export function clavesDeBorrador(b: BorradorTarjeta): string[] {
  if (b.tipo === 'cloze') return numerosCloze(b.cloze ?? '').map((n) => `c${n}`)
  if (b.tipo === 'oclusion') return (b.mascaras ?? []).map((m) => `m${m.id}`)
  return ['b']
}

export function problemaBorrador(b: BorradorTarjeta): string | null {
  if (b.tipo === 'basica' && (!b.frente.trim() || !b.dorso.trim())) return 'Completá frente y dorso.'
  if (b.tipo === 'cloze' && !numerosCloze(b.cloze ?? '').length) return 'El texto necesita al menos un hueco: {{c1::respuesta}}.'
  if (b.tipo === 'oclusion' && (!b.imagenId || !b.mascaras?.length)) return 'Dibujá al menos una máscara sobre la imagen.'
  if (b.tipo === 'oclusion' && b.mascaras!.some((m) => !m.etiqueta.trim())) return 'Escribí qué hay debajo de cada máscara.'
  return null
}

/** Campos compartidos por todas las tarjetas del grupo. */
export function camposComunes(b: BorradorTarjeta) {
  return {
    tipo: b.tipo, frente: b.frente.trim(), dorso: b.dorso.trim(), cloze: b.tipo === 'cloze' ? b.cloze?.trim() : undefined,
    imagenId: b.tipo === 'oclusion' ? b.imagenId : undefined, mascaras: b.tipo === 'oclusion' ? b.mascaras : undefined,
    fragmentoId: b.fragmentoId, fuenteId: b.fuenteId, pagina: b.pagina, unidadId: b.unidadId, disciplinaId: b.disciplinaId,
    temaId: b.temaId, etiquetas: b.etiquetas ?? [],
  }
}

/** Tarjeta nueva para una clave de grupo (estado FSRS "nueva"). */
export function tarjetaDeClave(b: BorradorTarjeta, clave: string, grupoId: string | undefined, ahora = Date.now()): Tarjeta {
  const e = estadoNuevo(ahora)
  return {
    ...camposComunes(b),
    id: nuevoId('t-'), grupoId,
    clozeN: clave.startsWith('c') ? Number(clave.slice(1)) : undefined,
    mascara: clave.startsWith('m') ? clave.slice(1) : undefined,
    origen: b.origen ?? 'manual',
    vence: e.due, estado: e.state, fsrs: e, creada: ahora, actualizada: ahora,
  }
}

/** Borrador → tarjetas: una por hueco (cloze) o por máscara (oclusión). */
export function armarTarjetas(b: BorradorTarjeta, ahora = Date.now()): Tarjeta[] {
  const claves = clavesDeBorrador(b)
  const grupoId = claves.length > 1 ? nuevoId('g-') : undefined
  return claves.map((c) => tarjetaDeClave(b, c, grupoId, ahora))
}

export function borradorDe(t: Tarjeta): BorradorTarjeta {
  return {
    tipo: t.tipo, frente: t.frente, dorso: t.dorso, cloze: t.cloze, imagenId: t.imagenId, mascaras: t.mascaras,
    fragmentoId: t.fragmentoId, fuenteId: t.fuenteId, pagina: t.pagina, unidadId: t.unidadId, disciplinaId: t.disciplinaId,
    temaId: t.temaId, etiquetas: t.etiquetas, origen: t.origen,
  }
}

/** Texto plano de una tarjeta (para búsqueda, listas y exportación). */
export function textoPlano(t: Pick<Tarjeta, 'tipo' | 'frente' | 'dorso' | 'cloze' | 'mascaras'>) {
  if (t.tipo === 'cloze') return `${(t.cloze ?? '').replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/gs, '$1')} ${t.dorso}`.trim()
  if (t.tipo === 'oclusion') return `${t.frente} ${(t.mascaras ?? []).map((m) => m.etiqueta).join(', ')} ${t.dorso}`.trim()
  return `${t.frente} — ${t.dorso}`
}
