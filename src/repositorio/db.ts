import Dexie, { type EntityTable } from 'dexie'
import type {
  Ajuste, CacheIA, Chat, ContenidoGuia, Evento, EstructuraAtlas, FichaEditada, Fragmento, Fuente, ImagenTarjeta, Intento, Pregunta, Nota, Pagina, Resaltado, Revision, Tarjeta, Tema, UsoIA,
} from './tipos'

/**
 * Base local (IndexedDB). Solo los módulos de src/repositorio/ importan este archivo:
 * así, para sumar cuentas y sincronización, se reemplaza esta capa sin tocar la UI.
 */
export class BaseEstudio extends Dexie {
  ajustes!: EntityTable<Ajuste, 'clave'>
  temas!: EntityTable<Tema, 'id'>
  contenidoGuia!: EntityTable<ContenidoGuia, 'unidadId'>
  fuentes!: EntityTable<Fuente, 'id'>
  paginas!: Dexie.Table<Pagina, [string, number]>
  fragmentos!: EntityTable<Fragmento, 'id'>
  chats!: EntityTable<Chat, 'id'>
  notas!: EntityTable<Nota, 'id'>
  resaltados!: EntityTable<Resaltado, 'id'>
  usoIA!: EntityTable<UsoIA, 'fecha'>
  cacheIA!: EntityTable<CacheIA, 'hash'>
  eventos!: EntityTable<Evento, 'id'>
  tarjetas!: EntityTable<Tarjeta, 'id'>
  revisiones!: EntityTable<Revision, 'id'>
  imagenesTarjeta!: EntityTable<ImagenTarjeta, 'id'>
  estructurasAtlas!: EntityTable<EstructuraAtlas, 'id'>
  fichasEditadas!: EntityTable<FichaEditada, 'id'>
  preguntas!: EntityTable<Pregunta, 'id'>
  intentos!: EntityTable<Intento, 'id'>

  constructor(nombre = 'estudio-med') {
    super(nombre)
    this.version(1).stores({
      ajustes: 'clave',
      temas: 'id, unidadId, disciplinaId',
      contenidoGuia: 'unidadId',
      fuentes: 'id, estado, creada',
      paginas: '[fuenteId+numero], fuenteId',
      fragmentos: 'id, fuenteId, unidadId, disciplinaId, temaId, [fuenteId+pagina]',
      chats: 'id, actualizado',
      notas: 'id, actualizada, *temaIds',
      resaltados: 'id, fuenteId, [fuenteId+pagina]',
      usoIA: 'fecha',
      cacheIA: 'hash, fecha',
      eventos: '++id, tipo, fecha',
    })
    // Fase 2: tarjetas con estado FSRS, log de repasos e imágenes de oclusión.
    this.version(2).stores({
      tarjetas: 'id, vence, estado, creada, unidadId, disciplinaId, temaId, fuenteId, fragmentoId, imagenId',
      revisiones: '++id, tarjetaId, fecha',
      imagenesTarjeta: 'id',
    })
    // Fase 3: repaso de estructuras del atlas (FSRS) y fichas editadas por el estudiante.
    this.version(3).stores({
      estructurasAtlas: 'id, vence, escena',
      fichasEditadas: 'id',
    })
    // Fase 4: banco de preguntas tipo parcial e intentos (práctica, simulacros y ejercicios numéricos).
    this.version(4).stores({
      preguntas: 'id, unidadId, disciplinaId, temaId, fragmentoId, creada',
      intentos: '++id, origen, preguntaId, unidadId, disciplinaId, temaId, simulacroId, fecha',
    })
  }
}

export const db = new BaseEstudio()

/** Tablas que se exportan en el respaldo (todas menos la caché de IA). */
export const TABLAS_RESPALDO = [
  'ajustes', 'temas', 'contenidoGuia', 'fuentes', 'paginas', 'fragmentos', 'chats', 'notas', 'resaltados', 'usoIA', 'eventos',
  'tarjetas', 'revisiones', 'imagenesTarjeta', 'estructurasAtlas', 'fichasEditadas', 'preguntas', 'intentos',
] as const
export type TablaRespaldo = (typeof TABLAS_RESPALDO)[number]

export function nuevoId(prefijo = '') {
  return prefijo + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))
}
