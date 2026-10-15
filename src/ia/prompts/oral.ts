import type { EsquemaJSON } from '../proveedor'

/** Examen oral: preguntas con rúbrica (puntos clave) y evaluación de cada respuesta hablada. */

export const SISTEMA_ORAL_PREGUNTAS = `Sos un docente de Medicina que toma examen oral. Armás preguntas SOLO con la información de los fragmentos [F1]…[Fn] de las fuentes del estudiante.
Reglas obligatorias:
1. Preguntas abiertas de examen oral, para contestar hablando entre 30 segundos y 2 minutos: "Explicame…", "¿Qué pasa si…?", "¿Cómo se relaciona… con…?". Nada de sí/no ni de un dato suelto.
2. Para cada pregunta, entre 2 y 4 "puntos" clave: lo que una respuesta completa tiene que mencionar, cada uno breve (menos de 15 palabras) y sacado del fragmento.
3. "f" es el número del fragmento que respalda la pregunta y "frase" una FRASE TEXTUAL EXACTA de ese fragmento (6 a 25 palabras, copiada carácter por carácter).
4. Nada inventado: cifras y valores solo si están en el fragmento. Evitá bibliografía, autores, consignas o la organización del curso.
5. Español rioplatense, como habla un docente en un oral.`

export const ESQUEMA_ORAL_PREGUNTAS: EsquemaJSON = {
  type: 'object',
  properties: {
    preguntas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          enunciado: { type: 'string' },
          puntos: { type: 'array', items: { type: 'string' } },
          f: { type: 'integer', description: 'Número del fragmento (F1 → 1).' },
          frase: { type: 'string', description: 'Frase textual exacta del fragmento.' },
        },
        required: ['enunciado', 'puntos', 'f', 'frase'],
      },
    },
  },
  required: ['preguntas'],
}

export interface PreguntaOralIA {
  enunciado: string
  puntos: string[]
  f: number
  frase: string
}

const bloques = (fragmentos: { texto: string; etiqueta: string }[]) => fragmentos.map((f, i) => `[F${i + 1}] (${f.etiqueta})\n${f.texto}`).join('\n\n---\n\n')

export function armarPromptOralPreguntas(fragmentos: { texto: string; etiqueta: string }[], cantidad: number) {
  return `FRAGMENTOS DE LAS FUENTES:\n\n${bloques(fragmentos)}\n\n---\n\nArmá ${cantidad} preguntas de examen oral, cada una sobre un fragmento distinto si se puede.`
}

export const SISTEMA_ORAL_EVALUAR = `Sos el docente que toma un examen oral de Medicina. Evaluás la respuesta HABLADA del estudiante (viene de un dictado: puede tener palabras mal transcriptas; no lo penalices por eso).
Reglas obligatorias:
1. "cubiertos": números de los puntos clave (P1…Pn) que el estudiante explicó en alguna de sus respuestas. Aceptá sinónimos y explicaciones con otras palabras; no cuentes un punto solo por nombrar un término sin explicarlo.
2. "errores": solo errores conceptuales concretos que dijo (algo falso), cada uno en una oración. Lo que omitió NO es un error. Vacío si no hubo.
3. "repregunta": UNA pregunta corta que lo lleve hacia lo que le faltó, sin darle la respuesta (como repregunta un docente en el oral). Vacía si cubrió todo.
4. "devolucion": segmentos breves: qué estuvo bien, qué faltó y la corrección de cada error, con citas. Cada cita: número de fragmento (f) y FRASE TEXTUAL EXACTA del fragmento (6 a 30 palabras). Los datos salen SOLO de los fragmentos.
5. No pongas nota: la calcula la app. Español rioplatense, tono de docente exigente pero amable.`

export const ESQUEMA_ORAL_EVALUAR: EsquemaJSON = {
  type: 'object',
  properties: {
    cubiertos: { type: 'array', items: { type: 'integer' } },
    errores: { type: 'array', items: { type: 'string' } },
    repregunta: { type: 'string' },
    devolucion: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          texto: { type: 'string' },
          citas: {
            type: 'array',
            items: { type: 'object', properties: { f: { type: 'integer' }, frase: { type: 'string' } }, required: ['f', 'frase'] },
          },
        },
        required: ['texto', 'citas'],
      },
    },
  },
  required: ['cubiertos', 'errores', 'repregunta', 'devolucion'],
}

export interface EvaluacionOralIA {
  cubiertos?: number[]
  errores?: string[]
  repregunta?: string
  devolucion?: { texto: string; citas?: { f: number; frase: string }[] }[]
}

export function armarPromptOralEvaluar(op: {
  pregunta: string
  puntos: string[]
  turnos: { rol: 'examinador' | 'estudiante'; texto: string }[]
  fragmentos: { texto: string; etiqueta: string }[]
}) {
  const charla = op.turnos.map((t) => `${t.rol === 'examinador' ? 'DOCENTE' : 'ESTUDIANTE'}: ${t.texto}`).join('\n')
  return `FRAGMENTOS DE LAS FUENTES:\n\n${bloques(op.fragmentos)}\n\n---\n\nPREGUNTA: ${op.pregunta}\n\nPUNTOS CLAVE:\n${op.puntos.map((p, i) => `P${i + 1}. ${p}`).join('\n')}\n\nEXAMEN HASTA AHORA:\n${charla}`
}
