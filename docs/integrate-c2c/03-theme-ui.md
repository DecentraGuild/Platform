# C2C Reference: Theme and UI

Extracted from `_integrate/C2C` for use when implementing in DecentraGuild. Describes theme structure, CSS variables, and UI patterns.

---

## Theme Store Structure

Theme object shape (default + overrides from storefront JSON):

```js
{
  id: string,
  name: string,
  description?: string,
  colors: {
    primary: { main, hover, light, dark },
    secondary: { main, hover, light, dark },
    accent: { main, hover },
    background: { primary, secondary, card },
    text: { primary, secondary, muted },
    border: { default, light },
    status: { success, error, warning, info },
    trade: { buy, buyHover, buyLight, sell, sellHover, sellLight, trade, tradeHover, tradeLight, swap, swapHover, swapLight },
    window: { background, border, header }
  },
  fonts: { primary: string[], mono: string[] },
  fontSize: { xs, sm, base, lg, xl, '2xl', '3xl', '4xl', '5xl' },
  spacing: { xs, sm, md, lg, xl, '2xl' },
  borderRadius: { sm, md, lg, xl, full },
  borderWidth: { thin, medium, thick },
  branding: { logo, name, shortName },
  shadows: { glow, glowHover, card },
  gradients: { primary, secondary, accent },
  metadata: { source: 'default'|'json'|'nft'|'storefront', ... }
}
```

---

## CSS Custom Properties (theme store applies to :root)

| Property | Example |
|----------|---------|
| --theme-primary | #00951a |
| --theme-primary-hover | #00b820 |
| --theme-bg-primary | #0a0a0f |
| --theme-bg-secondary | #141420 |
| --theme-bg-card | #1a1a2e |
| --theme-text-primary | #ffffff |
| --theme-text-secondary | #a0a0b3 |
| --theme-text-muted | #6b6b80 |
| --theme-border | #2a2a3e |
| --theme-trade-buy | #00ff00 |
| --theme-trade-sell | #ff0000 |
| --theme-trade-trade | #ffaa00 |
| --theme-trade-swap | #6366f1 |
| --theme-window-bg | #1a1a2e |
| --theme-font-xs … --theme-font-5xl | rem values |
| --theme-space-xs … --theme-space-2xl | rem values |
| --theme-radius-sm … --theme-radius-full | 0.5rem, 9999px |
| --theme-shadow-glow | 0 0 20px rgba(...) |
| --theme-gradient-primary | linear-gradient(...) |

---

## Legacy Aliases (style.css)

For backward compatibility:

- `--primary-bg` = `var(--theme-bg-primary)`
- `--card-bg` = `var(--theme-bg-card)`
- `--primary-color` = `var(--theme-primary)`
- `--text-primary` = `var(--theme-text-primary)`
- `--border-color` = `var(--theme-border)`
- etc.

---

## Tailwind Integration

`tailwind.config.js` extends theme with CSS vars:

- `colors`: primary-bg, card-bg, primary-color, text-primary, border-color, trade-buy, etc.
- `fontFamily`: primary, mono
- `fontSize`: theme-xs … theme-5xl
- `spacing`: theme-xs … theme-2xl
- `borderRadius`: theme-sm … theme-full, plus sm/md/lg/xl/2xl wired to theme
- `backgroundImage`: gradient-primary, gradient-secondary, gradient-accent
- `boxShadow`: glow, glow-hover, card
- `screens`: nav-compact at 800px (icon-only vs icon+text)

---

## Component Classes

| Class | Purpose |
|-------|---------|
| btn-primary | Gradient bg, glow on hover, 44px min-height |
| btn-secondary | Card bg, border, primary overlay on hover |
| btn-cancel | Secondary color border and text |
| link-red | Secondary (red) for links |
| input-field | Card bg, 16px font (iOS zoom avoid), themed focus |
| card | Card bg, border, themed radius, shadow |
| section-banner | Gradient primary, rounded top |
| text-gradient | Gradient primary, bg-clip-text |
| collection-scroll-container | RTL, thin scrollbar |
| base-scroll-area | Themed scrollbar |
| safe-area-* | env(safe-area-inset-*) |
| wallet-button-custom | Navbar wallet button styled like btn-primary |
| wallet-button-compact | Icon-only wallet button |

---

## Storefront Theme Merge

When loading storefront theme:

1. Start from default theme
2. Deep merge `storefront.colors`, `storefront.fontSize`, `storefront.spacing`, etc.
3. `loadStorefrontTheme(storefront)` builds themeData and calls `themeStore.loadTheme(themeData)`
4. Persisted to localStorage (`dguild_escrow_theme_data`, `dguild_escrow_selected_theme`)

---

## Route-Aware Theme

- `STOREFRONT_ROUTE_PATHS`: marketplace, create, manage, escrow detail
- On storefront routes: if `storefront?.colors` → `loadStorefrontTheme(storefront)`; else `resetToDefault()`
- On home/onboard: `resetToDefault()`
- Watched in App.vue: `route.path` + `storefrontStore.selectedStorefront`

---

## Mobile Considerations

- Body: `padding: env(safe-area-inset-*)`
- Min height: `100dvh` for keyboard
- Input font-size 16px minimum (prevents iOS zoom)
- Touch targets: 44px min-height for buttons
- Screens: `nav-compact` at 800px for compact navbar
