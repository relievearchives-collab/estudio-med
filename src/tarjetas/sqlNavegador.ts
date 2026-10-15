import initSqlJs, { type SqlJsStatic } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'

/** sql.js (SQLite en WASM, licencia MIT) se carga recién al exportar a Anki. */
let sql: Promise<SqlJsStatic> | null = null
export function cargarSql() {
  sql ??= initSqlJs({ locateFile: () => wasmUrl })
  return sql
}
