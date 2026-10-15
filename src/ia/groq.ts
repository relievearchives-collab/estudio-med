import {
  ErrorClave, ErrorCuota, ErrorRed, type EsquemaJSON, type MensajeIA, type OpcionesIA, type ProveedorIA, type RespuestaIA,
} from './proveedor'

/**
 * Segundo proveedor gratuito: Groq (API compatible con OpenAI, nivel gratuito con clave propia
 * en console.groq.com). También sirve para Ollama local cambiando `base` a
 * http://localhost:11434/v1 y `clave` a cualquier texto (ver DECISIONES.md).
 */
interface ConfigCompatibleOpenAI {
  clave: string
  base?: string
  modeloChat?: string
  modeloLote?: string
  id?: string
  nombre?: string
}

export function crearGroq(cfg: ConfigCompatibleOpenAI): ProveedorIA {
  const base = cfg.base ?? 'https://api.groq.com/openai/v1'
  async function llamar(mensajes: MensajeIA[], op: OpcionesIA = {}, json?: EsquemaJSON): Promise<RespuestaIA> {
    if (!cfg.clave) throw new ErrorClave()
    const modelo = op.uso === 'lote' ? (cfg.modeloLote ?? 'llama-3.1-8b-instant') : (cfg.modeloChat ?? 'llama-3.3-70b-versatile')
    const msgs = [
      ...(op.sistema || json
        ? [{ role: 'system', content: (op.sistema ?? '') + (json ? `\nRespondé SOLO con JSON válido que cumpla este esquema: ${JSON.stringify(json)}` : '') }]
        : []),
      ...mensajes.map((m) => ({ role: m.rol === 'modelo' ? 'assistant' : 'user', content: m.texto })),
    ]
    let r: Response
    try {
      r = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.clave}` },
        body: JSON.stringify({
          model: modelo, messages: msgs, temperature: op.temperatura ?? 0.2,
          ...(op.maxTokens ? { max_tokens: op.maxTokens } : {}),
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: op.senal,
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      throw new ErrorRed()
    }
    if (r.status === 429) throw new ErrorCuota()
    if (r.status === 401 || r.status === 403) throw new ErrorClave()
    if (!r.ok) throw new Error(`Error del proveedor (${r.status}).`)
    const d = await r.json()
    return { texto: d.choices?.[0]?.message?.content ?? '', tokens: d.usage?.total_tokens ?? 0 }
  }
  return {
    id: cfg.id ?? 'groq',
    nombre: cfg.nombre ?? 'Groq (gratis)',
    chat: (m, op) => llamar(m, op),
    generarJSON: (m, e, op) => llamar(m, op, e),
  }
}
