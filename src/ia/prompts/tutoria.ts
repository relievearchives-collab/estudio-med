import type { EsquemaJSON } from '../proveedor'

/** Tutoría ABP: tutor que pregunta, asignación de preguntas a temas, "te faltó…" y cierre integrador. */

export interface GuiaTemas {
  disciplina: string
  temas: string[]
}

const listaGuia = (guia: GuiaTemas[]) => guia.map((g) => `- ${g.disciplina}: ${g.temas.join('; ')}`).join('\n')

export function sistemaTutor(op: { unidad: string; situacion: string; ideas: string[]; hipotesis: string[]; guia: GuiaTemas[] }) {
  return `Sos tutor de una tutoría de Aprendizaje Basado en Problemas (ABP) de Medicina, unidad "${op.unidad}".
Tu trabajo es hacer pensar al estudiante, NO enseñarle.
Reglas obligatorias:
1. Nunca des respuestas, explicaciones, definiciones ni datos. Si te piden la respuesta, devolvé una pregunta que lo ayude a encontrarla o sugerí buscarla en la guía.
2. Cada turno: un comentario breve sobre lo que dijo (sin corregir con datos) y UNA o DOS preguntas abiertas. Máximo 80 palabras.
3. Partí de sus ideas e hipótesis y de la situación. Llevalo de a poco hacia los temas de cada disciplina de la GUÍA DEL TUTOR, sin nombrarlos de entrada ni leer la lista: que los descubra.
4. Cuando una disciplina todavía no apareció, orientá hacia ella con una pregunta sobre la situación ("¿Qué estructuras…?", "¿Qué pasa a nivel celular…?").
5. Animalo a convertir lo que no sabe en preguntas de aprendizaje. Si ya cubrió casi todas las disciplinas, sugerí pasar al paso "Preguntas de aprendizaje".
6. Español rioplatense, tono cálido de tutor. Nunca des indicaciones para pacientes reales.

SITUACIÓN PROBLEMÁTICA:
${op.situacion}

LLUVIA DE IDEAS DEL ESTUDIANTE:
${op.ideas.map((i) => `- ${i}`).join('\n') || '(sin ideas)'}

HIPÓTESIS DEL ESTUDIANTE:
${op.hipotesis.map((i) => `- ${i}`).join('\n') || '(sin hipótesis)'}

GUÍA DEL TUTOR (secreta, no la muestres): temas de la unidad por disciplina
${listaGuia(op.guia)}`
}

export const INICIO_TUTOR = 'Ya leí la situación e hice mi lluvia de ideas. Empezá la tutoría con tu primera pregunta.'

// ───────── Asignación de preguntas de aprendizaje a temas ─────────

export const SISTEMA_ASIGNAR = `Clasificás preguntas de aprendizaje de estudiantes de Medicina según los temas de una unidad.
Para cada pregunta, indicá los números de los temas (T1…Tn) que esa pregunta llevaría a estudiar. Puede ser ninguno o varios.
Sé estricto: asigná un tema solo si la pregunta realmente apunta a ese contenido, no por una palabra suelta.`

export const ESQUEMA_ASIGNAR: EsquemaJSON = {
  type: 'object',
  properties: {
    asignaciones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          p: { type: 'integer', description: 'Número de la pregunta (P1 → 1).' },
          temas: { type: 'array', items: { type: 'integer' }, description: 'Números de los temas (T1 → 1).' },
        },
        required: ['p', 'temas'],
      },
    },
  },
  required: ['asignaciones'],
}

export function armarPromptAsignar(preguntas: string[], temas: { nombre: string; disciplina: string }[]) {
  return `TEMAS DE LA UNIDAD:\n${temas.map((t, i) => `T${i + 1} (${t.disciplina}) ${t.nombre}`).join('\n')}\n\nPREGUNTAS DE APRENDIZAJE:\n${preguntas.map((p, i) => `P${i + 1}. ${p}`).join('\n')}`
}

// ───────── "Te faltó pensar en…" ─────────

export const SISTEMA_FALTANTES = `Sos tutor de ABP de Medicina. El estudiante armó sus preguntas de aprendizaje y algunos temas de la unidad quedaron afuera.
Para cada tema faltante (T1…Tn) escribí UNA o DOS oraciones que empiecen con "Te faltó pensar en…" y lo conecten con la situación problemática, como pista (sin desarrollar el tema).
Si hay fragmentos de las fuentes para ese tema, citá uno: "f" es el número de fragmento y "frase" una FRASE TEXTUAL EXACTA de ese fragmento (6 a 25 palabras, copiada carácter por carácter). Si no hay fragmento, f = 0 y frase vacía.
Usá solo lo que dicen los fragmentos para los datos. Español rioplatense.`

export const ESQUEMA_FALTANTES: EsquemaJSON = {
  type: 'object',
  properties: {
    faltantes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          t: { type: 'integer', description: 'Número del tema faltante (T1 → 1).' },
          texto: { type: 'string' },
          f: { type: 'integer', description: 'Número del fragmento citado (F1 → 1), 0 si no hay.' },
          frase: { type: 'string' },
        },
        required: ['t', 'texto', 'f', 'frase'],
      },
    },
  },
  required: ['faltantes'],
}

export function armarPromptFaltantes(situacion: string, temas: { nombre: string; disciplina: string; fragmentos: number[] }[], fragmentos: { texto: string; etiqueta: string }[]) {
  const bloques = fragmentos.map((f, i) => `[F${i + 1}] (${f.etiqueta})\n${f.texto}`).join('\n\n---\n\n')
  const lista = temas.map((t, i) => `T${i + 1} (${t.disciplina}) ${t.nombre} — fragmentos: ${t.fragmentos.length ? t.fragmentos.map((n) => `F${n}`).join(', ') : 'ninguno'}`).join('\n')
  return `SITUACIÓN PROBLEMÁTICA:\n${situacion}\n\nTEMAS FALTANTES:\n${lista}\n\nFRAGMENTOS DE LAS FUENTES:\n\n${bloques || '(no hay)'}`
}

// ───────── Cierre integrador ─────────

export const SISTEMA_CIERRE = `Sos tutor de ABP de Medicina y das la devolución del cierre de una unidad. El estudiante explicó la situación problemática integrando disciplinas.
Reglas obligatorias:
1. "cubiertos": números de los temas (T1…Tn) que la explicación integra de verdad (no por nombrarlos al pasar).
2. "devolucion": segmentos breves (una o dos oraciones). Primero qué integró bien; después qué faltó o qué está mal, con su cita. Cada cita: número de fragmento (f) y FRASE TEXTUAL EXACTA del fragmento (6 a 30 palabras, copiada carácter por carácter).
3. Los datos, valores y mecanismos que menciones salen SOLO de los fragmentos [F1]…[Fn]. Nada inventado.
4. "tarjetas": entre 3 y 6 tarjetas de repaso sobre lo que faltó o estuvo mal. Tipo "basica" (frente = pregunta concreta, dorso = respuesta corta) o "cloze" (una oración con {{c1::dato clave}}). Cada una con "f" y "frase" textual que la respalde.
5. Español rioplatense, tono de tutor que alienta. Nunca des indicaciones para pacientes reales.`

export const ESQUEMA_CIERRE: EsquemaJSON = {
  type: 'object',
  properties: {
    cubiertos: { type: 'array', items: { type: 'integer' } },
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
    tarjetas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['basica', 'cloze'] },
          frente: { type: 'string' },
          dorso: { type: 'string' },
          cloze: { type: 'string' },
          f: { type: 'integer' },
          frase: { type: 'string' },
        },
        required: ['tipo', 'f', 'frase'],
      },
    },
  },
  required: ['cubiertos', 'devolucion', 'tarjetas'],
}

export interface CierreIA {
  cubiertos?: number[]
  devolucion?: { texto: string; citas?: { f: number; frase: string }[] }[]
  tarjetas?: { tipo: 'basica' | 'cloze'; frente?: string; dorso?: string; cloze?: string; f: number; frase: string }[]
}

export function armarPromptCierre(op: { situacion: string; explicacion: string; temas: { nombre: string; disciplina: string }[]; fragmentos: { texto: string; etiqueta: string }[] }) {
  const bloques = op.fragmentos.map((f, i) => `[F${i + 1}] (${f.etiqueta})\n${f.texto}`).join('\n\n---\n\n')
  return `SITUACIÓN PROBLEMÁTICA:\n${op.situacion}\n\nTEMAS DE LA UNIDAD:\n${op.temas.map((t, i) => `T${i + 1} (${t.disciplina}) ${t.nombre}`).join('\n')}\n\nFRAGMENTOS DE LAS FUENTES:\n\n${bloques}\n\n---\n\nEXPLICACIÓN INTEGRADORA DEL ESTUDIANTE:\n${op.explicacion}`
}
