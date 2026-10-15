import { buscarFragmentos } from '../busqueda/hibrida'
import { verificarRespuesta, type RespuestaCitadaIA } from '../citas/verificar'
import { iaJSON } from '../ia/cliente'
import { armarPromptChat, ESQUEMA_CHAT, SISTEMA_CHAT, type ModoChat } from '../ia/prompts/chatConCitas'
import { embeberConsulta } from '../procesamiento/cola'
import { chats, eventos, fuentes, nuevoId } from '../repositorio'
import type { Chat, Fragmento, MensajeChat } from '../repositorio/tipos'

/** Cantidad de fragmentos que se mandan a la IA (el PROMPT pide 8–12). */
const FRAGMENTOS_POR_PREGUNTA = 10

export async function etiquetaFragmento(f: Fragmento) {
  const fuente = await fuentes.obtener(f.fuenteId)
  return `${fuente?.nombre ?? 'Fuente'}, pág. ${f.pagina}`
}

/** Resumen corto de los últimos turnos, para preguntas de seguimiento ("¿y eso por qué?"). */
function historialBreve(c: Chat) {
  return c.mensajes.slice(-4).map((m) => {
    const t = m.rol === 'usuario' ? m.texto : (m.segmentos?.map((s) => s.texto).join(' ') ?? m.texto)
    return `${m.rol === 'usuario' ? 'Estudiante' : 'Tutor'}: ${t.slice(0, 400)}`
  }).join('\n')
}

/**
 * Flujo completo de una pregunta: recuperación híbrida local → IA con fragmentos
 * numerados → verificación de citas → se guarda en la conversación.
 */
export async function preguntar(chatId: string, pregunta: string, modo: ModoChat): Promise<void> {
  const chat = await chats.obtener(chatId)
  if (!chat) throw new Error('La conversación no existe.')
  const msgUsuario: MensajeChat = { id: nuevoId('m-'), rol: 'usuario', texto: pregunta, modo, fecha: Date.now() }
  const titulo = chat.mensajes.length ? chat.titulo : pregunta.slice(0, 70)
  const conPregunta: Chat = { ...chat, titulo, mensajes: [...chat.mensajes, msgUsuario] }
  await chats.guardar(conPregunta)
  await eventos.registrar('chat', modo)

  // Para preguntas de seguimiento, la búsqueda usa también la pregunta anterior.
  const anterior = chat.mensajes.filter((m) => m.rol === 'usuario').slice(-1)[0]?.texto ?? ''
  const consulta = pregunta.length < 60 && anterior ? `${anterior} ${pregunta}` : pregunta
  const vector = await embeberConsulta(consulta, 30000)
  const frags = await buscarFragmentos(consulta, { alcance: chat.alcance, limite: FRAGMENTOS_POR_PREGUNTA, vector })

  let respuesta: MensajeChat
  if (!frags.length) {
    respuesta = {
      id: nuevoId('m-'), rol: 'ia', texto: '', fecha: Date.now(), sinInformacion: true, segmentos: [{ texto: 'No encontré nada sobre esto en tus fuentes dentro del alcance elegido. Probá ampliar el alcance a "Todo" o cargá material sobre el tema.', citas: [] }],
    }
  } else {
    const etiquetas = await Promise.all(frags.map(etiquetaFragmento))
    const prompt = armarPromptChat(pregunta, frags.map((f, i) => ({ texto: f.texto, etiqueta: etiquetas[i] })), modo, chat.mensajes.length ? historialBreve(chat) : '')
    try {
      const r = await iaJSON<RespuestaCitadaIA>([{ rol: 'usuario', texto: prompt }], ESQUEMA_CHAT, { sistema: SISTEMA_CHAT, uso: 'chat', cache: true, funcion: 'chat' })
      const v = verificarRespuesta(r, frags)
      respuesta = {
        id: nuevoId('m-'), rol: 'ia', texto: v.segmentos.map((s) => s.texto).join('\n\n'), segmentos: v.segmentos,
        fueraDeFuentes: v.fueraDeFuentes, sinInformacion: v.sinInformacion, fragmentoIds: frags.map((f) => f.id), modo, fecha: Date.now(),
      }
    } catch (e) {
      respuesta = { id: nuevoId('m-'), rol: 'ia', texto: '', error: (e as Error).message, fragmentoIds: frags.map((f) => f.id), fecha: Date.now() }
    }
  }
  const actual = (await chats.obtener(chatId)) ?? conPregunta
  await chats.guardar({ ...actual, titulo, mensajes: [...actual.mensajes, respuesta] })
}
