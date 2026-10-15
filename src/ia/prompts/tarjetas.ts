import type { EsquemaJSON } from '../proveedor'

/** Generación de tarjetas por lotes (modelo barato, salida JSON). */

export type TiposPedidos = 'ambas' | 'basica' | 'cloze'

export const SISTEMA_TARJETAS = `Sos un docente de Medicina que arma tarjetas de repetición espaciada (tipo Anki) SOLO con la información de los fragmentos [F1]…[Fn] de las fuentes del estudiante.
Reglas obligatorias:
1. Una sola idea por tarjeta (atómica): un dato, una definición, un mecanismo, una relación causa-efecto, un valor normal. Nada de listas largas.
2. Usá únicamente lo que dicen los fragmentos. No inventes datos ni agregues conocimiento externo.
3. Tipos:
   - "basica": "frente" es una pregunta concreta y sin ambigüedad (nunca de sí/no); "dorso" es la respuesta corta (idealmente menos de 25 palabras).
   - "cloze": "cloze" es UNA oración del tema con el dato clave entre {{c1::…}} (podés usar {{c2::…}} solo si son datos de la misma idea). El hueco debe ser el concepto importante, no un artículo ni una palabra obvia.
4. "f" es el número del fragmento que respalda la tarjeta y "frase" es una FRASE TEXTUAL EXACTA de ese fragmento (6 a 25 palabras, copiada carácter por carácter) que justifica la respuesta.
5. Cifras, valores de referencia, fórmulas y unidades: solo si están en el fragmento, tal cual.
6. Priorizá lo que se pregunta en un parcial: mecanismos, regulación, valores normales, definiciones, relaciones entre disciplinas. Evitá datos triviales (autores, años de ediciones, números de página, bibliografía, consignas de actividades).
7. Español rioplatense, terminología médica correcta. No repitas tarjetas que ya existen (se listan si las hay).`

export const ESQUEMA_TARJETAS: EsquemaJSON = {
  type: 'object',
  properties: {
    tarjetas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['basica', 'cloze'] },
          frente: { type: 'string', description: 'Pregunta (solo tipo basica).' },
          dorso: { type: 'string', description: 'Respuesta (basica) o dato extra opcional (cloze).' },
          cloze: { type: 'string', description: 'Oración con {{c1::…}} (solo tipo cloze).' },
          f: { type: 'integer', description: 'Número del fragmento que la respalda (F1 → 1).' },
          frase: { type: 'string', description: 'Frase textual exacta del fragmento.' },
        },
        required: ['tipo', 'f', 'frase'],
      },
    },
  },
  required: ['tarjetas'],
}

export interface TarjetaIA {
  tipo: 'basica' | 'cloze'
  frente?: string
  dorso?: string
  cloze?: string
  f: number
  frase: string
}

const INSTRUCCION_TIPOS: Record<TiposPedidos, string> = {
  ambas: 'Combiná tarjetas "basica" y "cloze" según convenga a cada dato (más o menos mitad y mitad).',
  basica: 'Todas las tarjetas deben ser de tipo "basica".',
  cloze: 'Todas las tarjetas deben ser de tipo "cloze".',
}

export function armarPromptTarjetas(op: {
  fragmentos: { texto: string; etiqueta: string }[]
  cantidad: number
  tipos: TiposPedidos
  /** Texto en el que hay que enfocarse (selección del visor o respuesta del chat). */
  foco?: { titulo: string; texto: string }
  existentes?: string[]
}) {
  const bloques = op.fragmentos.map((f, i) => `[F${i + 1}] (${f.etiqueta})\n${f.texto}`).join('\n\n---\n\n')
  const foco = op.foco ? `\n\n${op.foco.titulo} (las tarjetas tienen que salir de ESTO; citá el fragmento que lo respalda):\n${op.foco.texto}` : ''
  const ya = op.existentes?.length ? `\n\nTARJETAS QUE YA EXISTEN (no las repitas):\n- ${op.existentes.slice(0, 40).join('\n- ')}` : ''
  return `FRAGMENTOS DE LAS FUENTES:\n\n${bloques}${foco}${ya}\n\n---\n\nArmá hasta ${op.cantidad} tarjetas (menos si el material no da para más sin repetir ni inventar). ${INSTRUCCION_TIPOS[op.tipos]} Repartilas entre los distintos fragmentos.`
}
