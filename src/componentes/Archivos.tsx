import { useRef, useState, type ReactNode } from 'react'
import { importarArchivos, importarTexto } from '../procesamiento/importar'
import { useApp } from './Contexto'
import { Icono } from './Icono'

/** Botón que abre el selector de archivos. */
export function BotonArchivo({ aceptar, multiple, alElegir, children, className = 'btn-secundario', capturar }: {
  aceptar: string; multiple?: boolean; alElegir: (f: File[]) => void; children: ReactNode; className?: string; capturar?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <button className={className} onClick={() => ref.current?.click()}>{children}</button>
      <input
        ref={ref} type="file" accept={aceptar} multiple={multiple} hidden {...(capturar ? { capture: 'environment' } : {})}
        onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) alElegir(fs) }}
      />
    </>
  )
}

/** Panel para sumar apuntes: PDF, foto (OCR) o texto pegado. */
export function AgregarApuntes({ alAgregar }: { alAgregar?: () => void }) {
  const { avisar } = useApp()
  const [pegando, setPegando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [texto, setTexto] = useState('')
  const elegir = async (fs: File[]) => {
    const r = await importarArchivos(fs)
    avisar(r.length ? `${r.length} fuente(s) en cola de procesamiento` : 'Formato no soportado (usá PDF o imagen)', r.length ? 'ok' : 'error')
    alAgregar?.()
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <BotonArchivo aceptar="application/pdf,.pdf" multiple alElegir={elegir}><Icono nombre="pdf" /> PDF</BotonArchivo>
        <BotonArchivo aceptar="image/*" multiple alElegir={elegir}><Icono nombre="subir" /> Imagen</BotonArchivo>
        <BotonArchivo aceptar="image/*" capturar alElegir={elegir}><Icono nombre="camara" /> Sacar foto</BotonArchivo>
        <button className="btn-secundario" onClick={() => setPegando((v) => !v)}><Icono nombre="texto" /> Pegar texto</button>
      </div>
      {pegando && (
        <div className="space-y-2">
          <input className="campo" placeholder="Nombre (ej. Clase de Starling)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <textarea className="campo min-h-32" placeholder="Pegá acá el texto…" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <button className="btn-primario" disabled={texto.trim().length < 20} onClick={async () => {
            await importarTexto(nombre.trim(), texto)
            setTexto(''); setNombre(''); setPegando(false)
            avisar('Texto agregado', 'ok'); alAgregar?.()
          }}>Agregar texto</button>
        </div>
      )}
      <p className="text-xs texto-suave">Las fotos de apuntes o del pizarrón se leen con OCR en tu dispositivo (la primera vez baja el idioma español, ~10 MB).</p>
    </div>
  )
}
