import { buscarFragmentos } from '../busqueda/hibrida'
import { etiquetaFragmento } from '../chat/preguntar'
import { verificarRespuesta, type RespuestaCitadaIA } from '../citas/verificar'
import { nombreDisciplina, unidadPorId } from '../contenido'
import { iaJSON } from '../ia/cliente'
import { armarPromptChat, ESQUEMA_CHAT, SISTEMA_CHAT } from '../ia/prompts/chatConCitas'
import { embeberConsulta } from '../procesamiento/cola'
import { fuentes, temas as repoTemas } from '../repositorio'
import type { Fragmento, Segmento } from '../repositorio/tipos'

/** Resumen de un tema para escuchar: el mismo flujo de citas verificadas que el chat. */

export interface ResumenTema {
  temaId: string
  segmentos: Segmento[]
  fueraDeFuentes?: string
  sinInformacion: boolean
  fragmentos: Fragmento[]
}

const FRAGMENTOS = 10

export function pedidoResumen(tema: string, contexto: string) {
  return `Hacé un RESUMEN DEL TEMA "${tema}" (${contexto}) para escucharlo en voz alta, como lo explicaría un docente.
- Entre 6 y 10 segmentos, en orden lógico: qué es, cómo funciona o cómo está formado, cómo se regula o se relaciona, y por qué importa.
- Oraciones completas y fluidas: sin tablas, viñetas, títulos ni abreviaturas (escribí "por ejemplo", "aproximadamente"…).
- Solo con lo que dicen los fragmentos, cada segmento con su cita.`
}

/** Fragmentos del tema; si hay pocos asignados al tema, se completa con los más parecidos de la unidad. */
async function fragmentosDe(temaId: string, nombre: string, unidadId: string) {
  let vector: Float32Array | null = null
  try { vector = await embeberConsulta(nombre, 15000) } catch { /* búsqueda solo por texto */ }
  const delTema = await buscarFragmentos(nombre, { alcance: { tipo: 'tema', temaId }, limite: FRAGMENTOS, vector })
  if (delTema.length >= 4) return delTema
  const deUnidad = await buscarFragmentos(nombre, { alcance: { tipo: 'unidad', unidadId }, limite: FRAGMENTOS, vector })
  return [...delTema, ...deUnidad.filter((f) => !delTema.some((x) => x.id === f.id))].slice(0, FRAGMENTOS)
}

/** Pedidos en curso por tema: abrir dos veces la pantalla (o el doble montaje de desarrollo) no gasta dos llamadas. */
const enCurso = new Map<string, Promise<ResumenTema>>()

export function resumirTema(temaId: string, op: { otraVersion?: boolean } = {}): Promise<ResumenTema> {
  if (op.otraVersion) return generar(temaId, true)
  if (!enCurso.has(temaId)) enCurso.set(temaId, generar(temaId, false).finally(() => enCurso.delete(temaId)))
  return enCurso.get(temaId)!
}

async function generar(temaId: string, otraVersion: boolean): Promise<ResumenTema> {
  const tema = await repoTemas.obtener(temaId)
  if (!tema) throw new Error('No encontré ese tema.')
  const frags = await fragmentosDe(temaId, tema.nombre, tema.unidadId)
  if (!frags.length) throw new Error('No hay material procesado de este tema todavía. Importá la guía o cargá apuntes.')
  const etiquetas = await Promise.all(frags.map(etiquetaFragmento))
  const contexto = `${nombreDisciplina(tema.disciplinaId)}, ${unidadPorId(tema.unidadId)?.sigla ?? ''}`
  const prompt = armarPromptChat(pedidoResumen(tema.nombre, contexto), frags.map((f, i) => ({ texto: f.texto, etiqueta: etiquetas[i] })), 'normal')
  // La primera versión queda en la caché (abrirla de nuevo no gasta cuota); "otra versión" pide una nueva.
  const r = await iaJSON<RespuestaCitadaIA>([{ rol: 'usuario', texto: prompt }], ESQUEMA_CHAT, {
    sistema: SISTEMA_CHAT, uso: 'chat', funcion: 'resumen', cache: !otraVersion, temperatura: otraVersion ? 0.7 : 0.2,
  })
  const v = verificarRespuesta(r, frags)
  return { temaId, segmentos: v.segmentos.filter((s) => s.texto), fueraDeFuentes: v.fueraDeFuentes, sinInformacion: v.sinInformacion, fragmentos: frags }
}

/** Markdown para guardar el resumen como nota, con la fuente y página de cada cita verificada. */
export async function markdownDeResumen(titulo: string, r: ResumenTema) {
  const nombres = new Map<string, string>()
  for (const f of r.fragmentos) if (!nombres.has(f.fuenteId)) nombres.set(f.fuenteId, (await fuentes.obtener(f.fuenteId))?.nombre ?? 'Fuente')
  const cuerpo = r.segmentos.map((s) => {
    const refs = s.citas.filter((c) => c.verificada && c.fragmentoId).map((c) => {
      const f = r.fragmentos.find((x) => x.id === c.fragmentoId)
      return f ? `(${nombres.get(f.fuenteId)}, pág. ${f.pagina})` : ''
    })
    return `${s.texto} ${[...new Set(refs)].join(' ')}`.trim()
  }).join('\n\n')
  return `## ${titulo}\n\n${cuerpo}${r.fueraDeFuentes ? `\n\n> **No está en tus apuntes:** ${r.fueraDeFuentes}` : ''}`
}

/** Texto apto para la voz: sin Markdown ni marcas de cita, con símbolos leídos en palabras. */
export function textoParaVoz(texto: string) {
  return texto
    .replace(/\[(?:F\s*\d+\s*,?\s*)+\]/gi, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>`|~]/g, ' ')
    .replace(/→/g, ' lleva a ')
    .replace(/≈/g, ' aproximadamente ')
    .replace(/±/g, ' más o menos ')
    .replace(/↑/g, ' aumento de ')
    .replace(/↓/g, ' disminución de ')
    .replace(/(\d)\s*-\s*(\d)/g, '$1 a $2')
    .replace(/([A-Za-zÁÉÍÓÚáéíóúµ]+)\/([A-Za-zÁÉÍÓÚáéíóúµ]+)/g, '$1 por $2')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:])/g, '$1')
    .trim()
}
