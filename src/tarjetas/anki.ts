import JSZip from 'jszip'
import type { Database, SqlJsStatic } from 'sql.js'
import { unidadPorId } from '../contenido'
import { marca } from '../marca'
import type { ImagenTarjeta, Tarjeta } from '../repositorio/tipos'
import { ESTADO } from './fsrs'
import { unaPorNota } from './csv'

/**
 * Exportación a Anki (.apkg "legacy", esquema 11): un zip con `collection.anki2`
 * (SQLite armado en el navegador con sql.js) + archivos de imagen + `media`.
 * Básicas → modelo Básico; cloze → modelo Cloze (un hueco = una tarjeta, como en Anki);
 * oclusión → modelo Básico con la imagen y la máscara superpuesta en HTML.
 * Las tarjetas en repaso conservan intervalo y vencimiento aproximados.
 */

const ESQUEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`

/** Fecha de creación de la colección (segundos). Los vencimientos se cuentan en días desde acá. */
const CRT = 1_400_000_000
const ID_BASICO = 1_700_000_000_001
const ID_CLOZE = 1_700_000_000_002

const CSS = `.card { font-family: system-ui, Arial, sans-serif; font-size: 20px; text-align: center; color: #0f172a; background: #fff; }
.cloze { font-weight: bold; color: #0e7490; }
.nightMode .card { color: #e2e8f0; background: #111a2e; }
.ocl { position: relative; display: inline-block; max-width: 100%; }
.ocl img { max-width: 100%; display: block; }
.ocl .m { position: absolute; background: #f59e0b; border: 1px solid #b45309; }
.ocl .m.otra { background: #fde68a; }
.ocl .m.ok { background: transparent; border: 3px solid #dc2626; }`

function campo(nombre: string, ord: number) {
  return { name: nombre, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] }
}

function modelos(did: number) {
  const comun = { mod: Math.floor(Date.now() / 1000), usn: -1, did, css: CSS, latexPre: '', latexPost: '', latexsvg: false, tags: [], vers: [] }
  return {
    [ID_BASICO]: {
      ...comun, id: ID_BASICO, name: `${marca.nombre} · Básica`, type: 0, sortf: 0,
      flds: [campo('Frente', 0), campo('Dorso', 1), campo('Fuente', 2)],
      tmpls: [{ name: 'Tarjeta 1', ord: 0, qfmt: '{{Frente}}', afmt: '{{FrontSide}}<hr id=answer>{{Dorso}}<br><small>{{Fuente}}</small>', did: null, bqfmt: '', bafmt: '' }],
      req: [[0, 'any', [0]]],
    },
    [ID_CLOZE]: {
      ...comun, id: ID_CLOZE, name: `${marca.nombre} · Cloze`, type: 1, sortf: 0,
      flds: [campo('Texto', 0), campo('Extra', 1), campo('Fuente', 2)],
      tmpls: [{ name: 'Cloze', ord: 0, qfmt: '{{cloze:Texto}}', afmt: '{{cloze:Texto}}<br>{{Extra}}<br><small>{{Fuente}}</small>', did: null, bqfmt: '', bafmt: '' }],
    },
  }
}

function mazo(id: number, nombre: string) {
  return {
    id, name: nombre, mod: Math.floor(Date.now() / 1000), usn: -1, lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0],
    collapsed: false, browserCollapsed: false, desc: '', dyn: 0, conf: 1, extendNew: 0, extendRev: 0,
  }
}

const DCONF = {
  1: {
    id: 1, name: 'Default', mod: 0, usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true, dyn: false,
    new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
    lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
    rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, perDay: 200, minSpace: 1 },
  },
}

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

async function sha1Num(s: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))
  const b = new Uint8Array(buf)
  return ((b[0] << 24) >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3]
}

function guid() {
  const abc = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~'
  let s = ''
  for (let i = 0; i < 10; i++) s += abc[Math.floor(Math.random() * abc.length)]
  return s
}

function htmlOclusion(archivo: string, t: Tarjeta, revelar: boolean, activa?: string) {
  const ms = (t.mascaras ?? []).map((m) => {
    const esta = m.id === activa
    if (revelar && esta) return `<div class="m ok" style="left:${m.x * 100}%;top:${m.y * 100}%;width:${m.w * 100}%;height:${m.h * 100}%"></div>`
    return `<div class="m${esta ? '' : ' otra'}" style="left:${m.x * 100}%;top:${m.y * 100}%;width:${m.w * 100}%;height:${m.h * 100}%"></div>`
  }).join('')
  return `<div class="ocl"><img src="${archivo}">${ms}</div>`
}

export interface OpcionesApkg {
  /** sql.js ya inicializado (en tests); en el navegador se carga solo, con su .wasm. */
  sql?: SqlJsStatic
  imagenes?: Map<string, ImagenTarjeta>
  /** Texto de la columna "Fuente" (ej. "Guía del área, pág. 42"). */
  fuenteDe?: (t: Tarjeta) => string
}

export async function exportarApkg(tarjetas: Tarjeta[], op: OpcionesApkg = {}): Promise<Blob> {
  const SQL = op.sql ?? (await import('./sqlNavegador')).cargarSql()
  const db: Database = new (await SQL).Database()
  db.run(ESQUEMA)
  const ahora = Math.floor(Date.now() / 1000)

  // Un mazo por unidad: "Estudio Med::UP3".
  const decks: Record<number, ReturnType<typeof mazo>> = { 1: mazo(1, 'Default') }
  const idRaiz = 1_700_000_100_000
  decks[idRaiz] = mazo(idRaiz, marca.nombre)
  const mazoDe = (t: Tarjeta) => {
    const u = unidadPorId(t.unidadId)
    if (!u) return idRaiz
    const id = idRaiz + u.numero
    decks[id] ??= mazo(id, `${marca.nombre}::${u.sigla} · ${u.titulo}`)
    return id
  }

  const zip = new JSZip()
  const media: Record<string, string> = {}
  const archivoImagen = new Map<string, string>()
  const notas = unaPorNota(tarjetas)
  const porGrupo = new Map<string, Tarjeta[]>()
  for (const t of tarjetas) porGrupo.set(t.grupoId ?? t.id, [...(porGrupo.get(t.grupoId ?? t.id) ?? []), t])

  let idNota = Date.now()
  let idCarta = Date.now()
  const insNota = db.prepare('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  const insCarta = db.prepare('INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  let posNueva = 0

  const agregarCarta = (nid: number, did: number, ord: number, t: Tarjeta) => {
    const repaso = t.estado === ESTADO.repaso
    const ivl = repaso ? Math.max(1, Math.round(t.fsrs.scheduled_days)) : 0
    const due = repaso ? Math.floor((t.vence / 1000 - CRT) / 86400) : posNueva++
    insCarta.run([idCarta++, nid, did, ord, ahora, -1, repaso ? 2 : 0, t.suspendida ? -1 : repaso ? 2 : 0, due, ivl, repaso ? 2500 : 0, t.fsrs.reps, t.fsrs.lapses, 0, 0, 0, 0, ''])
  }

  for (const nota of notas) {
    const grupo = porGrupo.get(nota.grupoId ?? nota.id) ?? [nota]
    const fuente = escapar(op.fuenteDe?.(nota) ?? '')
    const tags = nota.etiquetas.map((e) => e.replace(/\s+/g, '_')).join(' ')
    const did = mazoDe(nota)
    if (nota.tipo === 'oclusion') {
      const img = nota.imagenId ? op.imagenes?.get(nota.imagenId) : undefined
      if (!img) continue
      if (!archivoImagen.has(img.id)) {
        const n = String(archivoImagen.size)
        const nombre = `estudiomed-${img.id}.${img.mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png'}`
        archivoImagen.set(img.id, nombre)
        media[n] = nombre
        zip.file(n, await img.archivo.arrayBuffer())
      }
      const archivo = archivoImagen.get(img.id)!
      // Anki no tiene oclusión en el modelo básico: una nota por máscara, con la imagen y el recuadro en HTML.
      for (const t of grupo) {
        const m = t.mascaras?.find((x) => x.id === t.mascara)
        const frente = `${escapar(t.frente)}${t.frente ? '<br>' : ''}${htmlOclusion(archivo, t, false, t.mascara)}`
        const dorso = `${htmlOclusion(archivo, t, true, t.mascara)}<br><b>${escapar(m?.etiqueta ?? '')}</b>${t.dorso ? `<br>${escapar(t.dorso)}` : ''}`
        const nid = idNota++
        insNota.run([nid, guid(), ID_BASICO, ahora, -1, tags, [frente, dorso, fuente].join('\x1f'), frente, await sha1Num(m?.etiqueta ?? frente), 0, ''])
        agregarCarta(nid, did, 0, t)
      }
      continue
    }
    const nid = idNota++
    if (nota.tipo === 'cloze') {
      const texto = escapar(nota.cloze ?? '')
      insNota.run([nid, guid(), ID_CLOZE, ahora, -1, tags, [texto, escapar(nota.dorso), fuente].join('\x1f'), texto, await sha1Num(texto), 0, ''])
      for (const t of grupo) agregarCarta(nid, did, (t.clozeN ?? 1) - 1, t)
    } else {
      const frente = escapar(nota.frente)
      insNota.run([nid, guid(), ID_BASICO, ahora, -1, tags, [frente, escapar(nota.dorso), fuente].join('\x1f'), frente, await sha1Num(frente), 0, ''])
      agregarCarta(nid, did, 0, nota)
    }
  }
  insNota.free()
  insCarta.free()

  db.run('INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [
    1, CRT, ahora * 1000, ahora * 1000, 11, 0, 0, 0,
    JSON.stringify({ nextPos: posNueva + 1, estTimes: true, activeDecks: [1], sortType: 'noteFld', timeLim: 0, sortBackwards: false, addToCur: true, curDeck: 1, newBury: true, newSpread: 0, dueCounts: true, curModel: String(ID_BASICO), collapseTime: 1200 }),
    JSON.stringify(modelos(idRaiz)), JSON.stringify(decks), JSON.stringify(DCONF), '{}',
  ])
  const bytes = db.export()
  db.close()
  zip.file('collection.anki2', bytes)
  zip.file('media', JSON.stringify(media))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}
