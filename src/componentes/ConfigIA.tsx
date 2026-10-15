import { useState } from 'react'
import { probarClave } from '../ia/cliente'
import { guardarAjuste, type Ajustes } from '../repositorio'
import { Icono } from './Icono'

export const AVISO_PRIVACIDAD = 'Usá solo material de estudio. Nunca cargues datos de pacientes reales. En el nivel gratuito, Google puede usar el contenido para mejorar sus productos (y puede haber revisión humana).'

/** Carga y prueba de la clave gratuita de Gemini (con guía paso a paso). */
export function ConfigIA({ ajustes, compacto = false }: { ajustes: Ajustes; compacto?: boolean }) {
  const [clave, setClave] = useState(ajustes.claveIA)
  const [ver, setVer] = useState(false)
  const [estado, setEstado] = useState<{ ok: boolean; mensaje: string } | null>(null)
  const [probando, setProbando] = useState(false)

  const probar = async () => {
    setProbando(true)
    await guardarAjuste('claveIA', clave.trim())
    setEstado(await probarClave())
    setProbando(false)
  }

  return (
    <div className="space-y-3">
      {!compacto && (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Entrá a <a className="text-marca underline dark:text-marca-claro" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a> con tu cuenta de Google.</li>
          <li>Aceptá las condiciones y tocá <b>“Create API key”</b> (Crear clave). Es gratis y <b>no pide tarjeta</b>.</li>
          <li>Copiá la clave (empieza con <code>AIza…</code>) y pegala acá abajo.</li>
          <li>Tocá <b>Probar</b>. Si dice “Funciona”, listo.</li>
        </ol>
      )}
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <div className="flex gap-2"><Icono nombre="alerta" className="h-5 w-5 shrink-0 text-amber-600" /><p><b>Privacidad:</b> {AVISO_PRIVACIDAD}</p></div>
      </div>
      <div className="flex gap-2">
        <input
          className="campo font-mono" type={ver ? 'text' : 'password'} placeholder="Pegá tu clave de Gemini" value={clave}
          onChange={(e) => { setClave(e.target.value); setEstado(null) }} autoComplete="off" spellCheck={false}
        />
        <button className="btn-fantasma" onClick={() => setVer((v) => !v)}>{ver ? 'Ocultar' : 'Ver'}</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primario" disabled={!clave.trim() || probando} onClick={probar}>{probando ? 'Probando…' : 'Guardar y probar'}</button>
        {ajustes.claveIA && (
          <button className="btn-secundario" onClick={async () => { await guardarAjuste('claveIA', ''); setClave(''); setEstado({ ok: true, mensaje: 'Clave borrada de este dispositivo.' }) }}>
            Borrar clave
          </button>
        )}
      </div>
      {estado && <p className={`text-sm ${estado.ok ? 'text-emerald-600' : 'text-red-600'}`}>{estado.mensaje}</p>}
      <p className="text-xs texto-suave">La clave se guarda solo en este dispositivo (nunca en un servidor nuestro) y viaja únicamente a Google cuando usás la IA.</p>
    </div>
  )
}
