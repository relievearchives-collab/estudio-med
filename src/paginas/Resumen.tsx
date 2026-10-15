import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CitaSup } from '../componentes/Citas'
import { useApp } from '../componentes/Contexto'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'
import { Markdown } from '../componentes/Markdown'
import { hayLectura, useLectorSegmentos } from '../componentes/voz'
import { nombreDisciplina, unidadPorId } from '../contenido'
import { notas } from '../repositorio'
import { useTemas } from '../repositorio/hooks'
import { markdownDeResumen, resumirTema, textoParaVoz, type ResumenTema } from '../resumen/resumir'

const VELOCIDADES = [0.8, 1, 1.2, 1.5]

export default function Resumen() {
  const { temaId = '' } = useParams()
  const tema = (useTemas() ?? []).find((t) => t.id === temaId)
  const [resumen, setResumen] = useState<ResumenTema | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const { avisar } = useApp()
  const navegar = useNavigate()

  useEffect(() => {
    let vigente = true
    resumirTema(temaId)
      .then((r) => { if (vigente) setResumen(r) })
      .catch((e) => { if (vigente) setError((e as Error).message) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [temaId])

  const textos = useMemo(() => (resumen?.segmentos ?? []).map((s) => textoParaVoz(s.texto)), [resumen])
  const lector = useLectorSegmentos(textos)

  const otraVersion = async () => {
    lector.detener()
    setCargando(true); setError('')
    try { setResumen(await resumirTema(temaId, { otraVersion: true })) } catch (e) { setError((e as Error).message) } finally { setCargando(false) }
  }
  const guardar = async () => {
    if (!resumen || !tema) return
    const n = await notas.crear({
      titulo: `Resumen: ${tema.nombre}`, markdown: await markdownDeResumen(`Resumen: ${tema.nombre}`, resumen),
      fragmentoIds: resumen.fragmentos.map((f) => f.id), temaIds: [temaId], origen: 'chat',
    })
    avisar('Guardado como nota', 'ok')
    navegar(`/notas/${n.id}`)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado
        volver
        titulo={<>Resumen{tema ? `: ${tema.nombre}` : ''}</>}
        subtitulo={tema ? `${unidadPorId(tema.unidadId)?.sigla} · ${nombreDisciplina(tema.disciplinaId)}` : undefined}
      />

      {cargando && <p className="tarjeta animate-pulse p-4 text-sm texto-suave">Armando el resumen con tus fuentes…</p>}
      {error && <p className="flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"><Icono nombre="alerta" className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

      {resumen && !cargando && (
        <>
          {hayLectura && textos.length > 0 && (
            <section className="tarjeta sticky top-2 z-10 flex flex-wrap items-center gap-2 p-3">
              {lector.estado === 'leyendo'
                ? <button className="btn-primario" onClick={lector.pausar}><Icono nombre="parlante" /> Pausa</button>
                : <button className="btn-primario" onClick={lector.reproducir}><Icono nombre="parlante" /> {lector.estado === 'pausa' ? 'Seguir' : 'Escuchar'}</button>}
              {lector.estado !== 'detenido' && <button className="btn-secundario" onClick={lector.detener}>Detener</button>}
              <span className="text-sm texto-suave">{lector.estado === 'detenido' ? `${textos.length} partes` : `Parte ${lector.indice + 1} de ${textos.length}`}</span>
              <label className="ml-auto flex items-center gap-1 text-sm">
                Velocidad
                <select className="campo !w-auto !py-1" value={lector.velocidad} onChange={(e) => lector.cambiarVelocidad(Number(e.target.value))}>
                  {VELOCIDADES.map((v) => <option key={v} value={v}>{String(v).replace('.', ',')}×</option>)}
                </select>
              </label>
            </section>
          )}
          {!hayLectura && <p className="text-sm texto-suave">Este navegador no puede leer en voz alta; podés leer el resumen acá abajo.</p>}

          <section className="tarjeta space-y-1 p-2 text-[15px]">
            {resumen.segmentos.map((s, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg p-2 transition ${lector.estado !== 'detenido' && lector.indice === i ? 'bg-marca/15' : ''}`}>
                {hayLectura && (
                  <button className="btn-fantasma mt-0.5 !p-1 opacity-60 hover:opacity-100" onClick={() => lector.irA(i)} aria-label={`Escuchar desde la parte ${i + 1}`}>
                    <Icono nombre="parlante" className="h-4 w-4" />
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <Markdown texto={s.texto} enLinea />{s.citas.map((c, k) => <CitaSup key={k} cita={c} numero={c.n} />)}
                  {s.cifraSinCita && <span className="mt-1 flex items-center gap-1 text-xs text-amber-600"><Icono nombre="alerta" className="h-3.5 w-3.5" />Cifra sin cita verificada: confirmala en tus fuentes.</span>}
                </div>
              </div>
            ))}
            {resumen.fueraDeFuentes && (
              <div className="m-2 rounded-xl border border-dashed border-amber-500/60 bg-amber-500/5 p-3 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">No está en tus apuntes (no se lee)</p>
                <Markdown texto={resumen.fueraDeFuentes} />
              </div>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            <button className="btn-secundario" onClick={guardar}><Icono nombre="nota" /> Guardar como nota</button>
            <button className="btn-secundario" onClick={otraVersion}><Icono nombre="deshacer" /> Otra versión</button>
            <button className="btn-fantasma" onClick={() => navegar(`/chat?alcance=tema&id=${temaId}`)}><Icono nombre="chat" /> Preguntar sobre el tema</button>
          </div>
          <p className="text-xs texto-suave">Con el parlante de cada parte escuchás desde ahí. La primera versión queda guardada: abrir este resumen de nuevo no gasta cuota de IA.</p>
        </>
      )}
    </div>
  )
}
