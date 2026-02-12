/**
 * Module id to route and label. Single source of truth.
 * Only implemented modules appear in nav.
 */

export const MODULE_ROUTES: Record<string, { path: string; label: string }> = {
  admin: { path: '/admin', label: 'Admin' },
  marketplace: { path: '/market', label: 'Market' },
  raffles: { path: '/raffle', label: 'Raffle' },
  whitelist: { path: '/whitelist', label: 'Whitelist' },
  minting: { path: '/mint', label: 'Mint' },
}

/** Modules that are implemented and can be shown in nav */
export const IMPLEMENTED_MODULES = new Set(['admin'])
