import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import { paqueteActivo } from '../contenido'
import type { ImagenTarjeta, Tema } from '../repositorio/tipos'
import { exportarApkg } from '../tarjetas/anki'
import { armarTarjetas } from '../tarjetas/crear'
import { exportarCSV, importarCSV, parsearCSV } from '../tarjetas/csv'
import { calificar } from '../tarjetas/fsrs'

const temas: Tema[] = paqueteActivo.temas.map((t, i) => ({ ...t, orden: i, origen: 'paquete' }))
const up = paqueteActivo.unidades[2]
const tema = temas.find((t) => t.unidadId === up.id)!

describe('CSV', () => {
  it('parsea comillas, comas y saltos de línea dentro de celdas, y detecta el separador', () => {
    expect(parsearCSV('a,"b, c","d ""e"""\r\n1,"2\n3",4\n')).toEqual([['a', 'b, c', 'd "e"'], ['1', '2\n3', '4']])
    expect(parsearCSV('frente;dorso\n¿TFG?;125 ml/min')).toEqual([['frente', 'dorso'], ['¿TFG?', '125 ml/min']])
    expect(parsearCSV('front\tback\nA\tB')).toEqual([['front', 'back'], ['A', 'B']])
  })

  it('exportar → importar conserva tipo, texto, unidad y tema', () => {
    const ts = [
      ...armarTarjetas({ tipo: 'basica', frente: '¿Qué mide el "clearance"?', dorso: 'Volumen de plasma depurado,\npor minuto', unidadId: up.id, temaId: tema.id, disciplinaId: tema.disciplinaId, etiquetas: ['renal'] }),
      ...armarTarjetas({ tipo: 'cloze', frente: '', dorso: 'Extra', cloze: '{{c1::Na+}} y {{c2::K+}}', unidadId: up.id }),
    ]
    const csv = exportarCSV(ts, temas)
    expect(csv.startsWith('﻿')).toBe(true)
    // El cloze con 2 huecos sale una sola vez (una fila por nota)
    expect(parsearCSV(csv)).toHaveLength(3)
    const { borradores, omitidas } = importarCSV(csv, temas)
    expect(omitidas).toBe(0)
    expect(borradores).toHaveLength(2)
    expect(borradores[0]).toMatchObject({ tipo: 'basica', frente: '¿Qué mide el "clearance"?', dorso: 'Volumen de plasma depurado,\npor minuto', unidadId: up.id, temaId: tema.id, etiquetas: ['renal'] })
    expect(borradores[1]).toMatchObject({ tipo: 'cloze', cloze: '{{c1::Na+}} y {{c2::K+}}', dorso: 'Extra', unidadId: up.id })
  })

  it('importa un CSV sin encabezado (frente, dorso) y detecta cloze en el frente; omite filas vacías o incompletas', () => {
    const { borradores, omitidas } = importarCSV('¿Qué filtra el glomérulo?,Plasma\nEl {{c1::riñón}} filtra,\nsolo frente,\n', temas)
    expect(borradores.map((b) => b.tipo)).toEqual(['basica', 'cloze'])
    expect(borradores[1].cloze).toBe('El {{c1::riñón}} filtra')
    expect(omitidas).toBe(1)
  })
})

describe('Anki .apkg', () => {
  it('arma un SQLite válido con notas, tarjetas, mazos por unidad y medios', async () => {
    const SQL = await initSqlJs()
    const basica = armarTarjetas({ tipo: 'basica', frente: 'F <b>', dorso: 'D', unidadId: up.id, etiquetas: ['renal', 'UP 3'] })
    const repasada = { ...basica[0], fsrs: calificar(calificar(basica[0].fsrs, 3), 4) }
    repasada.vence = repasada.fsrs.due
    repasada.estado = repasada.fsrs.state
    const cloze = armarTarjetas({ tipo: 'cloze', frente: '', dorso: '', cloze: '{{c1::a}} {{c2::b}} {{c3::c}}' })
    const img: ImagenTarjeta = { id: 'img-1', archivo: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), mime: 'image/png', creada: 0 }
    const ocl = armarTarjetas({ tipo: 'oclusion', frente: 'Nombrá', dorso: '', imagenId: 'img-1', mascaras: [{ id: 'a', x: 0, y: 0, w: 0.1, h: 0.1, etiqueta: 'Pelvis' }, { id: 'b', x: 0.5, y: 0.5, w: 0.1, h: 0.1, etiqueta: 'Uréter' }] })

    const blob = await exportarApkg([repasada, ...cloze, ...ocl], { sql: SQL, imagenes: new Map([['img-1', img]]), fuenteDe: () => 'Guía, pág. 42' })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(JSON.parse(await zip.file('media')!.async('string'))).toEqual({ 0: 'estudiomed-img-1.png' })
    expect(new Uint8Array(await zip.file('0')!.async('arraybuffer'))).toEqual(new Uint8Array([1, 2, 3]))

    const db = new SQL.Database(await zip.file('collection.anki2')!.async('uint8array'))
    const uno = (sql: string) => db.exec(sql)[0].values
    // 1 básica + 1 nota cloze + 2 notas de oclusión
    expect(uno('SELECT count(*) FROM notes')[0][0]).toBe(4)
    // 1 + 3 huecos + 2 máscaras
    expect(uno('SELECT count(*) FROM cards')[0][0]).toBe(6)
    expect(uno('SELECT ord FROM cards c JOIN notes n ON n.id = c.nid WHERE n.flds LIKE \'{{c1%\' ORDER BY ord').map((r) => r[0])).toEqual([0, 1, 2])
    const [flds, tags] = uno('SELECT flds, tags FROM notes ORDER BY id LIMIT 1')[0] as string[]
    expect(flds.split('\x1f')).toEqual(['F &lt;b&gt;', 'D', 'Guía, pág. 42'])
    expect(tags).toBe('renal UP_3')
    // La tarjeta repasada entra como "repaso" con su intervalo
    const [tipo, cola, ivl] = uno('SELECT type, queue, ivl FROM cards ORDER BY id LIMIT 1')[0] as number[]
    expect([tipo, cola]).toEqual([2, 2])
    expect(ivl).toBeGreaterThanOrEqual(1)
    const decks = JSON.parse(uno('SELECT decks FROM col')[0][0] as string)
    expect(Object.values(decks).map((d) => (d as { name: string }).name)).toContain(`Estudio Med::${up.sigla} · ${up.titulo}`)
    const models = JSON.parse(uno('SELECT models FROM col')[0][0] as string)
    expect(Object.values(models).map((m) => (m as { type: number }).type).sort()).toEqual([0, 1])
    expect(uno('SELECT flds FROM notes WHERE flds LIKE \'%ocl%\' LIMIT 1')[0][0]).toContain('<img src="estudiomed-img-1.png">')
    db.close()
  })
})
