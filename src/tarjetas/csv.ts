import { normalizar } from '../busqueda/normalizar'
import { nombreDisciplina, paqueteActivo, unidadPorId } from '../contenido'
import type { Tarjeta, Tema } from '../repositorio/tipos'
import type { BorradorTarjeta } from './crear'
import { numerosCloze } from './fsrs'

/** Una fila por nota (las hermanas de un cloze van juntas). Las oclusiones no entran: tienen imagen. */
export function unaPorNota(ts: Tarjeta[]) {
  const vistos = new Set<string>()
  return ts.filter((t) => {
    const k = t.grupoId ?? t.id
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  })
}

const COLUMNAS = ['tipo', 'frente', 'dorso', 'cloze', 'unidad', 'disciplina', 'tema', 'etiquetas', 'pagina'] as const

function celda(v: string | number | undefined) {
  const s = String(v ?? '')
  return /[",;\n\r\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV con encabezado (UTF-8 con BOM para que Excel respete las tildes). */
export function exportarCSV(ts: Tarjeta[], temas: Tema[]): string {
  const nombreTema = new Map(temas.map((t) => [t.id, t.nombre]))
  const filas = unaPorNota(ts.filter((t) => t.tipo !== 'oclusion')).map((t) => [
    t.tipo, t.frente, t.dorso, t.cloze, unidadPorId(t.unidadId)?.sigla, t.disciplinaId ? nombreDisciplina(t.disciplinaId) : '',
    t.temaId ? nombreTema.get(t.temaId) : '', t.etiquetas.join(' '), t.pagina,
  ].map(celda).join(','))
  return '﻿' + [COLUMNAS.join(','), ...filas].join('\r\n') + '\r\n'
}

/** Parser CSV (RFC 4180): comillas, comillas dobles escapadas y saltos de línea dentro de celdas. */
export function parsearCSV(texto: string, separador?: string): string[][] {
  const s = texto.replace(/^﻿/, '')
  const sep = separador ?? detectarSeparador(s)
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let enComillas = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (enComillas) {
      if (c === '"' && s[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') enComillas = false
      else campo += c
    } else if (c === '"' && campo === '') enComillas = true
    else if (c === sep) { fila.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      fila.push(campo); campo = ''
      if (fila.some((x) => x.trim())) filas.push(fila)
      fila = []
    } else campo += c
  }
  fila.push(campo)
  if (fila.some((x) => x.trim())) filas.push(fila)
  return filas
}

/** El separador más frecuente fuera de comillas en la primera línea (coma, punto y coma o tab). */
export function detectarSeparador(s: string) {
  let primera = ''
  let enComillas = false
  for (const c of s) {
    if (c === '"') enComillas = !enComillas
    if (!enComillas && (c === '\n' || c === '\r')) break
    if (!enComillas) primera += c
  }
  const cuenta = (x: string) => primera.split(x).length - 1
  return ['\t', ';', ','].sort((a, b) => cuenta(b) - cuenta(a))[0]
}

const ALIAS: Record<string, string[]> = {
  tipo: ['tipo', 'type'],
  frente: ['frente', 'pregunta', 'front', 'question', 'anverso'],
  dorso: ['dorso', 'respuesta', 'back', 'answer', 'reverso', 'extra'],
  cloze: ['cloze', 'texto', 'text'],
  unidad: ['unidad', 'up', 'unidad problema'],
  disciplina: ['disciplina'],
  tema: ['tema'],
  etiquetas: ['etiquetas', 'tags'],
  pagina: ['pagina', 'pag'],
}

/**
 * CSV → borradores. Acepta el CSV que exporta la app, uno de Anki (frente, dorso) o una
 * planilla con encabezados en castellano/inglés. Sin encabezado: columna 1 = frente, 2 = dorso.
 * Si el frente tiene {{c1::…}}, la tarjeta es cloze.
 */
export function importarCSV(texto: string, temas: Tema[]): { borradores: BorradorTarjeta[]; omitidas: number } {
  const filas = parsearCSV(texto)
  if (!filas.length) return { borradores: [], omitidas: 0 }
  const encabezado = filas[0].map((h) => normalizar(h))
  const indice: Record<string, number> = {}
  for (const [clave, alias] of Object.entries(ALIAS)) {
    const i = encabezado.findIndex((h) => alias.includes(h))
    if (i >= 0) indice[clave] = i
  }
  const conEncabezado = indice.frente !== undefined || indice.cloze !== undefined
  if (!conEncabezado) { indice.frente = 0; indice.dorso = 1 }
  const temasPorNombre = new Map(temas.map((t) => [normalizar(t.nombre), t]))
  const borradores: BorradorTarjeta[] = []
  let omitidas = 0
  for (const f of conEncabezado ? filas.slice(1) : filas) {
    const v = (k: string) => (indice[k] !== undefined ? (f[indice[k]] ?? '').trim() : '')
    let tipo = v('tipo') === 'cloze' ? 'cloze' : 'basica'
    let cloze = v('cloze')
    let frente = v('frente')
    let dorso = v('dorso')
    if (tipo !== 'cloze' && numerosCloze(frente).length) { tipo = 'cloze'; cloze = frente; frente = '' }
    if (tipo === 'cloze' && !cloze && numerosCloze(frente).length) { cloze = frente; frente = '' }
    if (tipo === 'cloze' ? !numerosCloze(cloze).length : !frente || !dorso) { omitidas++; continue }
    const u = v('unidad')
    const unidad = paqueteActivo.unidades.find((x) => normalizar(x.sigla) === normalizar(u) || x.id === u)
    const tema = temasPorNombre.get(normalizar(v('tema')))
    const disc = paqueteActivo.disciplinas.find((d) => normalizar(d.nombre) === normalizar(v('disciplina')) || d.id === v('disciplina'))
    const pagina = Number(v('pagina')) || undefined
    borradores.push({
      tipo: tipo as 'basica' | 'cloze', frente, dorso, cloze: tipo === 'cloze' ? cloze : undefined,
      unidadId: tema?.unidadId ?? unidad?.id, disciplinaId: tema?.disciplinaId ?? disc?.id, temaId: tema?.id,
      etiquetas: v('etiquetas').split(/[\s,]+/).filter(Boolean), pagina, origen: 'csv',
    })
  }
  return { borradores, omitidas }
}
