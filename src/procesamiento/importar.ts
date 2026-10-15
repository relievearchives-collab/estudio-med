import { invalidarIndice } from '../busqueda/hibrida'
import { eventos, fuentes, paginas } from '../repositorio'
import { encolarFuente } from './cola'

/** Crea las fuentes y las manda a la cola de procesamiento del worker. */
export async function importarArchivos(archivos: File[], op: { esGuia?: boolean } = {}) {
  const creadas = []
  for (const a of archivos) {
    const esPdf = a.type === 'application/pdf' || /\.pdf$/i.test(a.name)
    const esImagen = a.type.startsWith('image/')
    if (!esPdf && !esImagen) continue
    const f = await fuentes.crear({
      nombre: op.esGuia ? 'Guía del área' : a.name.replace(/\.[^.]+$/, ''),
      tipo: esPdf ? 'pdf' : 'imagen',
      esGuia: !!op.esGuia,
      archivo: a,
      mime: a.type || (esPdf ? 'application/pdf' : 'image/jpeg'),
    })
    encolarFuente(f.id)
    creadas.push(f)
    await eventos.registrar('fuente', esPdf ? 'pdf' : 'imagen')
  }
  invalidarIndice()
  return creadas
}

export async function importarTexto(nombre: string, texto: string) {
  const f = await fuentes.crear({ nombre: nombre || 'Texto pegado', tipo: 'texto', esGuia: false })
  await paginas.guardar([{ fuenteId: f.id, numero: 1, texto }])
  await fuentes.actualizar(f.id, { paginas: 1 })
  encolarFuente(f.id)
  await eventos.registrar('fuente', 'texto')
  invalidarIndice()
  return f
}

export function reintentar(fuenteId: string) {
  fuentes.actualizar(fuenteId, { estado: 'en_cola', error: undefined, progreso: 0, etapa: 'En cola' })
  encolarFuente(fuenteId)
  invalidarIndice()
}
