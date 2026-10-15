import type { EsquemaJSON } from '../proveedor'

/** Modos de respuesta del chat (botones). */
export const MODOS_CHAT = {
  normal: { etiqueta: 'Normal', instruccion: 'Respondé de forma clara y completa, en párrafos breves.' },
  simple: { etiqueta: 'Explicámelo simple', instruccion: 'Explicalo simple, como a alguien que lo ve por primera vez, con una analogía si ayuda, sin perder exactitud.' },
  parcial: { etiqueta: 'Nivel parcial', instruccion: 'Respondé como se espera en un parcial de la carrera: terminología precisa, mecanismos y relaciones causa-efecto.' },
  clave: { etiqueta: 'Solo puntos clave', instruccion: 'Respondé solo con los puntos clave, cada uno en un segmento corto (una idea por segmento).' },
  tabla: { etiqueta: 'Tabla comparativa', instruccion: 'Armá una tabla comparativa en Markdown en UN solo segmento (citá en ese segmento todas las frases usadas); si hace falta, agregá un segmento breve de cierre.' },
} as const
export type ModoChat = keyof typeof MODOS_CHAT

export const SISTEMA_CHAT = `Sos un tutor de Medicina que responde SOLO con la información de los fragmentos de las fuentes del estudiante.
Reglas obligatorias:
1. Usá únicamente lo que dicen los fragmentos [F1]…[Fn]. No inventes datos.
2. Dividí la respuesta en segmentos (una o dos oraciones, o un ítem de lista, o una tabla). Cada segmento lleva sus citas.
3. Cada cita indica el número de fragmento (f) y la FRASE TEXTUAL EXACTA copiada del fragmento que respalda el segmento (entre 6 y 30 palabras, copiada carácter por carácter, sin reformular). Podés usar "..." para omitir una parte del medio.
4. Valores de referencia, fórmulas, cifras y unidades NUNCA van sin cita.
5. Si los fragmentos no alcanzan para responder, decilo en un segmento sin citas y marcá "sinInformacion": true.
6. Si agregás conocimiento general que NO está en los fragmentos, ponelo SOLO en "fueraDeFuentes" (breve). Nunca lo mezcles con los segmentos citados.
7. Español rioplatense, terminología médica correcta. No uses marcas [F1] dentro del texto: las citas van en el campo "citas".
8. Nunca des indicaciones clínicas para pacientes reales.`

export const ESQUEMA_CHAT: EsquemaJSON = {
  type: 'object',
  properties: {
    respuesta: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          texto: { type: 'string', description: 'Texto del segmento, puede tener Markdown simple.' },
          citas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                f: { type: 'integer', description: 'Número del fragmento citado (F1 → 1).' },
                frase: { type: 'string', description: 'Frase textual exacta del fragmento.' },
              },
              required: ['f', 'frase'],
            },
          },
        },
        required: ['texto', 'citas'],
      },
    },
    fueraDeFuentes: { type: 'string', description: 'Conocimiento general que no está en los fragmentos; vacío si no hay.' },
    sinInformacion: { type: 'boolean' },
  },
  required: ['respuesta'],
}

export function armarPromptChat(pregunta: string, fragmentos: { texto: string; etiqueta: string }[], modo: ModoChat, historial = '') {
  const bloques = fragmentos.map((f, i) => `[F${i + 1}] (${f.etiqueta})\n${f.texto}`).join('\n\n---\n\n')
  return `${historial ? `Contexto de la conversación previa (no es fuente):\n${historial}\n\n` : ''}FRAGMENTOS DE LAS FUENTES:\n\n${bloques}\n\n---\n\nMODO: ${MODOS_CHAT[modo].instruccion}\n\nPREGUNTA DEL ESTUDIANTE: ${pregunta}`
}
