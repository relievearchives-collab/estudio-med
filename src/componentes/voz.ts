import { useCallback, useEffect, useRef, useState } from 'react'

/** Dictado y lectura en voz alta con la Web Speech API del navegador (gratis, sin servidor propio). */

interface Reconocimiento {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

const ClaseReconocimiento = (globalThis as unknown as { SpeechRecognition?: new () => Reconocimiento; webkitSpeechRecognition?: new () => Reconocimiento })
const Constructor = ClaseReconocimiento.SpeechRecognition ?? ClaseReconocimiento.webkitSpeechRecognition

export const hayDictado = !!Constructor
export const hayLectura = typeof speechSynthesis !== 'undefined'

export function useDictado(alTexto: (t: string) => void) {
  const [escuchando, setEscuchando] = useState(false)
  const rec = useRef<Reconocimiento | null>(null)
  const cb = useRef(alTexto)
  cb.current = alTexto
  const alternar = useCallback(() => {
    if (!Constructor) return
    if (rec.current) { rec.current.stop(); return }
    const r = new Constructor()
    r.lang = 'es-AR'
    r.interimResults = false
    r.continuous = false
    r.onresult = (e) => {
      const t = Array.from(e.results).map((x) => x[0].transcript).join(' ')
      if (t) cb.current(t)
    }
    r.onend = () => { rec.current = null; setEscuchando(false) }
    r.onerror = () => { rec.current = null; setEscuchando(false) }
    rec.current = r
    setEscuchando(true)
    r.start()
  }, [])
  useEffect(() => () => rec.current?.stop(), [])
  return { escuchando, alternar }
}

export function leerEnVozAlta(texto: string) {
  if (!hayLectura) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(texto.replace(/[*#>|`_]/g, ' '))
  u.lang = 'es-AR'
  const voz = speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'))
  if (voz) u.voice = voz
  speechSynthesis.speak(u)
}
export const callarVoz = () => hayLectura && speechSynthesis.cancel()

export type EstadoLector = 'detenido' | 'leyendo' | 'pausa'

/** Voz en español, preferentemente rioplatense. */
function vozEspanol() {
  const voces = speechSynthesis.getVoices()
  return voces.find((v) => v.lang === 'es-AR') ?? voces.find((v) => v.lang.startsWith('es-4') || v.lang === 'es-US') ?? voces.find((v) => v.lang.startsWith('es'))
}

/**
 * Lee una lista de textos de a uno (para resaltar el que suena), con pausa, velocidad y salto.
 * Cada lectura lleva un número de turno: los `onend` de lecturas canceladas se ignoran.
 */
export function useLectorSegmentos(textos: string[]) {
  const [indice, setIndice] = useState(0)
  const [estado, setEstado] = useState<EstadoLector>('detenido')
  const [velocidad, setVelocidad] = useState(1)
  const turno = useRef(0)
  const lista = useRef(textos)
  useEffect(() => { lista.current = textos }, [textos])

  const leerDesde = useCallback((inicio: number, vel: number) => {
    if (!hayLectura) return
    const mio = ++turno.current
    speechSynthesis.cancel()
    // Si quedó en pausa, el motor no lee nada nuevo hasta reanudar.
    speechSynthesis.resume()
    const leer = (i: number) => {
      if (turno.current !== mio) return
      if (i >= lista.current.length) { setEstado('detenido'); setIndice(0); return }
      setIndice(i)
      setEstado('leyendo')
      const u = new SpeechSynthesisUtterance(lista.current[i])
      u.lang = 'es-AR'
      u.rate = vel
      const voz = vozEspanol()
      if (voz) u.voice = voz
      u.onend = () => leer(i + 1)
      u.onerror = () => { if (turno.current === mio) setEstado('detenido') }
      speechSynthesis.speak(u)
    }
    leer(inicio)
  }, [])

  const detener = useCallback(() => { turno.current++; if (hayLectura) speechSynthesis.cancel(); setEstado('detenido') }, [])
  useEffect(() => () => { turno.current++; if (hayLectura) speechSynthesis.cancel() }, [])

  return {
    indice, estado, velocidad,
    reproducir: () => {
      if (estado === 'pausa') { speechSynthesis.resume(); setEstado('leyendo') } else leerDesde(indice, velocidad)
    },
    pausar: () => { if (hayLectura) speechSynthesis.pause(); setEstado('pausa') },
    detener: () => { detener(); setIndice(0) },
    irA: (i: number) => leerDesde(i, velocidad),
    cambiarVelocidad: (v: number) => { setVelocidad(v); if (estado === 'leyendo') leerDesde(indice, v) },
  }
}
