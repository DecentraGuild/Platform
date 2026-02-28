/**
 * Copies db/migrations SQL files into dist/migrations so the bundled app can run them.
 * Run after tsup build (see package.json).
 */
const fs = require('fs')
const path = require('path')

const from = path.join(__dirname, '..', 'src', 'db', 'migrations')
const to = path.join(__dirname, '..', 'dist', 'migrations')

if (!fs.existsSync(from)) {
  console.warn('copy-migrations: source dir not found, skipping')
  process.exit(0)
}
if (fs.existsSync(to)) {
  for (const name of fs.readdirSync(to)) {
    if (name.endsWith('.sql')) fs.unlinkSync(path.join(to, name))
  }
} else {
  fs.mkdirSync(to, { recursive: true })
}
for (const name of fs.readdirSync(from)) {
  if (name.endsWith('.sql')) {
    fs.copyFileSync(path.join(from, name), path.join(to, name))
  }
}
