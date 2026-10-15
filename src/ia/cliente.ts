import { cacheIA, eventos, leerAjustes, usoIA } from '../repositorio'
import { crearGemini } from './gemini'
import { crearGroq } from './groq'
import {
  ErrorCuota, parsearJSON, type EsquemaJSON, type MensajeIA, type OpcionesIA, type ProveedorIA,
} from './proveedor'

/** Devuelve el proveedor configurado en Ajustes. */
export async function proveedorActual(): Promise<ProveedorIA> {
  const a = await leerAjustes()
  if (a.proveedorIA === 'groq') return crearGroq({ clave: a.claveGroq })
  return crearGemini({ clave: a.claveIA, modeloChat: a.modeloChat, modeloLote: a.modeloLote })
}

async function hashTexto(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function antesDeLlamar() {
  const [a, u] = await Promise.all([leerAjustes(), usoIA.hoy()])
  if (a.limiteDiarioIA > 0 && u.llamadas >= a.limiteDiarioIA) {
    throw new ErrorCuota(`Llegaste al tope diario que configuraste (${a.limiteDiarioIA} llamadas). Se renueva mañana.`)
  }
}

async function despuesDeError(e: unknown): Promise<never> {
  if (e instanceof ErrorCuota) await usoIA.marcarAgotado()
  throw e
}

interface OpcionesCliente extends OpcionesIA {
  /** Si es true, se reutiliza una respuesta idéntica previa (cuida la cuota). */
  cache?: boolean
  /** Etiqueta para estadísticas (ej. 'chat', 'tarjetas'). */
  funcion?: string
}

export async function iaTexto(mensajes: MensajeIA[], op: OpcionesCliente = {}) {
  const p = await proveedorActual()
  const clave = op.cache ? await hashTexto(JSON.stringify([p.id, op.uso, op.sistema, mensajes])) : ''
  if (clave) {
    const c = await cacheIA.leer(clave)
    if (c) return c
  }
  await antesDeLlamar()
  try {
    const r = await p.chat(mensajes, op)
    await usoIA.sumar(r.tokens)
    await eventos.registrar('ia', op.funcion ?? 'texto')
    if (clave) await cacheIA.guardar(clave, r.texto)
    return r.texto
  } catch (e) {
    return despuesDeError(e)
  }
}

export async function iaJSON<T>(mensajes: MensajeIA[], esquema: EsquemaJSON, op: OpcionesCliente = {}): Promise<T> {
  const p = await proveedorActual()
  const clave = op.cache ? await hashTexto(JSON.stringify([p.id, op.uso, op.sistema, esquema, mensajes])) : ''
  if (clave) {
    const c = await cacheIA.leer(clave)
    if (c) return parsearJSON<T>(c)
  }
  await antesDeLlamar()
  try {
    const r = await p.generarJSON(mensajes, esquema, op)
    await usoIA.sumar(r.tokens)
    await eventos.registrar('ia', op.funcion ?? 'json')
    const datos = parsearJSON<T>(r.texto)
    if (clave) await cacheIA.guardar(clave, r.texto)
    return datos
  } catch (e) {
    return despuesDeError(e)
  }
}

/** Prueba la clave con una llamada mínima. */
export async function probarClave(): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const t = await iaTexto([{ rol: 'usuario', texto: 'Respondé solo con la palabra: listo' }], { funcion: 'prueba' })
    return { ok: true, mensaje: `Funciona. La IA respondió: "${t.trim().slice(0, 40)}"` }
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message }
  }
}
