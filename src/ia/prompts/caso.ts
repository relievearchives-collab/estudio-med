import type { EsquemaJSON } from '../proveedor'

/** Caso clínico simulado: generación (datos del paciente) y evaluación de la interpretación. */

export const SISTEMA_CASO = `Sos un docente de Medicina de primer año que arma un CASO CLÍNICO SIMULADO para practicar razonamiento, a partir de la situación problemática de la unidad y de los fragmentos [F1]…[Fn] de las fuentes del estudiante.
Reglas obligatorias:
1. Un paciente ficticio (nunca una persona real) cuya historia se relaciona con la situación y con los contenidos de los fragmentos. Nivel de primer año: el foco es la fisiología, la anatomía y la histología, no el tratamiento.
2. "interrogatorio": 6 a 9 preguntas que el estudiante podría hacerle, con la respuesta del paciente en primera persona; marcá "relevante" las que aportan al razonamiento (al menos 3) e incluí 2 o 3 que no aportan.
3. "examen": 4 a 6 hallazgos por sistema (signos vitales incluidos), "relevante" si importan.
4. "estudios": 4 a 8 estudios que se pueden pedir, con su resultado; incluí 1 o 2 que no hacen falta. Para analitos de laboratorio usá "clave" (na, k, cl, hco3, glucemia, urea, creatinina, albumina, hematocrito, ph, pco2, orinaNa, orinaCreatinina, orinaOsm), "valor" numérico y "unidad" (mEq/L, mg/dL, g/dL, %, mmHg, mOsm/kg). Valores fisiológicamente posibles y coherentes con la historia.
5. NO calcules valores derivados (osmolaridad, anión gap, TFG, FENa, interpretación de gases): los calcula la app.
6. "consigna": la pregunta final de interpretación. "puntos": 2 a 5 ideas que una interpretación completa tiene que incluir, basadas en los fragmentos.
7. "f" y "frase": el fragmento principal que respalda el caso y una FRASE TEXTUAL EXACTA de él (6 a 25 palabras).
8. Español rioplatense. Nunca des indicaciones para pacientes reales.`

const SN = { type: 'string' } as const
const BOOL = { type: 'boolean' } as const

export const ESQUEMA_CASO: EsquemaJSON = {
  type: 'object',
  properties: {
    titulo: SN,
    paciente: { type: 'object', properties: { edad: { type: 'integer' }, sexo: { type: 'string', enum: ['hombre', 'mujer'] }, descripcion: SN }, required: ['edad', 'sexo', 'descripcion'] },
    motivo: SN,
    interrogatorio: { type: 'array', items: { type: 'object', properties: { pregunta: SN, respuesta: SN, relevante: BOOL }, required: ['pregunta', 'respuesta', 'relevante'] } },
    examen: { type: 'array', items: { type: 'object', properties: { sistema: SN, hallazgo: SN, relevante: BOOL }, required: ['sistema', 'hallazgo', 'relevante'] } },
    estudios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: SN, grupo: { type: 'string', enum: ['laboratorio', 'orina', 'gases', 'imagen', 'otro'] }, resultado: SN,
          clave: { type: 'string', enum: ['na', 'k', 'cl', 'hco3', 'glucemia', 'urea', 'creatinina', 'albumina', 'hematocrito', 'ph', 'pco2', 'orinaNa', 'orinaCreatinina', 'orinaOsm'] },
          valor: { type: 'number' }, unidad: SN, relevante: BOOL,
        },
        required: ['nombre', 'grupo', 'resultado', 'relevante'],
      },
    },
    consigna: SN,
    puntos: { type: 'array', items: SN },
    f: { type: 'integer' },
    frase: SN,
  },
  required: ['titulo', 'paciente', 'motivo', 'interrogatorio', 'examen', 'estudios', 'consigna', 'puntos', 'f', 'frase'],
}

const bloques = (fragmentos: { texto: string; etiqueta: string }[]) => fragmentos.map((f, i) => `[F${i + 1}] (${f.etiqueta})\n${f.texto}`).join('\n\n---\n\n')

export function armarPromptCaso(unidad: string, situacion: string, fragmentos: { texto: string; etiqueta: string }[]) {
  return `UNIDAD: ${unidad}\n\nSITUACIÓN PROBLEMÁTICA DE LA UNIDAD:\n${situacion}\n\nFRAGMENTOS DE LAS FUENTES:\n\n${bloques(fragmentos)}`
}

export const SISTEMA_CASO_EVALUAR = `Sos el docente que corrige la interpretación de un caso clínico simulado de primer año de Medicina.
Reglas obligatorias:
1. "cubiertos": números de los puntos esperados (P1…Pn) que la interpretación explica de verdad (aceptá otras palabras; no alcanza con nombrar un término).
2. "errores": solo afirmaciones falsas concretas (no omisiones), cada una en una oración. Vacío si no hubo.
3. "devolucion": segmentos breves: qué razonó bien, qué faltó y la corrección de cada error, con citas. Cada cita: número de fragmento (f) y FRASE TEXTUAL EXACTA del fragmento (6 a 30 palabras). Los datos salen SOLO de los fragmentos y de los datos del caso.
4. No pongas nota: la calcula la app. Español rioplatense, tono de docente que alienta.`

export const ESQUEMA_CASO_EVALUAR: EsquemaJSON = {
  type: 'object',
  properties: {
    cubiertos: { type: 'array', items: { type: 'integer' } },
    errores: { type: 'array', items: SN },
    devolucion: {
      type: 'array',
      items: {
        type: 'object',
        properties: { texto: SN, citas: { type: 'array', items: { type: 'object', properties: { f: { type: 'integer' }, frase: SN }, required: ['f', 'frase'] } } },
        required: ['texto', 'citas'],
      },
    },
  },
  required: ['cubiertos', 'errores', 'devolucion'],
}

export function armarPromptCasoEvaluar(op: { resumenCaso: string; consigna: string; puntos: string[]; interpretacion: string; fragmentos: { texto: string; etiqueta: string }[] }) {
  return `FRAGMENTOS DE LAS FUENTES:\n\n${bloques(op.fragmentos)}\n\n---\n\nDATOS DEL CASO:\n${op.resumenCaso}\n\nCONSIGNA: ${op.consigna}\n\nPUNTOS ESPERADOS:\n${op.puntos.map((p, i) => `P${i + 1}. ${p}`).join('\n')}\n\nINTERPRETACIÓN DEL ESTUDIANTE:\n${op.interpretacion}`
}
