import { marked } from 'marked'
import matter from 'gray-matter'

/**
 * Pre-load all docs at build time. Keys are paths like "general/getting-started.md"
 * (without leading "docs/").
 */
const docModules = import.meta.glob<string>('../../content/docs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export interface DocMeta {
  title: string
  description?: string
}

export interface ParsedDoc {
  meta: DocMeta
  html: string
}

/**
 * Load and parse a doc by slug. Slug for /docs/general/getting-started is ['general', 'getting-started'].
 * For /docs index, slug is [].
 */
export function useDocMarkdown(slug: string[]): ParsedDoc | null {
  const relPath = slug.length === 0 ? 'index.md' : `${slug.join('/')}.md`
  const fullKey = Object.keys(docModules).find((k) => k.replace(/\\/g, '/').endsWith(`docs/${relPath}`))
  const raw = fullKey ? (docModules[fullKey] as string) : undefined
  if (!raw || typeof raw !== 'string') return null

  const { data, content } = matter(raw)
  const html = marked.parse(content, { async: false }) as string
  return {
    meta: {
      title: (data.title as string) ?? 'Documentation',
      description: data.description as string | undefined,
    },
    html,
  }
}
