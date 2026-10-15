import { useLiveQuery } from 'dexie-react-hooks'
import { Encabezado } from '../componentes/Encabezado'
import { eventos as repoEventos, usoIA } from '../repositorio'
import { descargar } from './Ajustes'

const NOMBRES: Record<string, string> = {
  hoy: 'Hoy', biblioteca: 'Biblioteca', up: 'Unidades', fuente: 'Visor', chat: 'Chat', notas: 'Notas', buscar: 'Búsqueda',
  ajustes: 'Ajustes', estadisticas: 'Estadísticas', creditos: 'Créditos', mas: 'Más', bienvenida: 'Bienvenida',
  tarjetas: 'Tarjetas', repaso: 'Repaso', atlas: 'Atlas 3D', simuladores: 'Simuladores', practica: 'Práctica de parcial',
}

/** Estadísticas locales de uso, para evaluar la prueba. Nada sale del dispositivo salvo que se exporte. */
export default function Estadisticas() {
  const datos = useLiveQuery(async () => {
    const [evs, ia] = await Promise.all([repoEventos.todos(), usoIA.historial()])
    const minutos = evs.filter((e) => e.tipo === 'estudio').reduce((s, e) => s + (e.duracion ?? 0), 0) / 60
    const porDia = new Map<string, number>()
    for (const e of evs) if (e.tipo === 'estudio') {
      const d = new Date(e.fecha).toISOString().slice(0, 10)
      porDia.set(d, (porDia.get(d) ?? 0) + (e.duracion ?? 0) / 60)
    }
    const pantallas = new Map<string, number>()
    for (const e of evs) if (e.tipo === 'pantalla' && e.detalle) pantallas.set(e.detalle, (pantallas.get(e.detalle) ?? 0) + 1)
    const contar = (t: string) => evs.filter((e) => e.tipo === t).length
    return {
      evs, ia, minutos, porDia: [...porDia.entries()].sort().slice(-14),
      pantallas: [...pantallas.entries()].sort((a, b) => b[1] - a[1]),
      preguntas: contar('chat'), fuentes: contar('fuente'), llamadasIA: ia.reduce((s, x) => s + x.llamadas, 0),
      tarjetas: contar('repaso'), simuladores: contar('simulador'), museo: contar('museo'), rompecabezas: contar('rompecabezas'), preguntasParcial: contar('pregunta'), ejercicios: contar('ejercicio'), orales: contar('oral'), tutorias: contar('tutoria'),
    }
  }, [])
  if (!datos) return null
  const max = Math.max(1, ...datos.porDia.map(([, m]) => m))

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado titulo="Mis estadísticas" subtitulo="Se guardan solo en este dispositivo." acciones={
        <button className="btn-secundario" onClick={() => descargar(new Blob([JSON.stringify({ exportado: new Date().toISOString(), resumen: { ...datos, evs: undefined }, eventos: datos.evs }, null, 2)], { type: 'application/json' }), 'estadisticas-estudio-med.json')}>
          Exportar
        </button>
      } />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Dato n={Math.round(datos.minutos)} t="minutos de estudio" />
        <Dato n={datos.preguntas} t="preguntas al chat" />
        <Dato n={datos.llamadasIA} t="llamadas a la IA" />
        <Dato n={datos.fuentes} t="fuentes cargadas" />
        <Dato n={datos.tarjetas} t="tarjetas repasadas" />
        <Dato n={datos.museo} t="estructuras del atlas practicadas" />
        <Dato n={datos.rompecabezas} t="rompecabezas 3D armados" />
        <Dato n={datos.preguntasParcial} t="preguntas tipo parcial respondidas" />
        <Dato n={datos.ejercicios} t="ejercicios numéricos resueltos" />
        <Dato n={datos.simuladores} t="simuladores abiertos" />
        <Dato n={datos.orales} t="preguntas de examen oral" />
        <Dato n={datos.tutorias} t="tutorías ABP cerradas" />
      </div>
      <section className="tarjeta p-4">
        <h2 className="mb-3 text-sm font-semibold">Minutos por día (últimos 14 días con uso)</h2>
        {datos.porDia.length ? (
          <div className="flex h-36 items-end gap-1">
            {datos.porDia.map(([d, m]) => (
              <div key={d} className="flex flex-1 flex-col items-center gap-1" title={`${d}: ${Math.round(m)} min`}>
                <div className="w-full rounded-t bg-marca" style={{ height: `${(m / max) * 100}%`, minHeight: 2 }} />
                <span className="text-[10px] texto-suave">{d.slice(8)}/{d.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm texto-suave">Todavía no hay datos.</p>}
      </section>
      <section className="tarjeta p-4">
        <h2 className="mb-2 text-sm font-semibold">Funciones más usadas</h2>
        <ul className="space-y-1 text-sm">
          {datos.pantallas.map(([p, n]) => <li key={p} className="flex justify-between"><span>{NOMBRES[p] ?? p}</span><span className="texto-suave">{n} visitas</span></li>)}
        </ul>
      </section>
    </div>
  )
}

function Dato({ n, t }: { n: number; t: string }) {
  return <div className="tarjeta p-4"><div className="text-2xl font-bold">{n}</div><div className="text-xs texto-suave">{t}</div></div>
}
