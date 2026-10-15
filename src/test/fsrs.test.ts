import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../repositorio/db'
import { revisiones, tarjetas } from '../repositorio'
import type { Tarjeta } from '../repositorio/tipos'
import { armarTarjetas, textoPlano } from '../tarjetas/crear'
import { temasFlojos } from '../tarjetas/flojos'
import {
  aCard, armarCola, calificar, deCard, ESTADO, estadoNuevo, formatearIntervalo, numerosCloze, previsualizar, racha, renderCloze, siguiente,
} from '../tarjetas/fsrs'

const DIA = 864e5
const T0 = new Date(2026, 9, 15, 10, 0).getTime()

function tarjeta(id: string, cambios: Partial<Tarjeta> = {}): Tarjeta {
  const [t] = armarTarjetas({ tipo: 'basica', frente: id, dorso: 'x' }, T0)
  return { ...t, id, ...cambios }
}

describe('FSRS (ts-fsrs)', () => {
  it('una tarjeta nueva vence ya y la conversión Card ↔ estado es exacta', () => {
    const e = estadoNuevo(T0)
    expect(e.state).toBe(ESTADO.nueva)
    expect(e.due).toBe(T0)
    expect(deCard(aCard(e))).toEqual(e)
  })

  it('los intervalos crecen con la calificación: Otra vez < Difícil < Bien < Fácil', () => {
    const p = previsualizar(estadoNuevo(T0), T0)
    expect(p[1].due).toBeLessThan(p[2].due)
    expect(p[2].due).toBeLessThan(p[3].due)
    expect(p[3].due).toBeLessThan(p[4].due)
    // Otra vez en una nueva: paso de aprendizaje de minutos, no días
    expect(p[1].due - T0).toBeLessThan(15 * 60_000)
    expect(p[1].state).toBe(ESTADO.aprendiendo)
    // Fácil la pasa directo a repaso, con días de intervalo
    expect(p[4].state).toBe(ESTADO.repaso)
    expect(p[4].scheduled_days).toBeGreaterThanOrEqual(1)
  })

  it('previsualizar y calificar dan el mismo resultado', () => {
    const e = estadoNuevo(T0)
    expect(calificar(e, 3, T0)).toEqual(previsualizar(e, T0)[3])
  })

  it('repasos exitosos espacian cada vez más; un olvido cuenta como lapso y acorta el intervalo', () => {
    let e = estadoNuevo(T0)
    let t = T0
    const intervalos: number[] = []
    for (let i = 0; i < 6; i++) {
      e = calificar(e, 3, t)
      intervalos.push(e.due - t)
      t = e.due
    }
    expect(e.state).toBe(ESTADO.repaso)
    for (let i = 2; i < intervalos.length; i++) expect(intervalos[i]).toBeGreaterThan(intervalos[i - 1])
    const olvido = calificar(e, 1, t)
    expect(olvido.lapses).toBe(1)
    expect(olvido.state).toBe(ESTADO.reaprendiendo)
    expect(olvido.due - t).toBeLessThan(intervalos[intervalos.length - 1])
  })

  it('mayor retención objetivo → intervalos más cortos', () => {
    let e = estadoNuevo(T0)
    e = calificar(e, 3, T0)
    e = calificar(e, 3, e.due)
    const a90 = calificar(e, 3, e.due, 0.9).scheduled_days
    const a97 = calificar(e, 3, e.due, 0.97).scheduled_days
    expect(a97).toBeLessThan(a90)
  })

  it('formatea intervalos en castellano', () => {
    expect(formatearIntervalo(60_000)).toBe('1 min')
    expect(formatearIntervalo(10 * 60_000)).toBe('10 min')
    expect(formatearIntervalo(3 * 3_600_000)).toBe('3 h')
    expect(formatearIntervalo(4 * DIA)).toBe('4 d')
    expect(formatearIntervalo(75 * DIA)).toBe('2,5 meses')
    expect(formatearIntervalo(400 * DIA)).toBe('1,1 años')
  })
})

describe('cola del día', () => {
  it('primero vencidas (la más atrasada), después nuevas hasta el tope; ignora suspendidas y futuras', () => {
    const ts = [
      tarjeta('n1', { creada: T0 - 3 }), tarjeta('n2', { creada: T0 - 2 }), tarjeta('n3', { creada: T0 - 1 }),
      tarjeta('r-atrasada', { estado: ESTADO.repaso, vence: T0 - 5 * DIA }),
      tarjeta('r-hoy', { estado: ESTADO.repaso, vence: T0 - 1000 }),
      tarjeta('r-manana', { estado: ESTADO.repaso, vence: T0 + DIA }),
      tarjeta('susp', { estado: ESTADO.repaso, vence: T0 - DIA, suspendida: true }),
      tarjeta('apr', { estado: ESTADO.aprendiendo, vence: T0 + 5 * 60_000 }),
    ]
    const c = armarCola(ts, T0, 2, 0)
    expect(c.vencidas.map((t) => t.id)).toEqual(['r-atrasada', 'r-hoy'])
    expect(c.nuevas.map((t) => t.id)).toEqual(['n1', 'n2'])
    expect(c.enEspera.map((t) => t.id)).toEqual(['apr'])
    expect(siguiente(c)?.id).toBe('r-atrasada')
    // Ya vio 2 nuevas hoy: no entran más
    expect(armarCola(ts, T0, 2, 2).nuevas).toHaveLength(0)
    // Sin vencidas ni nuevas, muestra la de aprendizaje que vence en minutos
    expect(siguiente(armarCola(ts.filter((t) => t.id === 'apr'), T0, 2, 0))?.id).toBe('apr')
  })

  it('racha: días seguidos con repasos, aunque hoy todavía no haya repasado', () => {
    const hoy = T0
    expect(racha([], hoy)).toBe(0)
    expect(racha([hoy, hoy - DIA, hoy - 2 * DIA], hoy)).toBe(3)
    expect(racha([hoy - DIA, hoy - 2 * DIA], hoy)).toBe(2)
    expect(racha([hoy, hoy - 2 * DIA], hoy)).toBe(1)
    expect(racha([hoy - 3 * DIA], hoy)).toBe(0)
  })
})

describe('temas flojos', () => {
  it('ordena por proporción de "Otra vez" y exige un mínimo de repasos', () => {
    const ts = new Map([
      ['a', tarjeta('a', { temaId: 'renal' })], ['b', tarjeta('b', { temaId: 'acido-base' })], ['c', tarjeta('c', { temaId: 'pocos' })],
    ])
    const rev = (tarjetaId: string, calificacion: number) => ({ tarjetaId, calificacion, fecha: T0, antes: estadoNuevo(T0), intervalo: 1, estabilidad: 1, dificultad: 5 })
    const revs = [
      ...[1, 3, 3, 3].map((c) => rev('a', c)),
      ...[1, 1, 3, 2].map((c) => rev('b', c)),
      ...[1, 1].map((c) => rev('c', c)),
    ]
    expect(temasFlojos(revs, ts).map((x) => [x.temaId, x.tasa])).toEqual([['acido-base', 0.5], ['renal', 0.25]])
  })
})

describe('cloze', () => {
  const texto = 'La {{c1::mácula densa}} sensa el {{c2::NaCl::ion}} en el {{c1::túbulo distal}}'
  it('detecta huecos y oculta solo el que se pregunta', () => {
    expect(numerosCloze(texto)).toEqual([1, 2])
    expect(renderCloze(texto, 1, false).texto).toBe('La […] sensa el NaCl en el […]')
    expect(renderCloze(texto, 2, false).texto).toBe('La mácula densa sensa el [ion] en el túbulo distal')
    expect(renderCloze(texto, 2, true).texto).toBe('La mácula densa sensa el NaCl en el túbulo distal')
  })
  it('una nota con 2 huecos genera 2 tarjetas hermanas', () => {
    const ts = armarTarjetas({ tipo: 'cloze', frente: '', dorso: '', cloze: texto })
    expect(ts.map((t) => t.clozeN)).toEqual([1, 2])
    expect(ts[0].grupoId).toBeDefined()
    expect(ts[0].grupoId).toBe(ts[1].grupoId)
    expect(textoPlano(ts[0])).toBe('La mácula densa sensa el NaCl en el túbulo distal')
  })
})

describe('repositorio de tarjetas', () => {
  beforeEach(async () => { await db.delete(); await db.open() })

  it('responder guarda estado + log + evento, y deshacer lo revierte', async () => {
    const [t] = await tarjetas.crear([{ tipo: 'basica', frente: 'a', dorso: 'b' }])
    const nuevo = calificar(t.fsrs, 3)
    await tarjetas.responder(t, 3, nuevo, 2500)
    const guardada = await tarjetas.obtener(t.id)
    expect(guardada?.fsrs).toEqual(nuevo)
    expect(guardada?.vence).toBe(nuevo.due)
    expect(await revisiones.todas()).toHaveLength(1)
    expect(await db.eventos.where('tipo').equals('repaso').count()).toBe(1)
    await tarjetas.deshacerUltimo()
    expect((await tarjetas.obtener(t.id))?.fsrs).toEqual(t.fsrs)
    expect(await revisiones.todas()).toHaveLength(0)
    expect(await db.eventos.where('tipo').equals('repaso').count()).toBe(0)
  })

  it('editar un cloze conserva el FSRS de los huecos que siguen y crea/borra los que cambian', async () => {
    const ts = await tarjetas.crear([{ tipo: 'cloze', frente: '', dorso: '', cloze: '{{c1::A}} y {{c2::B}}' }])
    const c1 = ts.find((t) => t.clozeN === 1)!
    const repasado = calificar(c1.fsrs, 4)
    await tarjetas.responder(c1, 4, repasado)
    await tarjetas.editar(c1, { tipo: 'cloze', frente: '', dorso: '', cloze: '{{c1::A}} y {{c3::C}}' })
    const grupo = await tarjetas.deGrupo(c1)
    expect(grupo.map((t) => t.clozeN).sort()).toEqual([1, 3])
    expect(grupo.find((t) => t.clozeN === 1)?.fsrs).toEqual(repasado)
    expect(grupo.every((t) => t.cloze === '{{c1::A}} y {{c3::C}}')).toBe(true)
  })
})
