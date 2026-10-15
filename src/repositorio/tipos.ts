/** Entidades persistidas. La app accede a ellas SOLO a través de src/repositorio/. */

export type EstadoFuente = 'en_cola' | 'procesando' | 'listo' | 'error'
export type TipoFuente = 'pdf' | 'imagen' | 'texto'

export interface Fuente {
  id: string
  nombre: string
  tipo: TipoFuente
  esGuia: boolean
  /** Archivo original (PDF o imagen). En fuentes de texto pegado, undefined. */
  archivo?: Blob
  mime?: string
  paginas: number
  estado: EstadoFuente
  /** 0..1 */
  progreso: number
  etapa?: string
  error?: string
  creada: number
  /** Fecha del material, si el estudiante la indica (para alertar sobre material viejo). */
  fechaMaterial?: string
  unidadIds: string[]
}

export interface Pagina {
  fuenteId: string
  numero: number
  texto: string
  /** true si el texto salió de OCR. */
  ocr?: boolean
}

export interface Fragmento {
  id: string
  fuenteId: string
  pagina: number
  /** Posición [inicio, fin) dentro del texto de la página (ver procesamiento/textoPagina.ts). */
  inicio: number
  fin: number
  texto: string
  /** Último título detectado antes del fragmento. */
  titulo?: string
  palabras: number
  unidadId?: string
  disciplinaId?: string
  temaId?: string
  embedding?: Float32Array
}

export interface Tema {
  id: string
  unidadId: string
  disciplinaId: string
  nombre: string
  orden: number
  origen: 'paquete' | 'usuario'
  oculto?: boolean
}

export interface ContenidoGuia {
  unidadId: string
  situacion: string
  paginaSituacion: number
  objetivos: string
  paginaObjetivos: number
  fuenteId: string
}

export interface CitaVerificada {
  /** Número de fragmento en la respuesta (F1 → 1). */
  n: number
  fragmentoId?: string
  frase: string
  verificada: boolean
}

export interface Segmento {
  texto: string
  citas: CitaVerificada[]
  /** El segmento tiene cifras/fórmulas sin ninguna cita verificada. */
  cifraSinCita?: boolean
}

export interface MensajeChat {
  id: string
  rol: 'usuario' | 'ia'
  texto: string
  segmentos?: Segmento[]
  fueraDeFuentes?: string
  sinInformacion?: boolean
  fragmentoIds?: string[]
  modo?: string
  error?: string
  fecha: number
}

export interface Alcance {
  tipo: 'todo' | 'unidad' | 'disciplina' | 'tema' | 'fuentes'
  unidadId?: string
  disciplinaId?: string
  temaId?: string
  fuenteIds?: string[]
}

export interface Chat {
  id: string
  titulo: string
  alcance: Alcance
  mensajes: MensajeChat[]
  creado: number
  actualizado: number
}

export interface Nota {
  id: string
  titulo: string
  markdown: string
  temaIds: string[]
  fragmentoIds: string[]
  origen?: 'chat' | 'visor' | 'manual'
  creada: number
  actualizada: number
}

export interface Resaltado {
  id: string
  fuenteId: string
  pagina: number
  inicio: number
  fin: number
  texto: string
  color: 'amarillo' | 'verde' | 'rosa' | 'celeste'
  comentario?: string
  creado: number
}

export interface UsoIA {
  fecha: string
  llamadas: number
  tokens: number
  agotado?: boolean
}

export interface CacheIA {
  hash: string
  respuesta: string
  fecha: number
}

export interface Evento {
  id?: number
  tipo: string
  fecha: number
  detalle?: string
  /** segundos */
  duracion?: number
}

export interface Ajuste {
  clave: string
  valor: unknown
}
