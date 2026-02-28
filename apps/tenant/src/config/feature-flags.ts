/**
 * Central feature flags per module.
 * Toggle features here instead of scattering booleans across pages.
 * When a feature is ready, flip its flag to true.
 */

export const FEATURES = {
  marketplace: {
    createTrade: false,
    shopFees: false,
  },
} as const

export type FeatureFlags = typeof FEATURES
