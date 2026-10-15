import { describe, expect, it } from 'vitest'
import { crearIndiceTexto, fusionarRRF } from '../busqueda/hibrida'
import type { Fragmento } from '../repositorio/tipos'

const f = (id: string, texto: string): Fragmento => ({ id, fuenteId: 'x', pagina: 1, inicio: 0, fin: 1, texto, palabras: 5 })

describe('fusionarRRF', () => {
  it('premia lo que aparece arriba en varias listas', () => {
    const r = fusionarRRF([['a', 'b', 'c'], ['b', 'a', 'd'], ['b']])
    expect(r[0].id).toBe('b')
    expect(r.map((x) => x.id)).toContain('d')
  })
})

describe('índice de texto exacto', () => {
  const idx = crearIndiceTexto([
    f('1', 'La fórmula de Cockcroft-Gault estima el clearance de creatinina.'),
    f('2', 'El diagrama de Davenport relaciona pH y bicarbonato.'),
    f('3', 'Ecuación de Henderson-Hasselbalch.'),
  ])
  it('encuentra epónimos y siglas sin importar tildes', () => {
    expect(idx.search('cockcroft')[0].id).toBe('1')
    expect(idx.search('davenport')[0].id).toBe('2')
    expect(idx.search('formula')[0].id).toBe('1')
  })
})

describe('índice: guiones y errores de tipeo', () => {
  const idx = crearIndiceTexto([f('1', 'Fórmulas de uso clínico: Cockroft-Gault, MDRD, CKD-EPI.')])
  it('separa palabras con guion y tolera una letra de diferencia', () => {
    expect(idx.search('Cockcroft')[0]?.id).toBe('1')
    expect(idx.search('gault')[0]?.id).toBe('1')
    expect(idx.search('CKD-EPI', { combineWith: 'AND' })[0]?.id).toBe('1')
  })
})
