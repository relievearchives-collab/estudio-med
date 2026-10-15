import { useState } from 'react'
import { BotonArchivo } from '../componentes/Archivos'
import { ConfigIA } from '../componentes/ConfigIA'
import { useApp } from '../componentes/Contexto'
import { Encabezado } from '../componentes/Encabezado'
import { paqueteActivo } from '../contenido'
import { invalidarIndice } from '../busqueda/hibrida'
import { AJUSTES_POR_DEFECTO, borrarTodo, cacheIA, guardarAjuste, sembrarTemas, type Ajustes as TAjustes } from '../repositorio'
import { useAjustes, useUsoIAHoy } from '../repositorio/hooks'
import { exportarRespaldo, importarRespaldo, nombreArchivoRespaldo } from '../repositorio/respaldo'

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function hacerBackup() {
  const blob = await exportarRespaldo()
  descargar(blob, nombreArchivoRespaldo())
  await guardarAjuste('ultimoBackup', Date.now())
  return blob.size
}

export function FechasParciales({ ajustes }: { ajustes: TAjustes }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {paqueteActivo.parciales.map((p) => (
        <label key={p.id} className="text-sm">
          <span className="mb-1 block font-medium">{p.nombre}</span>
          <input
            type="date" className="campo" value={ajustes.fechasParciales[p.id] ?? ''}
            onChange={(e) => guardarAjuste('fechasParciales', { ...ajustes.fechasParciales, [p.id]: e.target.value })}
          />
        </label>
      ))}
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="tarjeta space-y-3 p-4">
      <h2 className="font-semibold">{titulo}</h2>
      {children}
    </section>
  )
}

export default function Ajustes() {
  const a = useAjustes()
  const uso = useUsoIAHoy()
  const { avisar } = useApp()
  const [confirmaBorrar, setConfirmaBorrar] = useState(0)
  const [ocupado, setOcupado] = useState('')
  const [tema, setTema] = useState(() => { try { return localStorage.getItem('tema-visual') ?? 'sistema' } catch { return 'sistema' } })
  if (!a) return null

  const cambiarTema = (t: string) => {
    setTema(t)
    try { localStorage.setItem('tema-visual', t) } catch { /* sin almacenamiento */ }
    const oscuro = t === 'oscuro' || (t === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', oscuro)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado titulo="Ajustes" />

      <Seccion titulo="Inteligencia artificial">
        <div className="flex flex-wrap gap-2">
          {(['gemini', 'groq'] as const).map((p) => (
            <button key={p} className={a.proveedorIA === p ? 'chip-activo' : 'chip'} onClick={() => guardarAjuste('proveedorIA', p)}>
              {p === 'gemini' ? 'Google Gemini (recomendado)' : 'Groq (alternativa gratis)'}
            </button>
          ))}
        </div>
        {a.proveedorIA === 'gemini' ? <ConfigIA ajustes={a} compacto={!!a.claveIA} /> : (
          <label className="block text-sm">
            Clave de Groq (gratis en console.groq.com)
            <input className="campo mt-1 font-mono" type="password" defaultValue={a.claveGroq} onBlur={(e) => guardarAjuste('claveGroq', e.target.value.trim())} />
          </label>
        )}
        <p className="text-sm">
          Llamadas a la IA hoy: <b>{uso?.llamadas ?? 0}</b>{a.limiteDiarioIA ? ` de ${a.limiteDiarioIA}` : ''}
          {uso?.agotado && <span className="ml-2 text-red-600">· se agotó la cuota gratis de hoy</span>}
        </p>
        <details className="text-sm">
          <summary className="cursor-pointer texto-suave">Avanzado</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label>Modelo para el chat<input className="campo mt-1 font-mono" defaultValue={a.modeloChat} onBlur={(e) => guardarAjuste('modeloChat', e.target.value.trim() || AJUSTES_POR_DEFECTO.modeloChat)} /></label>
            <label>Modelo para lotes (tarjetas, preguntas)<input className="campo mt-1 font-mono" defaultValue={a.modeloLote} onBlur={(e) => guardarAjuste('modeloLote', e.target.value.trim() || AJUSTES_POR_DEFECTO.modeloLote)} /></label>
            <label>Tope diario propio (0 = sin tope)<input type="number" min={0} className="campo mt-1" defaultValue={a.limiteDiarioIA} onBlur={(e) => guardarAjuste('limiteDiarioIA', Math.max(0, Number(e.target.value) || 0))} /></label>
            <div className="flex items-end"><button className="btn-secundario" onClick={async () => { await cacheIA.vaciar(); avisar('Caché de respuestas vaciada', 'ok') }}>Vaciar caché de IA</button></div>
          </div>
          <p className="mt-2 text-xs texto-suave">Si Google cambia los nombres de los modelos gratuitos, actualizalos acá (ver ai.google.dev/gemini-api/docs/models).</p>
        </details>
      </Seccion>

      <Seccion titulo="Parciales">
        <FechasParciales ajustes={a} />
      </Seccion>

      <Seccion titulo="Respaldo">
        <p className="text-sm texto-suave">
          Todo vive en este dispositivo. Hacé un respaldo (.zip con tus datos, PDFs y tarjetas) y guardalo en Drive o mandátelo por mail.
          Para pasar a otro dispositivo, importalo ahí.
          {a.ultimoBackup ? ` Último respaldo: ${new Date(a.ultimoBackup).toLocaleDateString('es-AR')}.` : ' Todavía no hiciste ninguno.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primario" disabled={!!ocupado} onClick={async () => {
            setOcupado('exportar')
            try { const t = await hacerBackup(); avisar(`Respaldo descargado (${(t / 1e6).toFixed(1)} MB)`, 'ok') } catch (e) { avisar((e as Error).message, 'error') }
            setOcupado('')
          }}>{ocupado === 'exportar' ? 'Preparando…' : 'Exportar todo (.zip)'}</button>
          <BotonArchivo aceptar=".zip,application/zip" alElegir={async ([f]) => {
            if (!confirm('Importar reemplaza TODOS los datos de este dispositivo por los del respaldo. ¿Seguimos?')) return
            setOcupado('importar')
            try {
              const r = await importarRespaldo(f)
              invalidarIndice()
              await sembrarTemas()
              avisar(`Respaldo importado: ${r.fuentes} fuentes, ${r.fragmentos} fragmentos, ${r.notas} notas`, 'ok')
            } catch (e) { avisar((e as Error).message, 'error') }
            setOcupado('')
          }}>{ocupado === 'importar' ? 'Importando…' : 'Importar respaldo'}</BotonArchivo>
        </div>
      </Seccion>

      <Seccion titulo="Apariencia">
        <div className="flex gap-2">
          {[['sistema', 'Como el sistema'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([v, n]) => (
            <button key={v} className={tema === v ? 'chip-activo' : 'chip'} onClick={() => cambiarTema(v)}>{n}</button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Borrar todos los datos">
        <p className="text-sm texto-suave">Borra fuentes, notas, conversaciones, tarjetas y la clave de este dispositivo. No se puede deshacer: hacé un respaldo antes.</p>
        {confirmaBorrar === 0 && <button className="btn-secundario text-red-600" onClick={() => setConfirmaBorrar(1)}>Borrar todo…</button>}
        {confirmaBorrar === 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-red-600">¿Seguro? Se pierde todo lo que no tenga respaldo.</span>
            <button className="btn-peligro" onClick={() => setConfirmaBorrar(2)}>Sí, continuar</button>
            <button className="btn-secundario" onClick={() => setConfirmaBorrar(0)}>Cancelar</button>
          </div>
        )}
        {confirmaBorrar === 2 && (
          <ConfirmarTexto alConfirmar={async () => { await borrarTodo(); invalidarIndice(); await sembrarTemas(); location.hash = '#/bienvenida'; location.reload() }} alCancelar={() => setConfirmaBorrar(0)} />
        )}
      </Seccion>
    </div>
  )
}

function ConfirmarTexto({ alConfirmar, alCancelar }: { alConfirmar: () => void; alCancelar: () => void }) {
  const [t, setT] = useState('')
  return (
    <div className="space-y-2">
      <label className="block text-sm">Escribí <b>BORRAR</b> para confirmar:
        <input className="campo mt-1" value={t} onChange={(e) => setT(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button className="btn-peligro" disabled={t !== 'BORRAR'} onClick={alConfirmar}>Borrar definitivamente</button>
        <button className="btn-secundario" onClick={alCancelar}>Cancelar</button>
      </div>
    </div>
  )
}
