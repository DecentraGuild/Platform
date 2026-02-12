# @decentraguild/auth

Shared wallet auth composable, AuthWidget component, and Nuxt plugin for platform and tenant apps.

## Usage

### Nuxt config

```ts
export default defineNuxtConfig({
  plugins: ['@decentraguild/auth/plugin.client'],
  build: {
    transpile: ['@decentraguild/auth'],
  },
})
```

### Import useAuth or AuthWidget

```ts
import { useAuth, AuthWidget } from '@decentraguild/auth'
```
