import type { EsquemaJSON } from '../proveedor'

/** Preguntas de opción múltiple tipo parcial, generadas por lotes (modelo barato, salida JSON). */

export const SISTEMA_PREGUNTAS = `Sos un docente de Medicina que arma preguntas de opción múltiple tipo parcial SOLO con la información de los fragmentos [F1]…[Fn] de las fuentes del estudiante.
Reglas obligatorias:
1. Cada pregunta evalúa razonamiento, no memoria de un dato suelto: preferí una situación clínica breve o un planteo fisiológico ("Un paciente de 60 años… ¿qué esperás encontrar?", "Si se contrae la arteriola eferente…").
2. Entre 4 y 5 opciones, UNA sola correcta, todas plausibles, de largo parecido, sin "todas las anteriores" ni "ninguna".
3. Para CADA opción, una explicación breve de por qué es correcta o incorrecta.
4. "f" es el número del fragmento que respalda la respuesta correcta y "frase" una FRASE TEXTUAL EXACTA de ese fragmento (6 a 25 palabras, copiada carácter por carácter).
5. Usá únicamente lo que dicen los fragmentos: no inventes valores ni datos. Cifras y valores de referencia, solo si están en el fragmento.
6. Evitá preguntas sobre bibliografía, autores, consignas de actividades o la organización del curso.
7. Español rioplatense, terminología médica correcta. Nunca des indicaciones para pacientes reales.`

export const ESQUEMA_PREGUNTAS: EsquemaJSON = {
  type: 'object',
  properties: {
    preguntas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          enunciado: { type: 'string' },
          opciones: {
            type: 'array',
            items: {
              type: 'object',
              properties: { texto: { type: 'string' }, explicacion: { type: 'string' } },
              required: ['texto', 'explicacion'],
            },
          },
          correcta: { type: 'integer', description: 'Índice (desde 0) de la opción correcta.' },
          explicacion: { type: 'string', description: 'Explicación general de la respuesta.' },
          f: { type: 'integer', description: 'Número del fragmento que respalda la respuesta (F1 → 1).' },
          frase: { type: 'string', description: 'Frase textual exacta del fragmento.' },
        },
        required: ['enunciado', 'opciones', 'correcta', 'f', 'frase'],
      },
    },
  },
  required: ['preguntas'],
}

export interface PreguntaIA {
  enunciado: string
  opciones: { texto: string; explicacion: string }[]
  correcta: number
  explicacion?: string
  f: number
  frase: string
}

export function armarPromptPreguntas(op: {
  fragmentos: { texto: string; etiqueta: string }[]
  cantidad: number
  foco?: { titulo: string; texto: string }
  existentes?: string[]
}) {
  const bloques = op.fragmentos.map((f, i) => `[F${i + 1}] (${f.etiqueta})\n${f.texto}`).join('\n\n---\n\n')
  const foco = op.foco ? `\n\n${op.foco.titulo} (las preguntas tienen que salir de ESTO; citá el fragmento que lo respalda):\n${op.foco.texto}` : ''
  const ya = op.existentes?.length ? `\n\nPREGUNTAS QUE YA EXISTEN (no las repitas):\n- ${op.existentes.slice(0, 30).join('\n- ')}` : ''
  return `FRAGMENTOS DE LAS FUENTES:\n\n${bloques}${foco}${ya}\n\n---\n\nArmá hasta ${op.cantidad} preguntas de opción múltiple tipo parcial (menos si el material no da para más sin repetir ni inventar). Repartilas entre los distintos fragmentos.`
}
