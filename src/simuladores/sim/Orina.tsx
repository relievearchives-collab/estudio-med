import { useMemo, useState } from 'react'
import { mezclar } from '../../atlas/museo'
import { CitasGuia, EjercicioSim, Panel } from '../ui'

interface Caso {
  titulo: string
  contexto: string
  fisico: string
  quimico: string
  sedimento: string
  pregunta: string
  opciones: string[]
  correcta: number
  explicacion: string
}

/** Casos de análisis de orina (redacción propia, para practicar la interpretación). */
const CASOS: Caso[] = [
  {
    titulo: 'Disuria y polaquiuria', contexto: 'Mujer de 24 años con ardor al orinar y ganas frecuentes, sin fiebre.',
    fisico: 'Color amarillo, aspecto turbio, densidad 1,018.', quimico: 'pH 7,5; proteínas trazas; nitritos positivos; esterasa leucocitaria ++.',
    sedimento: 'Leucocitos > 30/campo, piocitos, bacterias abundantes, hematíes 5/campo. Sin cilindros.',
    pregunta: '¿Cuál es la interpretación más probable?', opciones: ['Infección urinaria baja (cistitis)', 'Pielonefritis aguda', 'Glomerulonefritis', 'Contaminación de la muestra'], correcta: 0,
    explicacion: 'Nitritos positivos (bacterias que reducen nitratos) y leucocituria sin cilindros leucocitarios ni fiebre: cistitis. Los cilindros leucocitarios indicarían compromiso renal (pielonefritis).',
  },
  {
    titulo: 'Edemas y orina espumosa', contexto: 'Hombre de 40 años con edemas en párpados y piernas.',
    fisico: 'Amarillo claro, espumosa, densidad 1,020.', quimico: 'Proteínas ++++ (proteinuria > 3,5 g/24 h); glucosa negativa; sangre negativa.',
    sedimento: 'Cilindros grasos, cuerpos ovales grasos ("cruces de Malta" con luz polarizada). Sin hematíes.',
    pregunta: '¿Qué síndrome sugiere?', opciones: ['Síndrome nefrótico', 'Síndrome nefrítico', 'Necrosis tubular aguda', 'Infección urinaria'], correcta: 0,
    explicacion: 'Proteinuria masiva con lipiduria (cilindros grasos, cuerpos ovales grasos) y sin hematuria: patrón nefrótico (lesión de la barrera de filtración).',
  },
  {
    titulo: 'Orina "color coca-cola" tras una faringitis', contexto: 'Niño de 9 años, hipertenso, con edemas, 2 semanas después de una faringitis.',
    fisico: 'Color pardo rojizo, densidad 1,022.', quimico: 'Sangre +++; proteínas ++.',
    sedimento: 'Hematíes dismórficos (acantocitos) y cilindros hemáticos.',
    pregunta: '¿De dónde viene la hematuria?', opciones: ['Glomerular (síndrome nefrítico)', 'Vía urinaria baja (vejiga)', 'Litiasis renal', 'Menstruación'], correcta: 0,
    explicacion: 'Los hematíes dismórficos y, sobre todo, los cilindros hemáticos se forman en el túbulo: la sangre viene del glomérulo (glomerulonefritis posestreptocócica).',
  },
  {
    titulo: 'Poliuria y sed', contexto: 'Joven de 17 años con pérdida de peso, poliuria y polidipsia.',
    fisico: 'Amarillo claro, densidad 1,030.', quimico: 'Glucosa ++++; cuerpos cetónicos +++; pH 5,0.',
    sedimento: 'Sin elementos patológicos.',
    pregunta: '¿Qué explica la glucosuria?', opciones: ['Glucemia por encima del umbral renal (se supera el Tm)', 'Daño tubular proximal con glucemia normal', 'Infección urinaria', 'Dieta rica en azúcares'], correcta: 0,
    explicacion: 'La glucemia supera la capacidad de reabsorción del túbulo proximal (Tm): diabetes descompensada con cetoacidosis (cetonuria, orina ácida). La densidad alta se debe a la glucosa.',
  },
  {
    titulo: 'Insuficiencia renal aguda tras un shock', contexto: 'Paciente internado que estuvo hipotenso varias horas; creatinina en aumento.',
    fisico: 'Turbia, densidad 1,010 (isostenuria).', quimico: 'Proteínas +; sangre negativa.',
    sedimento: 'Cilindros granulosos pardos ("barrosos") y células epiteliales tubulares.',
    pregunta: '¿Qué indica el sedimento?', opciones: ['Necrosis tubular aguda', 'Causa prerrenal pura', 'Glomerulonefritis', 'Obstrucción urinaria'], correcta: 0,
    explicacion: 'Los cilindros granulosos pardos y las células tubulares indican daño tubular. En la falla prerrenal el sedimento es "blando" (cilindros hialinos) y la orina está concentrada.',
  },
  {
    titulo: 'Deshidratación', contexto: 'Adulto mayor con diarrea de 3 días y poca ingesta de líquidos.',
    fisico: 'Amarillo oscuro, densidad 1,032.', quimico: 'Sin hallazgos.',
    sedimento: 'Cilindros hialinos aislados.',
    pregunta: '¿Cómo se interpreta?', opciones: ['Orina concentrada adecuada a la hipovolemia (prerrenal)', 'Daño tubular', 'Síndrome nefrítico', 'Infección urinaria'], correcta: 0,
    explicacion: 'Densidad alta (ADH alta, túbulo funcionante) y cilindros hialinos (proteína de Tamm-Horsfall, pueden verse sin enfermedad renal): respuesta renal adecuada a la hipovolemia.',
  },
  {
    titulo: 'Ictericia', contexto: 'Paciente con ictericia, prurito y heces claras.',
    fisico: 'Color pardo oscuro ("coca-cola"), espuma amarilla.', quimico: 'Bilirrubina ++; urobilinógeno negativo.',
    sedimento: 'Sin hematíes.',
    pregunta: '¿Qué sugiere la combinación?', opciones: ['Colestasis (obstrucción biliar)', 'Hemólisis', 'Hematuria', 'Rabdomiólisis'], correcta: 0,
    explicacion: 'Solo la bilirrubina conjugada (hidrosoluble) aparece en orina; con urobilinógeno ausente (no llega bilis al intestino) sugiere colestasis. En la hemólisis el urobilinógeno aumenta y la bilirrubina urinaria es negativa.',
  },
  {
    titulo: 'Después de una maratón', contexto: 'Corredor con dolor muscular intenso tras una carrera; orina oscura.',
    fisico: 'Pardo rojiza.', quimico: 'Sangre +++ en la tira reactiva.',
    sedimento: 'Sin hematíes.',
    pregunta: '¿Qué explica "sangre +++" sin hematíes?', opciones: ['Mioglobinuria (rabdomiólisis)', 'Hematuria glomerular', 'Infección urinaria', 'Error: la tira nunca da falsos positivos'], correcta: 0,
    explicacion: 'La tira detecta la actividad peroxidasa del grupo hemo: da positiva con hemoglobina o mioglobina libres aunque no haya hematíes en el sedimento.',
  },
]

const VALORES = [
  ['Densidad', '1,003–1,030 (isostenuria ≈ 1,010)'], ['pH', '4,5–8 (habitual ≈ 6)'], ['Proteínas', 'negativo o trazas (< 150 mg/24 h)'],
  ['Glucosa', 'negativa'], ['Cuerpos cetónicos', 'negativos'], ['Sangre / hemoglobina', 'negativa'], ['Nitritos', 'negativos'],
  ['Leucocitos', '< 5 por campo'], ['Hematíes', '< 3 por campo'], ['Cilindros', 'hialinos aislados pueden ser normales'],
]

export default function Orina() {
  const [i, setI] = useState(0)
  const [elegida, setElegida] = useState<number | null>(null)
  const c = CASOS[i]
  // La respuesta correcta no siempre en el mismo lugar
  const orden = useMemo(() => mezclar(c.opciones.map((_, k) => k)), [c])
  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed">
          El análisis de orina tiene tres partes: examen físico (color, aspecto, densidad), químico (tira reactiva) y sedimento (microscopía).
          Los cilindros se forman en el túbulo: indican que lo que contienen viene del riñón. Interpretá cada caso.
        </p>
        <CitasGuia simulador="orina" />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Panel titulo={`Caso ${i + 1} de ${CASOS.length}: ${c.titulo}`}>
          <p className="text-sm">{c.contexto}</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-black/5 p-2 dark:bg-white/5"><dt className="text-xs font-semibold texto-suave">Examen físico</dt><dd>{c.fisico}</dd></div>
            <div className="rounded-xl bg-black/5 p-2 dark:bg-white/5"><dt className="text-xs font-semibold texto-suave">Examen químico</dt><dd>{c.quimico}</dd></div>
            <div className="rounded-xl bg-black/5 p-2 dark:bg-white/5"><dt className="text-xs font-semibold texto-suave">Sedimento</dt><dd>{c.sedimento}</dd></div>
          </dl>
          <p className="text-sm font-medium">{c.pregunta}</p>
          <div className="grid gap-2">
            {orden.map((k) => {
              const o = c.opciones[k]
              const marca = elegida === null ? '' : k === c.correcta ? 'border-emerald-500 bg-emerald-500/10' : k === elegida ? 'border-red-500 bg-red-500/10' : ''
              return <button key={k} disabled={elegida !== null} onClick={() => setElegida(k)} className={`rounded-xl border px-3 py-2 text-left text-sm borde hover:bg-black/5 dark:hover:bg-white/5 ${marca}`}>{o}</button>
            })}
          </div>
          {elegida !== null && <p className={`rounded-xl p-3 text-sm ${elegida === c.correcta ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}><b>{elegida === c.correcta ? '✓ Correcto. ' : '✗ No. '}</b>{c.explicacion}</p>}
          <div className="flex gap-2">
            <button className="btn-secundario" disabled={i === 0} onClick={() => { setI(i - 1); setElegida(null) }}>Anterior</button>
            <button className="btn-primario" disabled={i === CASOS.length - 1} onClick={() => { setI(i + 1); setElegida(null) }}>Siguiente caso</button>
          </div>
        </Panel>
        <Panel titulo="Valores de referencia">
          <ul className="space-y-1 text-xs">{VALORES.map(([a, b]) => <li key={a} className="flex justify-between gap-2"><span className="font-medium">{a}</span><span className="text-right texto-suave">{b}</span></li>)}</ul>
        </Panel>
      </div>
      <EjercicioSim simulador="orina" />
    </div>
  )
}
