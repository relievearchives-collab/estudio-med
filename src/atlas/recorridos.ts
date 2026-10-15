/** Recorridos guiados: cada paso abre una escena y resalta una pieza, con un texto breve. */

export interface PasoRecorrido {
  escena: string
  pieza: string
  texto: string
  /** Mostrar los estrechamientos del uréter en este paso. */
  estrechamientos?: boolean
}

export interface Recorrido {
  id: string
  titulo: string
  descripcion: string
  pasos: PasoRecorrido[]
}

export const recorridos: Recorrido[] = [
  {
    id: 'camino-orina',
    titulo: 'Camino de la orina',
    descripcion: 'Del glomérulo a la uretra: dónde se forma la orina y por dónde sale.',
    pasos: [
      { escena: 'nefrona', pieza: 'glomerulo', texto: 'El plasma se filtra en el glomérulo (≈120 ml/min) y el filtrado pasa al espacio de la cápsula de Bowman.' },
      { escena: 'nefrona', pieza: 'tcp', texto: 'Túbulo contorneado proximal: se reabsorbe ≈65 % del agua y del Na⁺ y toda la glucosa; se secretan H⁺ y ácidos orgánicos.' },
      { escena: 'nefrona', pieza: 'asa-descendente-delgada', texto: 'Asa de Henle, rama descendente: sale agua hacia la médula hipertónica y el líquido se concentra.' },
      { escena: 'nefrona', pieza: 'asa-ascendente-gruesa', texto: 'Rama ascendente gruesa: sale NaCl (NKCC2) sin agua; el líquido se diluye y se arma el gradiente medular.' },
      { escena: 'nefrona', pieza: 'tcd', texto: 'Túbulo contorneado distal: reabsorbe NaCl (NCC) y Ca²⁺; la mácula densa vigila el NaCl que llega.' },
      { escena: 'nefrona', pieza: 'tubulo-colector', texto: 'Túbulo colector: la ADH decide cuánta agua se reabsorbe; la aldosterona, cuánto Na⁺ entra y cuánto K⁺ sale.' },
      { escena: 'rinon-interior', pieza: 'papila-renal', texto: 'Los colectores desembocan por los conductos papilares en el vértice de la pirámide: la papila renal.' },
      { escena: 'rinon-interior', pieza: 'caliz-menor', texto: 'La orina cae en un cáliz menor, que abraza a la papila.' },
      { escena: 'rinon-interior', pieza: 'caliz-mayor', texto: 'Varios cálices menores forman un cáliz mayor (habitualmente 2 o 3 por riñón).' },
      { escena: 'rinon-interior', pieza: 'pelvis-renal', texto: 'Los cálices mayores confluyen en la pelvis renal, que sale por el hilio.' },
      { escena: 'rinones', pieza: 'ureter-der', texto: 'El uréter lleva la orina por peristaltismo. Fijate en sus 3 estrechamientos: unión pieloureteral, cruce de los vasos ilíacos y unión ureterovesical.', estrechamientos: true },
      { escena: 'vejiga-uretra', pieza: 'vejiga', texto: 'La vejiga almacena la orina; los uréteres entran en forma oblicua por el trígono, lo que evita el reflujo.' },
      { escena: 'vejiga-uretra', pieza: 'uretra', texto: 'Por la uretra sale al exterior: en el hombre, porciones prostática, membranosa (esfínter externo) y esponjosa.' },
    ],
  },
  {
    id: 'camino-sangre-renal',
    titulo: 'Camino de la sangre renal',
    descripcion: 'De la aorta a la vena cava pasando por dos lechos capilares en serie.',
    pasos: [
      { escena: 'rinones', pieza: 'aorta-abdominal', texto: 'La aorta abdominal da las arterias renales a la altura de L1–L2. Los riñones reciben ≈20–25 % del gasto cardíaco.' },
      { escena: 'rinones', pieza: 'arteria-renal-der', texto: 'Arteria renal: la derecha es más larga y pasa por detrás de la vena cava inferior.' },
      { escena: 'rinon-interior', pieza: 'arteria-renal-esq', texto: 'En el seno se divide en segmentarias (terminales) → interlobulares (por las columnas) → arcuatas (en la base de las pirámides) → interlobulillares (en la corteza).' },
      { escena: 'nefrona', pieza: 'arteriola-aferente', texto: 'Cada interlobulillar da arteriolas aferentes: su tono regula la presión glomerular (autorregulación).' },
      { escena: 'nefrona', pieza: 'glomerulo', texto: 'Primer lecho capilar: el glomérulo, de alta presión, donde se filtra.' },
      { escena: 'nefrona', pieza: 'arteriola-eferente', texto: 'La sangre sale por la arteriola eferente (otra arteriola: un sistema porta arterial).' },
      { escena: 'nefrona', pieza: 'vasos-rectos', texto: 'Segundo lecho: capilares peritubulares en la corteza y, en las nefronas yuxtamedulares, los vasos rectos, que conservan el gradiente medular.' },
      { escena: 'rinon-interior', pieza: 'vena-renal-esq', texto: 'Las venas siguen el camino inverso y forman la vena renal en el hilio, por delante de la arteria.' },
      { escena: 'rinones', pieza: 'vena-renal-izq', texto: 'La vena renal izquierda, larga, cruza por delante de la aorta bajo la mesentérica superior.' },
      { escena: 'rinones', pieza: 'vci', texto: 'Ambas venas renales desembocan en la vena cava inferior, que vuelve al corazón.' },
    ],
  },
]

export const recorridoPorId = (id?: string) => recorridos.find((r) => r.id === id)
