/**
 * Builds a config-driven hierarchical tree for the marketplace left panel.
 * Type (NFT, SPL, Currency) -> optional group levels (0..3 from groupPath) -> asset leaves.
 * Used by MarketTree and MarketBrowseView.
 */
import type { Ref } from 'vue'
import type { ScopeEntry } from './useMarketplaceScope'
import type { MarketplaceSettings } from '~/stores/tenant'

const GROUP_PATH_MAX = 3
const SOURCE_TO_TYPE = {
  collection: 'NFT',
  spl_asset: 'SPL',
  currency: 'Currency',
} as const

export type TreeNodeKind = 'type' | 'group' | 'asset'

export interface TreeNode {
  id: string
  label: string
  kind: TreeNodeKind
  mint?: string
  collectionMint?: string | null
  children?: TreeNode[]
  path: string[]
}

export interface MarketplaceTreeInput {
  entries: ScopeEntry[]
  settings: MarketplaceSettings | null
}

function getAssetLabel(mint: string, settings: MarketplaceSettings | null): string {
  if (!settings) return mint.slice(0, 8) + '...'
  const coll = settings.collectionMints?.find((c) => c.mint === mint)
  if (coll?.name) return coll.name
  const curr = settings.currencyMints?.find((c) => c.mint === mint)
  if (curr?.name) return curr.name
  const spl = settings.splAssetMints?.find((s) => s.mint === mint)
  if (spl?.name) return spl.name
  return mint.slice(0, 8) + '...'
}

function getGroupPath(item: { groupPath?: string[] }): string[] {
  const raw = item.groupPath ?? []
  return raw.slice(0, GROUP_PATH_MAX)
}

function buildTree(input: MarketplaceTreeInput): TreeNode[] {
  const { entries, settings } = input
  const mintsSet = new Set(entries.map((e) => e.mint))

  const typeNodes: TreeNode[] = []
  const typeById = new Map<string, TreeNode>()

  for (const [source, typeLabel] of Object.entries(SOURCE_TO_TYPE)) {
    const typeId = `type:${source}`
    const node: TreeNode = { id: typeId, label: typeLabel, kind: 'type', path: [typeLabel], children: [] }
    typeNodes.push(node)
    typeById.set(typeId, node)
  }

  const collectionMints = settings?.collectionMints ?? []
  const currencyMints = settings?.currencyMints ?? []
  const splAssetMints = settings?.splAssetMints ?? []

  const collectionMintsInScope = collectionMints.filter((c) => mintsSet.has(c.mint))
  const currencyMintsInScope = currencyMints
  const splMintsInScope = splAssetMints

  function addAssetToType(typeId: string, mint: string, label: string, collectionMint: string | null, groupPath: string[]) {
    const typeNode = typeById.get(typeId)
    if (!typeNode || !typeNode.children) return

    const assetNode: TreeNode = {
      id: `asset:${mint}`,
      label,
      kind: 'asset',
      mint,
      collectionMint,
      path: [],
      children: undefined,
    }

    if (groupPath.length === 0) {
      assetNode.path = [...typeNode.path, label]
      typeNode.children.push(assetNode)
      return
    }

    let parent: TreeNode = typeNode
    let currentPath = [...typeNode.path]

    for (let i = 0; i < groupPath.length; i++) {
      const seg = groupPath[i]
      currentPath.push(seg)
      const groupId = `group:${typeId}:${groupPath.slice(0, i + 1).join(':')}`

      let groupNode = parent.children?.find((c) => c.id === groupId)
      if (!groupNode) {
        groupNode = { id: groupId, label: seg, kind: 'group', path: [...currentPath], children: [] }
        if (!parent.children) parent.children = []
        parent.children.push(groupNode)
      }
      parent = groupNode
    }

    assetNode.path = [...currentPath, label]
    if (!parent.children) parent.children = []
    parent.children.push(assetNode)
  }

  for (const item of collectionMintsInScope) {
    const groupPath = getGroupPath(item)
    const label = item.name ?? getAssetLabel(item.mint, settings)
    addAssetToType('type:collection', item.mint, label, item.mint, groupPath)
  }

  for (const item of currencyMintsInScope) {
    const groupPath = getGroupPath(item)
    const label = item.name ?? item.symbol ?? getAssetLabel(item.mint, settings)
    addAssetToType('type:currency', item.mint, label, null, groupPath)
  }

  for (const item of splMintsInScope) {
    const groupPath = getGroupPath(item)
    const label = item.name ?? item.symbol ?? getAssetLabel(item.mint, settings)
    addAssetToType('type:spl_asset', item.mint, label, null, groupPath)
  }

  return typeNodes
}

function getChildrenOfNode(node: TreeNode): TreeNode[] {
  return node.children ?? []
}

function collectDescendantAssets(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = []
  for (const n of nodes) {
    if (n.kind === 'asset' && n.mint) out.push(n)
    if (n.children?.length) out.push(...collectDescendantAssets(n.children))
  }
  return out
}

export function useMarketplaceTree(
  entries: Ref<ScopeEntry[]>,
  settings: Ref<MarketplaceSettings | null>
) {
  const tree = computed<TreeNode[]>(() =>
    buildTree({ entries: entries.value, settings: settings.value })
  )

  const selectedNodeId = ref<string | null>(null)
  const selectedDetailMint = ref<string | null>(null)
  const selectedNode = computed<TreeNode | null>(() => {
    const id = selectedNodeId.value
    if (!id) return null

    function find(nodes: TreeNode[]): TreeNode | null {
      for (const n of nodes) {
        if (n.id === id) return n
        const found = n.children ? find(n.children) : null
        if (found) return found
      }
      return null
    }
    return find(tree.value)
  })

  const selectedMint = computed(() => selectedNode.value?.mint ?? null)
  const selectedCollectionMint = computed(() => selectedNode.value?.collectionMint ?? null)

  const childNodesForSelection = computed(() => {
    const node = selectedNode.value
    if (!node) {
      return tree.value
    }
    return getChildrenOfNode(node)
  })

  const descendantAssetNodes = computed(() => {
    const node = selectedNode.value
    const toSearch = node ? getChildrenOfNode(node) : tree.value
    return collectDescendantAssets(toSearch)
  })

  function selectNode(id: string | null) {
    selectedNodeId.value = id
    if (id && id.startsWith('asset:')) {
      function find(nodes: TreeNode[]): TreeNode | null {
        for (const n of nodes) {
          if (n.id === id) return n
          const found = n.children ? find(n.children) : null
          if (found) return found
        }
        return null
      }
      const node = find(tree.value)
      if (node?.kind === 'asset' && node.mint && node.mint !== node.collectionMint) {
        selectedDetailMint.value = node.mint
        return
      }
    }
    selectedDetailMint.value = null
  }

  function setSelectedDetailMint(mint: string | null) {
    selectedDetailMint.value = mint
  }

  return {
    tree,
    selectedNodeId,
    selectedNode,
    selectedMint,
    selectedCollectionMint,
    selectedDetailMint,
    childNodesForSelection,
    descendantAssetNodes,
    selectNode,
    setSelectedDetailMint,
  }
}
