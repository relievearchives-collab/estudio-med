import { Link } from 'react-router-dom'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'

export default function Mas({ items }: { items: { a: string; nombre: string; icono: string }[] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado titulo="Más" />
      <ul className="tarjeta divide-y divide-[var(--borde)]">
        {items.map((i) => (
          <li key={i.a}>
            <Link to={i.a} className="flex items-center gap-3 p-4"><Icono nombre={i.icono} /><span className="flex-1">{i.nombre}</span><Icono nombre="der" className="h-4 w-4 texto-suave" /></Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
