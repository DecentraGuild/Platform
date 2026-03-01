export interface DocsNavItem {
  path: string
  label: string
}

const docsOrder: DocsNavItem[] = [
  { path: '/docs', label: 'Overview' },
  { path: '/docs/general/getting-started', label: 'Getting started' },
  { path: '/docs/general/creating-a-dguild', label: 'Creating a dGuild' },
  { path: '/docs/general/directory', label: 'Directory' },
  { path: '/docs/general/billing-overview', label: 'Billing' },
  { path: '/docs/modules/admin', label: 'General' },
  { path: '/docs/modules/admin/domains-and-slugs', label: 'Domains and slugs' },
  { path: '/docs/modules/marketplace', label: 'General' },
  { path: '/docs/modules/marketplace/how-it-works', label: 'How it works' },
  { path: '/docs/modules/marketplace/collections-currencies', label: 'Collections and currencies' },
  { path: '/docs/modules/marketplace/fees-tiers', label: 'Fees and tiers' },
  { path: '/docs/modules/discord', label: 'General' },
  { path: '/docs/modules/discord/verify-flow', label: 'Verify flow' },
  { path: '/docs/modules/discord/setup', label: 'Setup and role rules' },
]

export function useDocsNav(currentPath: string): { prev: DocsNavItem | null; next: DocsNavItem | null } {
  const idx = docsOrder.findIndex((item) => item.path === currentPath)
  if (idx < 0) return { prev: null, next: null }
  return {
    prev: idx > 0 ? docsOrder[idx - 1] : null,
    next: idx < docsOrder.length - 1 ? docsOrder[idx + 1] : null,
  }
}
