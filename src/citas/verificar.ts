import { normalizar } from '../busqueda/normalizar'
import type { CitaVerificada, Fragmento, Segmento } from '../repositorio/tipos'

/** Lo que devuelve la IA (ver ia/prompts/chatConCitas.ts). */
export interface RespuestaCitadaIA {
  respuesta: { texto: string; citas?: { f: number; frase: string }[] }[]
  fueraDeFuentes?: string
  sinInformacion?: boolean
}

/** Largo mínimo (normalizado) para aceptar una frase como cita: evita "el", "y la"… */
const MIN_FRASE = 12

/**
 * ¿La frase aparece textualmente en el fragmento? Comparación normalizada (tildes,
 * mayúsculas, espacios, puntuación y cortes de renglón). Acepta elisiones "…" / "...":
 * cada tramo tiene que aparecer, en orden.
 */
export function fraseEnTexto(frase: string, texto: string): boolean {
  if (fraseEnTextoExacta(frase, texto)) return true
  // La IA a veces copia una palabra cortada al final de renglón como "ARTERIO- LA": se prueba unida.
  const unida = frase.replace(/(\p{L})[-‐­]\s+(\p{L})/gu, '$1$2')
  return unida !== frase && fraseEnTextoExacta(unida, texto)
}

function fraseEnTextoExacta(frase: string, texto: string): boolean {
  const tramos = frase.split(/\.{3}|…|\[\.\.\.\]/).map(normalizar).filter((t) => t.length >= 3)
  if (!tramos.length || tramos.join(' ').length < MIN_FRASE) return false
  const t = normalizar(texto)
  let desde = 0
  for (const tr of tramos) {
    const i = t.indexOf(tr, desde)
    if (i < 0) return false
    desde = i + tr.length
  }
  return true
}

const TIENE_CIFRA = /\d/

/** Quita marcas tipo [F3] o [F1, F2] que la IA a veces deja dentro del texto. */
export function limpiarMarcas(texto: string) {
  return texto.replace(/\s*\[(?:F\s*\d+\s*,?\s*)+\]/gi, '').replace(/[ \t]+([.,;:])/g, '$1').trim()
}

export interface ResultadoVerificacion {
  segmentos: Segmento[]
  fueraDeFuentes?: string
  sinInformacion: boolean
  /** ids de los fragmentos efectivamente citados (verificados) */
  usados: string[]
}

/**
 * Verifica cada cita: el número de fragmento tiene que existir entre los enviados
 * y la frase tiene que estar en ese fragmento. Si no, queda "no verificada".
 */
export function verificarRespuesta(r: RespuestaCitadaIA, enviados: Fragmento[]): ResultadoVerificacion {
  const usados = new Set<string>()
  const segmentos: Segmento[] = (r.respuesta ?? []).map((s) => {
    const citas: CitaVerificada[] = (s.citas ?? []).map((c) => {
      const frag = Number.isInteger(c.f) && c.f >= 1 ? enviados[c.f - 1] : undefined
      const verificada = !!frag && typeof c.frase === 'string' && fraseEnTexto(c.frase, frag.texto)
      if (verificada && frag) usados.add(frag.id)
      return { n: c.f, fragmentoId: frag?.id, frase: c.frase ?? '', verificada }
    })
    const texto = limpiarMarcas(s.texto ?? '')
    return { texto, citas, cifraSinCita: TIENE_CIFRA.test(texto) && !citas.some((c) => c.verificada) }
  })
  return {
    segmentos,
    fueraDeFuentes: r.fueraDeFuentes?.trim() || undefined,
    sinInformacion: !!r.sinInformacion,
    usados: [...usados],
  }
}
