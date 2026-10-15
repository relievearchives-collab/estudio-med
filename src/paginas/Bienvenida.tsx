import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgregarApuntes, BotonArchivo } from '../componentes/Archivos'
import { ConfigIA } from '../componentes/ConfigIA'
import { useApp } from '../componentes/Contexto'
import { EstadoFuente } from '../componentes/EstadoFuente'
import { Icono } from '../componentes/Icono'
import { paqueteActivo } from '../contenido'
import { marca } from '../marca'
import { importarArchivos } from '../procesamiento/importar'
import { guardarAjuste } from '../repositorio'
import { useAjustes, useFuentes } from '../repositorio/hooks'
import { FechasParciales } from './Ajustes'

export default function Bienvenida() {
  const ajustes = useAjustes()
  const lista = useFuentes() ?? []
  const [paso, setPaso] = useState(0)
  const navegar = useNavigate()
  const { avisar } = useApp()
  if (!ajustes) return null
  const guia = lista.find((f) => f.esGuia)
  const apuntes = lista.filter((f) => !f.esGuia)

  const terminar = async () => {
    await guardarAjuste('bienvenidaCompleta', true)
    navegar('/')
  }

  const pasos = ['Clave de IA', 'Guía del área', 'Tus apuntes']
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        <span className="h-12 w-12" dangerouslySetInnerHTML={{ __html: marca.logoSvg }} />
        <div>
          <h1 className="text-2xl font-bold">{marca.nombre}</h1>
          <p className="text-sm texto-suave">{paqueteActivo.area} · {paqueteActivo.carrera}, {paqueteActivo.universidad}</p>
        </div>
      </header>

      <ol className="mb-6 flex gap-2">
        {pasos.map((p, i) => (
          <li key={p} className="flex-1">
            <button onClick={() => setPaso(i)} className={`w-full rounded-full py-1 text-xs font-medium ${i === paso ? 'bg-marca text-white' : i < paso ? 'bg-marca/20' : 'bg-black/5 dark:bg-white/10'}`}>
              {i + 1}. {p}
            </button>
          </li>
        ))}
      </ol>

      <section className="tarjeta flex-1 p-5">
        {paso === 0 && (
          <>
            <h2 className="mb-1 text-lg font-semibold">1. Tu clave gratuita de Gemini</h2>
            <p className="mb-4 text-sm texto-suave">La IA es la de Google, en su nivel gratis. Con tu propia clave no pagás nada. Sin clave igual podés usar biblioteca, visor, notas, búsqueda y todo lo que no usa IA.</p>
            <ConfigIA ajustes={ajustes} />
          </>
        )}
        {paso === 1 && (
          <>
            <h2 className="mb-1 text-lg font-semibold">2. Importá la guía del área</h2>
            <p className="mb-4 text-sm texto-suave">
              El árbol de las {paqueteActivo.unidades.length} Unidades Problema, sus disciplinas y temas ya viene armado. La guía en PDF (te la pasa Franco) se procesa en tu dispositivo como primera fuente:
              así cada respuesta se cita con la página exacta. No se sube a ningún lado.
            </p>
            {guia ? (
              <div className="tarjeta p-3">
                <p className="mb-2 font-medium">{guia.nombre}{guia.paginas ? ` · ${guia.paginas} páginas` : ''}</p>
                <EstadoFuente f={guia} />
                <p className="mt-2 text-xs texto-suave">Podés seguir mientras se procesa: no hace falta esperar.</p>
              </div>
            ) : (
              <BotonArchivo className="btn-primario" aceptar="application/pdf,.pdf" alElegir={async (fs) => {
                const r = await importarArchivos(fs.slice(0, 1), { esGuia: true })
                if (r.length) avisar('Guía en proceso', 'ok')
              }}>
                <Icono nombre="pdf" /> Elegir el PDF de la guía
              </BotonArchivo>
            )}
          </>
        )}
        {paso === 2 && (
          <>
            <h2 className="mb-1 text-lg font-semibold">3. Tus apuntes (opcional)</h2>
            <p className="mb-4 text-sm texto-suave">Sumá PDFs, fotos de apuntes o del pizarrón, o texto pegado. Después podés agregar más desde la Biblioteca.</p>
            <AgregarApuntes />
            {apuntes.length > 0 && (
              <ul className="mt-4 space-y-2">
                {apuntes.map((f) => <li key={f.id} className="tarjeta p-3"><p className="mb-1 text-sm font-medium">{f.nombre}</p><EstadoFuente f={f} /></li>)}
              </ul>
            )}
            <div className="mt-6 border-t pt-4 borde">
              <h3 className="mb-2 text-sm font-semibold">Fechas de los parciales (para la cuenta regresiva)</h3>
              <FechasParciales ajustes={ajustes} />
            </div>
          </>
        )}
      </section>

      <footer className="mt-4 flex items-center justify-between gap-2">
        <button className="btn-fantasma" onClick={terminar}>Saltear por ahora</button>
        <div className="flex gap-2">
          {paso > 0 && <button className="btn-secundario" onClick={() => setPaso((p) => p - 1)}>Atrás</button>}
          {paso < 2 ? <button className="btn-primario" onClick={() => setPaso((p) => p + 1)}>Siguiente</button> : <button className="btn-primario" onClick={terminar}>Empezar a estudiar</button>}
        </div>
      </footer>
    </div>
  )
}
