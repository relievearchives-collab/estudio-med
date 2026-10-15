import type { ComponentType } from 'react'

/** Simuladores disponibles (módulos reutilizables; qué área los usa y en qué UP está en el paquete de contenido). */
export interface Simulador {
  id: string
  titulo: string
  resumen: string
  cargar: () => Promise<{ default: ComponentType }>
}

export const simuladores: Simulador[] = [
  { id: 'compartimentos', titulo: 'Compartimentos líquidos (Darrow-Yannet)', resumen: 'Ganancias y pérdidas de agua y soluciones: cómo cambian LIC, LEC y osmolaridad.', cargar: () => import('./sim/Compartimentos') },
  { id: 'osmolaridad', titulo: 'Osmolaridad y tonicidad', resumen: 'mOsm/L, mEq/L, presión osmótica real y el glóbulo rojo en distintas soluciones.', cargar: () => import('./sim/Osmolaridad') },
  { id: 'starling', titulo: 'Filtración glomerular (Starling)', resumen: 'Presiones, Kf, TFG y FF; qué pasa al contraer la aferente o la eferente.', cargar: () => import('./sim/Starling') },
  { id: 'clearance', titulo: 'Clearance y TFG estimada', resumen: 'U×V/P, Cockcroft-Gault, MDRD y CKD-EPI; carga filtrada y excretada.', cargar: () => import('./sim/Clearance') },
  { id: 'tm-pah', titulo: 'Glucosa (Tm) y PAH', resumen: 'Curvas de titulación de glucosa, umbral renal y flujo plasmático renal.', cargar: () => import('./sim/TmPah') },
  { id: 'contracorriente', titulo: 'Multiplicador de contracorriente', resumen: 'El asa de Henle arma el gradiente medular paso a paso; urea y vasos rectos.', cargar: () => import('./sim/Contracorriente') },
  { id: 'adh-sraa', titulo: 'ADH, agua libre y SRAA', resumen: 'Deshidratación, sobrecarga de agua, hemorragia y dieta con sal; agua libre y FENa.', cargar: () => import('./sim/AdhSraa') },
  { id: 'acidobase', titulo: 'Ácido-base y gasometrías', resumen: 'Henderson-Hasselbalch, Davenport, exceso de bases e intérprete paso a paso.', cargar: () => import('./sim/AcidoBase') },
  { id: 'orina', titulo: 'Análisis de orina', resumen: 'Examen físico, químico y sedimento: interpretá casos.', cargar: () => import('./sim/Orina') },
]

export const simuladorPorId = (id?: string) => simuladores.find((s) => s.id === id)
