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
