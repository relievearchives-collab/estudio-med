/**
 * Interfaz común a todos los proveedores de IA. La app nunca llama a una API
 * directamente: siempre pasa por un ProveedorIA (ver cliente.ts).
 */
export interface MensajeIA {
  rol: 'usuario' | 'modelo'
  texto: string
}

export interface OpcionesIA {
  sistema?: string
  temperatura?: number
  /** 'chat' usa el modelo principal (Flash); 'lote' el más barato (Flash-Lite). */
  uso?: 'chat' | 'lote'
  maxTokens?: number
  senal?: AbortSignal
}

export interface RespuestaIA {
  texto: string
  tokens: number
}

/** Esquema JSON simple (subconjunto OpenAPI que aceptan Gemini y Groq). */
export interface EsquemaJSON {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean'
  properties?: Record<string, EsquemaJSON>
  items?: EsquemaJSON
  required?: string[]
  description?: string
  enum?: string[]
}

export interface ProveedorIA {
  id: string
  nombre: string
  chat(mensajes: MensajeIA[], opciones?: OpcionesIA): Promise<RespuestaIA>
  generarJSON(mensajes: MensajeIA[], esquema: EsquemaJSON, opciones?: OpcionesIA): Promise<RespuestaIA>
}

export class ErrorCuota extends Error {
  constructor(mensaje = 'Llegaste al límite gratis de hoy, se renueva mañana. Mientras tanto podés seguir con tarjetas, preguntas ya generadas, simuladores y el atlas 3D.') {
    super(mensaje)
    this.name = 'ErrorCuota'
  }
}

export class ErrorClave extends Error {
  constructor(mensaje = 'La clave de IA no es válida o no está cargada. Revisala en Ajustes.') {
    super(mensaje)
    this.name = 'ErrorClave'
  }
}

export class ErrorRed extends Error {
  constructor(mensaje = 'No hay conexión con el servicio de IA. Lo que no usa IA sigue funcionando sin internet.') {
    super(mensaje)
    this.name = 'ErrorRed'
  }
}

/** Extrae JSON de una respuesta aunque venga envuelta en ```json … ```. */
export function parsearJSON<T>(texto: string): T {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(limpio) as T
  } catch {
    const ini = limpio.search(/[[{]/)
    const fin = Math.max(limpio.lastIndexOf('}'), limpio.lastIndexOf(']'))
    if (ini >= 0 && fin > ini) return JSON.parse(limpio.slice(ini, fin + 1)) as T
    throw new Error('La IA devolvió una respuesta con formato inválido. Probá de nuevo.')
  }
}
