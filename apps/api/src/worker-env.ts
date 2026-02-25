/**
 * Load apps/api/.env so the worker finds DATABASE_URL etc. when run from repo root (pnpm --filter api worker:dev).
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
