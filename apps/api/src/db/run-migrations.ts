/**
 * Runs all SQL migration files in db/migrations/ in lexicographic order.
 * Node-pg runs one statement per query(), so we split each file into statements
 * (respecting $$ ... $$ blocks) and run them in sequence.
 */

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { query } from './client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Dev: this file lives in src/db/, so migrations/ is sibling. Prod: bundle is dist/index.js, copy-migrations fills dist/migrations.
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

export interface MigrationLog {
  warn: (obj: unknown, msg?: string) => void
}

/** Split SQL into single statements; do not split inside comments (--) or dollar-quoted strings ($$). */
function splitSqlStatements(sql: string): string[] {
  const out: string[] = []
  let buf = ''
  let i = 0
  let inDollar = false
  let dollarTag = ''
  let inLineComment = false
  const len = sql.length
  while (i < len) {
    if (inLineComment) {
      if (sql[i] === '\n' || sql[i] === '\r') inLineComment = false
      buf += sql[i]
      i++
      continue
    }
    if (!inDollar && sql[i] === '-' && sql[i + 1] === '-') {
      inLineComment = true
      buf += '--'
      i += 2
      continue
    }
    if (inDollar) {
      if (sql[i] === '$' && sql.slice(i, i + dollarTag.length) === dollarTag) {
        buf += dollarTag
        i += dollarTag.length
        inDollar = false
        continue
      }
      buf += sql[i]
      i++
      continue
    }
    if (sql[i] === '$') {
      const rest = sql.slice(i)
      const match = rest.match(/^\$([^$]*)\$/)
      if (match) {
        dollarTag = match[0]
        buf += dollarTag
        i += dollarTag.length
        inDollar = true
        continue
      }
    }
    if (sql[i] === ';' && !inDollar && !inLineComment) {
      const stmt = buf.trim()
      if (stmt) out.push(stmt)
      buf = ''
      i++
      while (i < len && /[\s\n\r]/.test(sql[i])) i++
      continue
    }
    buf += sql[i]
    i++
  }
  const stmt = buf.trim()
  if (stmt) out.push(stmt)
  return out
}

export async function runMigrations(log: MigrationLog): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file)
    const sql = readFileSync(filePath, 'utf-8').trim()
    if (!sql) continue
    const statements = splitSqlStatements(sql)
    for (let s = 0; s < statements.length; s++) {
      const stmt = statements[s]
      if (!stmt) continue
      try {
        await query(stmt)
      } catch (e) {
        log.warn({ err: e, file, statementIndex: s }, 'Migration statement skipped (table/column may exist)')
      }
    }
  }
}
