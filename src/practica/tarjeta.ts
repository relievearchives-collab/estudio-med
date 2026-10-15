import { tarjetas } from '../repositorio'
import { fmt } from '../simuladores/ejercicios'
import type { Item } from './sesion'

/** Convierte un ítem fallado en una tarjeta básica (pregunta → respuesta correcta + explicación). */
export async function tarjetaDeItem(item: Item) {
  if (item.tipo === 'pregunta') {
    const p = item.pregunta
    const correcta = p.opciones[p.correcta]
    await tarjetas.crear([{
      tipo: 'basica', frente: p.enunciado, dorso: `${correcta.texto}${correcta.explicacion ? `\n\n${correcta.explicacion}` : ''}`,
      fragmentoId: p.fragmentoId, fuenteId: p.fuenteId, pagina: p.pagina, unidadId: p.unidadId, disciplinaId: p.disciplinaId, temaId: p.temaId,
      etiquetas: ['parcial'], origen: 'manual',
    }])
  } else {
    const e = item.ejercicio
    const resp = e.tipo === 'numero' ? `${fmt(e.respuesta, e.decimales)} ${e.unidad}` : e.opciones[e.correcta]
    await tarjetas.crear([{
      tipo: 'basica', frente: e.enunciado, dorso: `${resp}\n\n${e.resolucion.join('\n')}`,
      unidadId: item.unidadId, disciplinaId: item.disciplinaId, temaId: item.temaId, etiquetas: ['parcial', 'ejercicio'], origen: 'manual',
    }])
  }
}
