<template>
  <div class="theme-settings">
    <div class="theme-settings__form">
      <section class="theme-settings__section">
        <h3 class="theme-settings__heading">Branding</h3>
        <TextInput
          v-model="branding.logo"
          label="Logo URL"
          placeholder="https://..."
        />
      </section>

      <details class="theme-settings__section" open>
        <summary class="theme-settings__heading">Colors</summary>
        <p class="theme-settings__hint">Set main colours; hover and variants are derived.</p>
        <div class="theme-settings__grid theme-settings__grid--two">
          <div class="theme-settings__group">
            <h4 class="theme-settings__sub">Brand</h4>
            <ColorInput v-model="simpleColors.primary" label="Primary (buttons, links)" />
            <ColorInput v-model="simpleColors.secondary" label="Secondary" />
            <ColorInput v-model="simpleColors.accent" label="Accent" />
          </div>
          <div class="theme-settings__group">
            <h4 class="theme-settings__sub">Surfaces &amp; text</h4>
            <ColorInput v-model="simpleColors.backgroundPage" label="Background (page)" />
            <ColorInput v-model="simpleColors.textPrimary" label="Text" />
            <ColorInput v-model="simpleColors.textMuted" label="Text muted" />
            <ColorInput v-model="simpleColors.border" label="Border (leave empty to derive)" />
          </div>
          <div class="theme-settings__group">
            <h4 class="theme-settings__sub">Status</h4>
            <ColorInput v-model="simpleColors.statusSuccess" label="Success" />
            <ColorInput v-model="simpleColors.statusError" label="Error" />
            <ColorInput v-model="simpleColors.statusWarning" label="Warning" />
            <ColorInput v-model="simpleColors.statusInfo" label="Info" />
          </div>
          <div class="theme-settings__group">
            <h4 class="theme-settings__sub">Trade (market)</h4>
            <ColorInput v-model="simpleColors.tradeBuy" label="Buy" />
            <ColorInput v-model="simpleColors.tradeSell" label="Sell" />
            <ColorInput v-model="simpleColors.tradeTrade" label="Trade" />
          </div>
        </div>
      </details>

      <details class="theme-settings__section">
        <summary class="theme-settings__heading">Typography</summary>
        <p class="theme-settings__hint">Three sizes control the scale: small (labels, captions), body (main text), heading (titles).</p>
        <div class="theme-settings__group">
          <TextInput
            v-model="fontsPrimaryStr"
            label="Font family (primary)"
            placeholder="Inter, sans-serif"
          />
          <TextInput
            v-model="fontsMonoStr"
            label="Font family (mono)"
            placeholder="JetBrains Mono, monospace"
          />
        </div>
        <div class="theme-settings__typography-row">
          <TextInput v-model="typographySmall" label="Small (rem)" placeholder="0.875" />
          <TextInput v-model="typographyBody" label="Body (rem)" placeholder="1" />
          <TextInput v-model="typographyHeading" label="Heading (rem)" placeholder="1.25" />
        </div>
      </details>

      <details class="theme-settings__section">
        <summary class="theme-settings__heading">Rounding</summary>
        <p class="theme-settings__hint">One slider sets corner radius for the whole theme.</p>
        <div class="theme-settings__slider-row">
          <label class="theme-settings__slider-label" :for="sliderId">Sharp</label>
          <input
            :id="sliderId"
            v-model.number="radiusLevel"
            type="range"
            min="0"
            max="4"
            step="1"
            class="theme-settings__slider"
          />
          <label class="theme-settings__slider-label">Round</label>
        </div>
        <p class="theme-settings__slider-value">{{ radiusLabels[radiusLevel] }}</p>
      </details>

      <details class="theme-settings__section">
        <summary class="theme-settings__heading">Spacing &amp; effects</summary>
        <div class="theme-settings__grid theme-settings__grid--small">
          <TextInput v-model="branding.theme.spacing.xs" label="Space xs" />
          <TextInput v-model="branding.theme.spacing.sm" label="Space sm" />
          <TextInput v-model="branding.theme.spacing.md" label="Space md" />
          <TextInput v-model="branding.theme.spacing.lg" label="Space lg" />
          <TextInput v-model="branding.theme.spacing.xl" label="Space xl" />
          <TextInput v-model="branding.theme.spacing['2xl']" label="Space 2xl" />
        </div>
        <div class="theme-settings__grid theme-settings__grid--small">
          <TextInput v-model="branding.theme.borderWidth.thin" label="Border thin" />
          <TextInput v-model="branding.theme.borderWidth.medium" label="Border medium" />
          <TextInput v-model="branding.theme.borderWidth.thick" label="Border thick" />
        </div>
        <TextInput
          v-model="branding.theme.shadows.glow"
          label="Shadow glow"
          placeholder="0 0 20px rgba(...)"
        />
        <TextInput v-model="branding.theme.shadows.glowHover" label="Shadow glow hover" />
        <TextInput v-model="branding.theme.shadows.card" label="Shadow card" />
        <TextInput
          v-model="branding.theme.gradients.primary"
          label="Gradient primary"
          placeholder="linear-gradient(...)"
        />
        <TextInput v-model="branding.theme.gradients.secondary" label="Gradient secondary" />
        <TextInput v-model="branding.theme.gradients.accent" label="Gradient accent" />
      </details>
    </div>

    <aside class="theme-settings__preview" :style="previewStyle">
      <p class="theme-settings__preview-label">Preview</p>
      <div class="theme-settings__preview-content">
        <div class="theme-settings__preview-buttons">
          <button type="button" class="theme-settings__btn theme-settings__btn--primary">
            Primary
          </button>
          <button type="button" class="theme-settings__btn theme-settings__btn--secondary">
            Secondary
          </button>
        </div>
        <div class="theme-settings__preview-card">
          <p class="theme-settings__preview-title">Card title</p>
          <p class="theme-settings__preview-body">Body text and secondary text.</p>
          <p class="theme-settings__preview-muted">Muted caption</p>
        </div>
        <div class="theme-settings__preview-status">
          <span class="theme-settings__pill theme-settings__pill--success">Success</span>
          <span class="theme-settings__pill theme-settings__pill--error">Error</span>
          <span class="theme-settings__pill theme-settings__pill--warning">Warning</span>
          <span class="theme-settings__pill theme-settings__pill--info">Info</span>
        </div>
        <div class="theme-settings__preview-trade">
          <span class="theme-settings__chip theme-settings__chip--buy">Buy</span>
          <span class="theme-settings__chip theme-settings__chip--sell">Sell</span>
          <span class="theme-settings__chip theme-settings__chip--trade">Trade</span>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { TextInput, ColorInput } from '@decentraguild/ui/components'
import { themeToCssVars } from '@decentraguild/ui'
import type { TenantTheme, TenantThemeColors } from '@decentraguild/core'
import {
  lightenHex,
  darkenHex,
  mixHex,
  BORDER_RADIUS_PRESETS,
  getRadiusLevelFromTheme,
  parseRem,
} from '~/utils/themeHelpers'

const props = defineProps<{
  branding: {
    logo: string
    theme: TenantTheme
  }
}>()

const sliderId = `radius-slider-${Math.random().toString(36).slice(2)}`

const radiusLabels = ['None', 'Slight', 'Medium', 'Rounded', 'Full']

const simpleColors = reactive({
  primary: '',
  secondary: '',
  accent: '',
  backgroundPage: '',
  textPrimary: '',
  textMuted: '',
  border: '',
  statusSuccess: '',
  statusError: '',
  statusWarning: '',
  statusInfo: '',
  tradeBuy: '',
  tradeSell: '',
  tradeTrade: '',
})

const typographySmall = ref('0.875')
const typographyBody = ref('1')
const typographyHeading = ref('1.25')
const radiusLevel = ref(2)

function isValidHex(hex: string): boolean {
  return /^#?[0-9a-fA-F]{3}$/.test(hex.trim()) || /^#?[0-9a-fA-F]{6}$/.test(hex.trim())
}

function norm(hex: string): string {
  const s = String(hex).trim().replace(/^#/, '')
  if (s.length === 3) return '#' + s.split('').map((c) => c + c).join('')
  if (s.length === 6) return '#' + s
  return hex
}

function syncSimpleFromTheme() {
  const t = props.branding.theme
  const c = t.colors ?? {}
  simpleColors.primary = c.primary?.main ?? ''
  simpleColors.secondary = c.secondary?.main ?? ''
  simpleColors.accent = c.accent?.main ?? ''
  simpleColors.backgroundPage = c.background?.primary ?? ''
  simpleColors.textPrimary = c.text?.primary ?? ''
  simpleColors.textMuted = c.text?.muted ?? ''
  simpleColors.border = c.border?.default ?? ''
  simpleColors.statusSuccess = c.status?.success ?? ''
  simpleColors.statusError = c.status?.error ?? ''
  simpleColors.statusWarning = c.status?.warning ?? ''
  simpleColors.statusInfo = c.status?.info ?? ''
  simpleColors.tradeBuy = c.trade?.buy ?? ''
  simpleColors.tradeSell = c.trade?.sell ?? ''
  simpleColors.tradeTrade = c.trade?.trade ?? ''
  const fs = t.fontSize ?? {}
  typographySmall.value = String(parseRem(fs.sm ?? '0.875rem'))
  typographyBody.value = String(parseRem(fs.base ?? '1rem'))
  typographyHeading.value = String(parseRem(fs.lg ?? '1.125rem'))
  radiusLevel.value = getRadiusLevelFromTheme(t)
}

function applySimpleToTheme() {
  const c = props.branding.theme.colors ?? ({} as TenantThemeColors)
  const bg = simpleColors.backgroundPage && isValidHex(simpleColors.backgroundPage)
    ? norm(simpleColors.backgroundPage)
    : (c.background?.primary ?? '#1a1a2e')
  const borderDefault = simpleColors.border && isValidHex(simpleColors.border)
    ? norm(simpleColors.border)
    : darkenHex(bg, 0.12)
  const borderLight = lightenHex(borderDefault, 0.1)
  const textPri = simpleColors.textPrimary && isValidHex(simpleColors.textPrimary)
    ? norm(simpleColors.textPrimary)
    : (c.text?.primary ?? '#ffffff')
  const textMut = simpleColors.textMuted && isValidHex(simpleColors.textMuted)
    ? norm(simpleColors.textMuted)
    : (c.text?.muted ?? '#6b6b80')
  const textSec = mixHex(textPri, textMut, 0.5)

  const primary = simpleColors.primary && isValidHex(simpleColors.primary) ? norm(simpleColors.primary) : (c.primary?.main ?? '#00951a')
  const secondary = simpleColors.secondary && isValidHex(simpleColors.secondary) ? norm(simpleColors.secondary) : (c.secondary?.main ?? '#cf0000')
  const accent = simpleColors.accent && isValidHex(simpleColors.accent) ? norm(simpleColors.accent) : (c.accent?.main ?? '#8b5cf6')

  const colors: TenantThemeColors = {
    primary: {
      main: primary,
      hover: darkenHex(primary, 0.08),
      light: lightenHex(primary, 0.2),
      dark: darkenHex(primary, 0.15),
    },
    secondary: {
      main: secondary,
      hover: darkenHex(secondary, 0.08),
      light: lightenHex(secondary, 0.2),
      dark: darkenHex(secondary, 0.15),
    },
    accent: {
      main: accent,
      hover: darkenHex(accent, 0.1),
    },
    background: {
      primary: bg,
      secondary: lightenHex(bg, 0.03),
      card: lightenHex(bg, 0.05),
    },
    text: {
      primary: textPri,
      secondary: textSec,
      muted: textMut,
    },
    border: {
      default: borderDefault,
      light: borderLight,
    },
    status: {
      success: simpleColors.statusSuccess && isValidHex(simpleColors.statusSuccess) ? norm(simpleColors.statusSuccess) : (c.status?.success ?? '#00951a'),
      error: simpleColors.statusError && isValidHex(simpleColors.statusError) ? norm(simpleColors.statusError) : (c.status?.error ?? '#cf0000'),
      warning: simpleColors.statusWarning && isValidHex(simpleColors.statusWarning) ? norm(simpleColors.statusWarning) : (c.status?.warning ?? '#ff6b35'),
      info: simpleColors.statusInfo && isValidHex(simpleColors.statusInfo) ? norm(simpleColors.statusInfo) : (c.status?.info ?? '#00d4ff'),
    },
    trade: {
      buy: simpleColors.tradeBuy && isValidHex(simpleColors.tradeBuy) ? norm(simpleColors.tradeBuy) : (c.trade?.buy ?? '#00ff00'),
      buyHover: simpleColors.tradeBuy && isValidHex(simpleColors.tradeBuy) ? darkenHex(norm(simpleColors.tradeBuy), 0.1) : (c.trade?.buyHover ?? '#00cc00'),
      buyLight: simpleColors.tradeBuy && isValidHex(simpleColors.tradeBuy) ? lightenHex(norm(simpleColors.tradeBuy), 0.15) : (c.trade?.buyLight ?? '#33ff33'),
      sell: simpleColors.tradeSell && isValidHex(simpleColors.tradeSell) ? norm(simpleColors.tradeSell) : (c.trade?.sell ?? '#ff0000'),
      sellHover: simpleColors.tradeSell && isValidHex(simpleColors.tradeSell) ? darkenHex(norm(simpleColors.tradeSell), 0.1) : (c.trade?.sellHover ?? '#cc0000'),
      sellLight: simpleColors.tradeSell && isValidHex(simpleColors.tradeSell) ? lightenHex(norm(simpleColors.tradeSell), 0.15) : (c.trade?.sellLight ?? '#ff3333'),
      trade: simpleColors.tradeTrade && isValidHex(simpleColors.tradeTrade) ? norm(simpleColors.tradeTrade) : (c.trade?.trade ?? '#ffaa00'),
      tradeHover: simpleColors.tradeTrade && isValidHex(simpleColors.tradeTrade) ? darkenHex(norm(simpleColors.tradeTrade), 0.1) : (c.trade?.tradeHover ?? '#cc8800'),
      tradeLight: simpleColors.tradeTrade && isValidHex(simpleColors.tradeTrade) ? lightenHex(norm(simpleColors.tradeTrade), 0.15) : (c.trade?.tradeLight ?? '#ffbb33'),
      swap: accent,
      swapHover: darkenHex(accent, 0.1),
      swapLight: lightenHex(accent, 0.2),
    },
    window: {
      background: lightenHex(bg, 0.05),
      border: borderDefault,
      header: lightenHex(bg, 0.03),
    },
  }
  props.branding.theme.colors = colors
}

function applyTypographyToTheme() {
  const small = parseFloat(typographySmall.value) || 0.875
  const body = parseFloat(typographyBody.value) || 1
  const heading = parseFloat(typographyHeading.value) || 1.25
  const r = (v: number) => `${v}rem`
  props.branding.theme.fontSize = {
    xs: r(small * 0.9),
    sm: r(small),
    base: r(body),
    lg: r(heading),
    xl: r(heading * 1.1),
    '2xl': r(heading * 1.25),
    '3xl': r(heading * 1.5),
    '4xl': r(heading * 1.75),
    '5xl': r(heading * 2),
  }
}

function applyRadiusToTheme() {
  const preset = BORDER_RADIUS_PRESETS[Math.max(0, Math.min(4, radiusLevel.value))]
  props.branding.theme.borderRadius = {
    sm: preset.sm,
    md: preset.md,
    lg: preset.lg,
    xl: preset.xl,
    full: preset.full,
  }
}

let isSyncing = false
watch(
  () => props.branding,
  async () => {
    isSyncing = true
    syncSimpleFromTheme()
    await nextTick()
    isSyncing = false
  },
  { immediate: true }
)

watch(
  () => ({ ...simpleColors }),
  () => {
    if (!isSyncing) applySimpleToTheme()
  },
  { deep: true }
)

watch(
  [typographySmall, typographyBody, typographyHeading],
  () => {
    if (!isSyncing) applyTypographyToTheme()
  },
  { immediate: true }
)

watch(
  radiusLevel,
  () => {
    if (!isSyncing) applyRadiusToTheme()
  },
  { immediate: true }
)

const fontsPrimaryStr = computed({
  get: () => (props.branding.theme.fonts?.primary ?? []).join(', '),
  set: (v: string) => {
    props.branding.theme.fonts = props.branding.theme.fonts ?? { primary: [], mono: [] }
    props.branding.theme.fonts.primary = v.split(',').map((s) => s.trim()).filter(Boolean)
  },
})

const fontsMonoStr = computed({
  get: () => (props.branding.theme.fonts?.mono ?? []).join(', '),
  set: (v: string) => {
    props.branding.theme.fonts = props.branding.theme.fonts ?? { primary: [], mono: [] }
    props.branding.theme.fonts.mono = v.split(',').map((s) => s.trim()).filter(Boolean)
  },
})

const previewStyle = computed(() => {
  const vars = themeToCssVars(props.branding.theme)
  const style: Record<string, string> = {}
  for (const [key, value] of Object.entries(vars)) {
    if (value) style[key] = value
  }
  return style
})
</script>

<style scoped>
.theme-settings {
  display: grid;
  gap: var(--theme-space-xl);
}

@media (min-width: var(--theme-breakpoint-lg)) {
  .theme-settings {
    grid-template-columns: 1fr minmax(280px, 360px);
  }
  .theme-settings__preview {
    position: sticky;
    top: var(--theme-space-lg);
    align-self: start;
  }
}

.theme-settings__form {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
}

.theme-settings__section {
  padding: var(--theme-space-md);
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
}

.theme-settings__section > summary {
  list-style: none;
  cursor: pointer;
}

.theme-settings__section > summary::-webkit-details-marker {
  display: none;
}

.theme-settings__heading {
  font-size: var(--theme-font-lg);
  margin: 0 0 var(--theme-space-sm);
  color: var(--theme-text-primary);
}

.theme-settings__section[open] .theme-settings__heading {
  margin-bottom: var(--theme-space-md);
}

.theme-settings__hint {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  margin: 0 0 var(--theme-space-md);
}

.theme-settings__sub {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  margin: 0 0 var(--theme-space-xs);
}

.theme-settings__grid {
  display: grid;
  gap: var(--theme-space-md);
  margin-bottom: var(--theme-space-md);
}

.theme-settings__grid:last-child {
  margin-bottom: 0;
}

.theme-settings__grid--two {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.theme-settings__grid--small {
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}

.theme-settings__group {
  margin-bottom: var(--theme-space-md);
}

.theme-settings__group .color-input,
.theme-settings__group .text-input {
  margin-bottom: var(--theme-space-sm);
}

.theme-settings__typography-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--theme-space-md);
}

.theme-settings__slider-row {
  display: flex;
  align-items: center;
  gap: var(--theme-space-md);
  margin-bottom: var(--theme-space-xs);
}

.theme-settings__slider-label {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  flex-shrink: 0;
}

.theme-settings__slider {
  flex: 1;
  min-width: 0;
  height: 0.5rem;
  accent-color: var(--theme-primary);
}

.theme-settings__slider-value {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  margin: 0;
}

.theme-settings__preview {
  padding: var(--theme-space-lg);
  background: var(--theme-bg-primary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  box-shadow: var(--theme-shadow-card);
}

.theme-settings__preview-label {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  margin: 0 0 var(--theme-space-md);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.theme-settings__preview-content {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-lg);
}

.theme-settings__preview-buttons {
  display: flex;
  gap: var(--theme-space-sm);
  flex-wrap: wrap;
}

.theme-settings__btn {
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-sm);
  border-radius: var(--theme-radius-sm);
  border: var(--theme-border-thin) solid transparent;
  cursor: default;
}

.theme-settings__btn--primary {
  background: var(--theme-primary);
  color: var(--theme-text-primary);
  border-color: var(--theme-primary);
}

.theme-settings__btn--secondary {
  background: var(--theme-bg-secondary);
  color: var(--theme-text-primary);
  border-color: var(--theme-border);
}

.theme-settings__preview-card {
  padding: var(--theme-space-md);
  background: var(--theme-bg-card);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
}

.theme-settings__preview-title {
  font-size: var(--theme-font-lg);
  color: var(--theme-text-primary);
  margin: 0 0 var(--theme-space-xs);
}

.theme-settings__preview-body {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  margin: 0 0 var(--theme-space-xs);
}

.theme-settings__preview-muted {
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
  margin: 0;
}

.theme-settings__preview-status,
.theme-settings__preview-trade {
  display: flex;
  flex-wrap: wrap;
  gap: var(--theme-space-xs);
}

.theme-settings__pill {
  padding: var(--theme-space-xs) var(--theme-space-sm);
  font-size: var(--theme-font-xs);
  border-radius: var(--theme-radius-sm);
}

.theme-settings__pill--success {
  background: var(--theme-success);
  color: var(--theme-text-primary);
}

.theme-settings__pill--error {
  background: var(--theme-error);
  color: var(--theme-text-primary);
}

.theme-settings__pill--warning {
  background: var(--theme-warning);
  color: var(--theme-text-primary);
}

.theme-settings__pill--info {
  background: var(--theme-info);
  color: var(--theme-text-primary);
}

.theme-settings__chip {
  padding: var(--theme-space-xs) var(--theme-space-sm);
  font-size: var(--theme-font-xs);
  border-radius: var(--theme-radius-sm);
}

.theme-settings__chip--buy {
  background: var(--theme-trade-buy);
  color: var(--theme-text-primary);
}

.theme-settings__chip--sell {
  background: var(--theme-trade-sell);
  color: var(--theme-text-primary);
}

.theme-settings__chip--trade {
  background: var(--theme-trade-trade);
  color: var(--theme-text-primary);
}
</style>
