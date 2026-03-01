<template>
  <PageSection title="Modules">
    <div class="modules">
      <div
        v-if="expandedId === 'dguild'"
        class="modules__overlay"
        aria-hidden="true"
        @click="setExpanded('dguild')"
      />
      <div
        class="modules__center"
        :class="{ 'modules__center--expanded': expandedId === 'dguild' }"
      >
        <DguildCenter
          :expanded="expandedId === 'dguild'"
          @toggle="setExpanded('dguild')"
        />
      </div>

      <div class="modules__ring">
        <ModuleBlob
          v-for="item in positionedModules"
          :key="item.entry.id"
          :entry="item.entry"
          class="modules__blob"
          :style="blobStyle(item)"
          @click="openModule(item.entry)"
        />
      </div>

      <div class="modules__carousel" aria-label="Module list">
        <ModuleBlob
          v-for="entry in displayModules"
          :key="`carousel-${entry.id}`"
          :entry="entry"
          class="modules__carousel-item"
          @click="openModule(entry)"
        />
      </div>
    </div>

    <ModuleDetailModal
      :entry="modalModule"
      @close="modalModule = null"
    />
  </PageSection>
</template>

<script setup lang="ts">
import { PageSection } from '@decentraguild/ui/components'
import { getModuleCatalogList } from '@decentraguild/config'
import type { ModuleCatalogEntry } from '@decentraguild/config'
import DguildCenter from '~/components/DguildCenter.vue'
import ModuleBlob from '~/components/ModuleBlob.vue'
import ModuleDetailModal from '~/components/ModuleDetailModal.vue'

const expandedId = ref<string | null>('dguild')
const modalModule = ref<ModuleCatalogEntry | null>(null)

function setExpanded(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function openModule(entry: ModuleCatalogEntry) {
  modalModule.value = entry
}

const DISPLAY_STATUSES = new Set<'available' | 'coming_soon'>(['available', 'coming_soon'])

const displayModules = computed(() =>
  getModuleCatalogList().filter((m) => DISPLAY_STATUSES.has(m.status as 'available' | 'coming_soon'))
)

const INNER_RADIUS_VMIN = 20
const OUTER_RADIUS_VMIN = 30
const TWO_RING_THRESHOLD = 6

const positionedModules = computed(() => {
  const modules = displayModules.value
  const n = modules.length
  if (n === 0) return []

  if (n < TWO_RING_THRESHOLD) {
    return modules.map((entry, index) => {
      const angle = (index / n) * 2 * Math.PI - Math.PI / 2
      const x = Math.cos(angle) * OUTER_RADIUS_VMIN
      const y = Math.sin(angle) * OUTER_RADIUS_VMIN
      return { entry, x, y }
    })
  }

  const innerCount = Math.min(4, Math.ceil(n / 2))
  const outerCount = n - innerCount
  const result: Array<{ entry: ModuleCatalogEntry; x: number; y: number }> = []

  for (let i = 0; i < innerCount; i++) {
    const angle = (i / innerCount) * 2 * Math.PI - Math.PI / 2
    result.push({
      entry: modules[i],
      x: Math.cos(angle) * INNER_RADIUS_VMIN,
      y: Math.sin(angle) * INNER_RADIUS_VMIN,
    })
  }
  for (let i = 0; i < outerCount; i++) {
    const angle = (i / outerCount) * 2 * Math.PI - Math.PI / 2
    result.push({
      entry: modules[innerCount + i],
      x: Math.cos(angle) * OUTER_RADIUS_VMIN,
      y: Math.sin(angle) * OUTER_RADIUS_VMIN,
    })
  }
  return result
})

function blobStyle(item: { entry: ModuleCatalogEntry; x: number; y: number }) {
  return {
    '--blob-x': `${item.x}vmin`,
    '--blob-y': `${item.y}vmin`,
  }
}
</script>

<style scoped>
.modules {
  position: relative;
  min-height: min(80vh, 640px);
  max-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 5vmin;
  box-sizing: border-box;
}

.modules__center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.modules__center--expanded {
  z-index: 3;
}

.modules__ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 1px;
  height: 1px;
  pointer-events: none;
}

.modules__ring .modules__blob {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: auto;
  transform: translate(
    calc(-50% + var(--blob-x, 0)),
    calc(-50% + var(--blob-y, 0))
  );
}

.modules__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 2;
  cursor: pointer;
}

.modules__carousel {
  display: none;
  position: relative;
}

@media (max-width: var(--theme-breakpoint-md)) {
  .modules {
    min-height: auto;
    flex-direction: column;
    gap: var(--theme-space-xl);
    padding-bottom: var(--theme-space-lg);
  }

  .modules__center {
    position: static;
    transform: none;
  }

  .modules__ring {
    display: none;
  }

  .modules__carousel {
    display: flex;
    position: relative;
    width: 100%;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: var(--theme-space-md);
    padding: var(--theme-space-sm) 0;
    -webkit-overflow-scrolling: touch;
  }

  .modules__carousel-item {
    scroll-snap-align: center;
    flex: 0 0 min(280px, 85vw);
  }
}
</style>
