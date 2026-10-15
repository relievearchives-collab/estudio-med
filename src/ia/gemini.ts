import {
  ErrorClave, ErrorCuota, ErrorRed, type EsquemaJSON, type MensajeIA, type OpcionesIA, type ProveedorIA, type RespuestaIA,
} from './proveedor'

/**
 * Google Gemini (nivel gratuito, clave propia del estudiante creada en Google AI Studio).
 * API REST `models/{modelo}:generateContent`. La clave viaja solo a Google, en un encabezado.
 */
const BASE = 'https://generativelanguage.googleapis.com/v1beta'

interface ConfigGemini {
  clave: string
  modeloChat: string
  modeloLote: string
}

export function crearGemini(cfg: ConfigGemini): ProveedorIA {
  async function llamar(mensajes: MensajeIA[], op: OpcionesIA = {}, json?: EsquemaJSON): Promise<RespuestaIA> {
    if (!cfg.clave) throw new ErrorClave()
    const modelo = op.uso === 'lote' ? cfg.modeloLote : cfg.modeloChat
    const cuerpo: Record<string, unknown> = {
      contents: mensajes.map((m) => ({ role: m.rol === 'modelo' ? 'model' : 'user', parts: [{ text: m.texto }] })),
      generationConfig: {
        temperature: op.temperatura ?? 0.2,
        ...(op.maxTokens ? { maxOutputTokens: op.maxTokens } : {}),
        ...(json ? { responseMimeType: 'application/json', responseSchema: json } : {}),
      },
    }
    if (op.sistema) cuerpo.systemInstruction = { parts: [{ text: op.sistema }] }

    let r: Response
    try {
      r = await fetch(`${BASE}/models/${encodeURIComponent(modelo)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.clave },
        body: JSON.stringify(cuerpo),
        signal: op.senal,
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      throw new ErrorRed()
    }
    if (!r.ok) {
      const detalle = await r.text().catch(() => '')
      if (r.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(detalle)) throw new ErrorCuota()
      if (r.status === 400 && /API key/i.test(detalle)) throw new ErrorClave()
      if (r.status === 401 || r.status === 403) throw new ErrorClave()
      if (r.status === 404) throw new Error(`El modelo "${modelo}" no está disponible. Cambialo en Ajustes → IA.`)
      throw new Error(`Error de Gemini (${r.status}). ${detalle.slice(0, 200)}`)
    }
    const datos = await r.json()
    const cand = datos.candidates?.[0]
    const texto: string = (cand?.content?.parts ?? []).map((p: { text?: string; thought?: boolean }) => (p.thought ? '' : p.text ?? '')).join('')
    if (!texto) {
      const motivo = cand?.finishReason ?? datos.promptFeedback?.blockReason ?? 'sin texto'
      throw new Error(`La IA no devolvió respuesta (${motivo}).`)
    }
    return { texto, tokens: datos.usageMetadata?.totalTokenCount ?? 0 }
  }

  return {
    id: 'gemini',
    nombre: 'Google Gemini (gratis)',
    chat: (m, op) => llamar(m, op),
    generarJSON: (m, esquema, op) => llamar(m, op, esquema),
  }
}
