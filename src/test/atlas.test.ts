import { describe, expect, it } from 'vitest'
import { paqueteActivo } from '../contenido'
import { escenaPorId, escenas, esRespuestaCorrecta, fichaDePieza, fichas, nombrePieza } from '../atlas/datos'
import { elegirTanda, estadoTrasRespuesta, puntaje } from '../atlas/museo'
import { recorridos } from '../atlas/recorridos'
import type { EstructuraAtlas } from '../repositorio/tipos'
import { estadoNuevo } from '../tarjetas/fsrs'

const pieza = (escena: string, id: string) => escenaPorId(escena)!.piezas.find((p) => p.id === id)!

describe('datos del atlas', () => {
  it('cada pieza tiene ficha completa y cada escena del paquete existe', () => {
    for (const e of escenas) {
      expect(e.piezas.length).toBeGreaterThan(0)
      for (const p of e.piezas) {
        const f = fichas[p.ficha]
        expect(f, `${e.id}:${p.id}`).toBeDefined()
        expect(f.nombre && f.latin && f.descripcion, `${e.id}:${p.id}`).toBeTruthy()
        expect(f.revisado).toBe(false)
      }
    }
    for (const a of paqueteActivo.atlas) expect(escenaPorId(a.escena), a.escena).toBeDefined()
  })

  it('las piezas con el mismo id son la misma estructura en todas las escenas (FSRS compartido)', () => {
    const porId = new Map<string, string>()
    for (const e of escenas) for (const p of e.piezas) {
      const firma = `${p.ficha}|${p.lado ?? ''}|${p.fma ?? ''}`
      if (porId.has(p.id)) expect(porId.get(p.id), p.id).toBe(firma)
      porId.set(p.id, firma)
    }
  })

  it('nombre con lado concordado y nivel', () => {
    expect(nombrePieza(pieza('rinones', 'rinon-der'))).toBe('Riñón derecho')
    expect(nombrePieza(pieza('rinones', 'suprarrenal-izq'))).toBe('Glándula suprarrenal izquierda')
    expect(nombrePieza(pieza('rinones', 'vena-renal-izq'))).toBe('Vena renal izquierda')
    expect(nombrePieza(pieza('fosa-lumbar', 'disco-l4'))).toBe('Disco intervertebral L4–L5')
  })

  it('la ficha de cada lado agrega sus relaciones y su latín', () => {
    const der = fichaDePieza(pieza('rinones', 'rinon-der'))
    const izq = fichaDePieza(pieza('rinones', 'rinon-izq'))
    expect(der.latin).toBe('Ren dexter')
    expect(der.relaciones).toMatch(/hígado/)
    expect(izq.relaciones).toMatch(/bazo/)
    expect(fichaDePieza(pieza('rinones', 'rinon-der'), { descripcion: 'editada' }).descripcion).toBe('editada')
  })
})

describe('recorridos guiados', () => {
  it('cada paso apunta a una escena y una pieza que existen', () => {
    for (const r of recorridos) {
      expect(r.pasos.length).toBeGreaterThan(3)
      for (const p of r.pasos) expect(escenaPorId(p.escena)?.piezas.some((x) => x.id === p.pieza), `${r.id}: ${p.escena}/${p.pieza}`).toBe(true)
    }
  })
})

describe('Modo Museo: tanda y FSRS', () => {
  const T = Date.UTC(2026, 9, 15, 12)
  const est = (id: string, vence: number, ultimo = 0): EstructuraAtlas => ({ id, escena: 'rinones', fsrs: estadoNuevo(T), vence, estado: 2, aciertos: 1, fallos: 0, ultimo })

  it('vencidas primero (la más atrasada), después las nunca vistas, al final las demás', () => {
    const estados = new Map([
      ['a', est('a', T - 1000)], ['b', est('b', T - 5000)], ['c', est('c', T + 1e7, 5)], ['d', est('d', T + 1e7, 1)],
    ])
    const tanda = elegirTanda(['a', 'b', 'c', 'd', 'n1', 'n2'], estados, T, 6, () => 0.5)
    expect(tanda.slice(0, 2)).toEqual(['b', 'a'])
    expect(new Set(tanda.slice(2, 4))).toEqual(new Set(['n1', 'n2']))
    expect(tanda.slice(4)).toEqual(['d', 'c'])
    expect(elegirTanda(['a', 'b', 'c'], estados, T, 2)).toHaveLength(2)
  })

  it('un error hace que la estructura vuelva antes que un acierto', () => {
    const ok = estadoTrasRespuesta(undefined, true, false, T)
    const pista = estadoTrasRespuesta(undefined, true, true, T)
    const mal = estadoTrasRespuesta(undefined, false, false, T)
    expect(mal.due).toBeLessThan(pista.due)
    expect(pista.due).toBeLessThan(ok.due)
    expect(mal.due - T).toBeLessThan(15 * 60_000)
    expect(puntaje(7, 10)).toBe(70)
  })
})

describe('Modo Museo: corrección tolerante', () => {
  const rinonDer = pieza('rinones', 'rinon-der')
  const psoas = pieza('rinones', 'psoas-izq')
  const vci = pieza('rinones', 'vci')
  const supra = pieza('rinones', 'suprarrenal-der')
  const l3 = pieza('rinones', 'l3')

  it('acepta tildes, mayúsculas, artículos, lado opcional, sinónimos y latín', () => {
    for (const r of ['Riñón', 'riñon', 'RIÑÓN DERECHO', 'el riñon derecho', 'ren', 'Ren dexter']) expect(esRespuestaCorrecta(r, rinonDer), r).toBe(true)
    for (const r of ['psoas', 'Músculo psoas mayor', 'psoas mayor izquierdo', 'm. psoas']) expect(esRespuestaCorrecta(r, psoas), r).toBe(true)
    for (const r of ['vena cava inferior', 'cava inferior', 'VCI']) expect(esRespuestaCorrecta(r, vci), r).toBe(true)
    for (const r of ['suprarrenal', 'glándula adrenal', 'adrenal derecha']) expect(esRespuestaCorrecta(r, supra), r).toBe(true)
    for (const r of ['L3', 'tercera lumbar', 'tercera vértebra lumbar']) expect(esRespuestaCorrecta(r, l3), r).toBe(true)
  })

  it('tolera un error de tipeo pero no otra estructura ni el lado equivocado', () => {
    expect(esRespuestaCorrecta('rinnon', rinonDer)).toBe(true)
    expect(esRespuestaCorrecta('vena cava inferor', vci)).toBe(true)
    expect(esRespuestaCorrecta('riñón izquierdo', rinonDer)).toBe(false)
    expect(esRespuestaCorrecta('uréter', rinonDer)).toBe(false)
    expect(esRespuestaCorrecta('L4', l3)).toBe(false)
    expect(esRespuestaCorrecta('', rinonDer)).toBe(false)
    expect(esRespuestaCorrecta('renal', pieza('rinones', 'vena-renal-der'))).toBe(false)
  })
})
