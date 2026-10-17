import type { EsquemaJSON } from '../proveedor'

/** Tablas comparativas y mapas conceptuales con una cita por celda o por nodo. */

const REGLAS_CITA = `"f" es el número del fragmento que respalda ese texto y "frase" una FRASE TEXTUAL EXACTA de ese fragmento (6 a 25 palabras, copiada carácter por carácter). Si un dato no está en los fragmentos, escribí "No figura en tus fuentes" con f = 0 y frase vacía. Nunca inventes datos.`

export const SISTEMA_TABLA = `Sos un docente de Medicina que arma TABLAS COMPARATIVAS SOLO con la información de los fragmentos [F1]…[Fn] de las fuentes del estudiante.
Reglas obligatorias:
1. "columnas": 2 a 4 cosas que se comparan. "filas": 3 a 8 aspectos de comparación (estructura, función, localización, regulación, valores…).
2. Cada celda: texto breve (menos de 20 palabras), con su cita. ${REGLAS_CITA}
3. Español rioplatense, terminología médica correcta.`

export const SISTEMA_MAPA = `Sos un docente de Medicina que arma MAPAS CONCEPTUALES SOLO con la información de los fragmentos [F1]…[Fn] de las fuentes del estudiante.
Reglas obligatorias:
1. "nodos": 6 a 14 conceptos, cada uno breve (1 a 8 palabras), con un "id" corto único (n1, n2…). El primero es el concepto central.
2. "relaciones": de un nodo a otro, con una "etiqueta" corta que forme una proposición ("regula", "está formado por", "aumenta", "se mide con"). Todos los nodos conectados.
3. Cada nodo lleva su cita. ${REGLAS_CITA}
4. Español rioplatense, terminología médica correcta.`

const CITA = { f: { type: 'integer' }, frase: { type: 'string' } } as const

export const ESQUEMA_TABLA: EsquemaJSON = {
  type: 'object',
  properties: {
    titulo: { type: 'string' },
    columnas: { type: 'array', items: { type: 'string' } },
    filas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          aspecto: { type: 'string' },
          celdas: { type: 'array', items: { type: 'object', properties: { texto: { type: 'string' }, ...CITA }, required: ['texto', 'f', 'frase'] } },
        },
        required: ['aspecto', 'celdas'],
      },
    },
  },
  required: ['titulo', 'columnas', 'filas'],
}

export const ESQUEMA_MAPA: EsquemaJSON = {
  type: 'object',
  properties: {
    titulo: { type: 'string' },
    nodos: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, texto: { type: 'string' }, ...CITA }, required: ['id', 'texto', 'f', 'frase'] } },
    relaciones: { type: 'array', items: { type: 'object', properties: { desde: { type: 'string' }, hasta: { type: 'string' }, etiqueta: { type: 'string' } }, required: ['desde', 'hasta', 'etiqueta'] } },
  },
  required: ['titulo', 'nodos', 'relaciones'],
}

export interface TextoCitadoIA { texto: string; f: number; frase: string }
export interface TablaIA { titulo?: string; columnas?: string[]; filas?: { aspecto: string; celdas?: TextoCitadoIA[] }[] }
export interface MapaIA { titulo?: string; nodos?: (TextoCitadoIA & { id: string })[]; relaciones?: { desde: string; hasta: string; etiqueta: string }[] }

export function armarPromptEsquema(tipo: 'tabla' | 'mapa', consigna: string, fragmentos: { texto: string; etiqueta: string }[]) {
  const bloques = fragmentos.map((f, i) => `[F${i + 1}] (${f.etiqueta})\n${f.texto}`).join('\n\n---\n\n')
  return `FRAGMENTOS DE LAS FUENTES:\n\n${bloques}\n\n---\n\n${tipo === 'tabla' ? 'TABLA COMPARATIVA' : 'MAPA CONCEPTUAL'} PEDIDO POR EL ESTUDIANTE: ${consigna}`
}
