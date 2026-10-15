import type { NavigateFunction } from 'react-router-dom'
import { fuentes, imagenesTarjeta, notas } from '../repositorio'
import type { AccionesSeleccion } from './VisorFuente'

/** Lo que se puede hacer con una selección (o la página) del visor: preguntar, nota, tarjeta, oclusión. */
export function accionesVisor(navegar: NavigateFunction, antes: () => void = () => {}): AccionesSeleccion {
  return {
    alPreguntar: (texto) => { antes(); navegar(`/chat?q=${encodeURIComponent(`Explicame este pasaje: "${texto.slice(0, 600)}"`)}`) },
    alCrearNota: async (texto, u) => {
      const f = await fuentes.obtener(u.fuenteId)
      const n = await notas.crear({ titulo: texto.slice(0, 60), markdown: `> ${texto}\n\n(${f?.nombre ?? 'Fuente'}, pág. ${u.pagina})\n\n`, origen: 'visor' })
      antes()
      navegar(`/notas/${n.id}`)
    },
    alCrearTarjeta: (texto, u) => {
      antes()
      navegar(`/tarjetas/generar?origen=seleccion&fuente=${u.fuenteId}&p=${u.pagina}&n=3&texto=${encodeURIComponent(texto.slice(0, 1500))}`)
    },
    alOclusion: async (imagen, u) => {
      const f = await fuentes.obtener(u.fuenteId)
      const img = await imagenesTarjeta.guardar(imagen, `${f?.nombre ?? 'Fuente'}, pág. ${u.pagina}`)
      antes()
      navegar(`/tarjetas/generar?origen=oclusion&imagen=${img.id}&fuente=${u.fuenteId}&p=${u.pagina}`)
    },
  }
}
