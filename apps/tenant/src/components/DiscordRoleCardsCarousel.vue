<template>
  <div class="role-cards-carousel">
    <h3 class="role-cards-carousel__title">Role requirements</h3>
    <div class="role-cards-carousel__scroll" ref="scrollRef">
      <article
        v-for="card in roleCards"
        :key="card.role_id"
        class="role-card"
        :class="{ 'role-card--not-eligible': card.eligible === false }"
        :style="roleCardStyle(card)"
      >
        <div class="role-card__icon-wrap">
          <img
            v-if="card.icon"
            :src="discordRoleIconUrl(card.role_id, card.icon)"
            :alt="card.name"
            class="role-card__icon role-card__icon--img"
          />
          <span
            v-else-if="card.unicode_emoji"
            class="role-card__emoji"
            aria-hidden="true"
          >{{ card.unicode_emoji }}</span>
          <Icon
            v-else
            icon="mdi:shield-account"
            class="role-card__icon role-card__icon--fallback"
          />
        </div>
        <h4 class="role-card__name">{{ card.name }}</h4>
        <span v-if="card.eligible === true" class="role-card__badge">
          <Icon icon="mdi:check-circle" class="role-card__badge-icon" />
          You qualify
        </span>
        <ul class="role-card__requirements" v-if="card.requirements?.length">
          <template v-for="(item, idx) in card.requirements" :key="idx">
            <li v-if="item.type === 'text'" class="role-card__req-item">
              {{ item.text }}
            </li>
            <li v-else-if="item.type === 'separator' && item.label === 'OR'" class="role-card__req-sep">
              OR
            </li>
          </template>
        </ul>
        <p v-else class="role-card__empty">No requirements</p>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

export interface RoleCardRequirementText {
  type: 'text'
  text: string
}

export interface RoleCardRequirementSeparator {
  type: 'separator'
  label: 'OR' | 'and'
}

export type RoleCardRequirementItem = RoleCardRequirementText | RoleCardRequirementSeparator

export interface RoleCard {
  role_id: string
  name: string
  position: number
  color?: number
  icon?: string
  unicode_emoji?: string
  requirements: RoleCardRequirementItem[]
  /** When signed in with Discord linked: true = qualifies, false = does not qualify, undefined = not computed */
  eligible?: boolean
}

const props = defineProps<{
  roleCards: RoleCard[]
}>()

const scrollRef = ref<HTMLElement | null>(null)

const DISCORD_CDN = 'https://cdn.discordapp.com'
const DISCORD_BLURPLE = 0x5865f2

function discordRoleIconUrl(roleId: string, iconHash: string): string {
  return `${DISCORD_CDN}/role-icons/${roleId}/${iconHash}.png`
}

function roleCardStyle(card: RoleCard): Record<string, string> {
  const color = card.color != null && card.color !== 0 ? card.color : DISCORD_BLURPLE
  const hex = `#${color.toString(16).padStart(6, '0')}`
  return {
    '--role-card-accent': hex,
  }
}
</script>

<style scoped>
.role-cards-carousel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.role-cards-carousel__title {
  font-size: var(--theme-font-md);
  margin-bottom: var(--theme-space-sm);
  color: var(--theme-text-primary);
}

.role-cards-carousel__scroll {
  display: flex;
  gap: var(--theme-space-md);
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: var(--theme-space-sm);
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
}

.role-card {
  flex-shrink: 0;
  scroll-snap-align: start;
  width: 22rem;
  min-height: 20rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background-color: var(--theme-bg-card);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  padding: var(--theme-space-xl);
  border-left: 4px solid var(--role-card-accent, var(--theme-primary));
}

.role-card--not-eligible {
  opacity: 0.5;
  filter: grayscale(0.6);
}

.role-card--not-eligible .role-card__name {
  color: var(--theme-text-muted);
}

.role-card__badge {
  display: inline-flex;
  align-items: center;
  gap: var(--theme-space-xs);
  margin-bottom: var(--theme-space-sm);
  font-size: var(--theme-font-xs);
  font-weight: 600;
  color: var(--theme-status-success, #22c55e);
}

.role-card__badge-icon {
  font-size: 1rem;
}

.role-card__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80%;
  aspect-ratio: 1;
  margin-bottom: var(--theme-space-md);
  border-radius: var(--theme-radius-md);
  background-color: color-mix(in srgb, var(--role-card-accent, var(--theme-primary)) 20%, transparent);
}

.role-card__icon--img,
.role-card__icon--fallback {
  width: 85%;
  height: 85%;
  object-fit: contain;
}

.role-card__icon--fallback {
  color: var(--role-card-accent, var(--theme-primary));
}

.role-card__emoji {
  font-size: 4.5rem;
  line-height: 1;
}

.role-card__name {
  font-size: var(--theme-font-md);
  font-weight: 600;
  margin: 0 0 var(--theme-space-md);
  color: var(--theme-text-primary);
}

.role-card__requirements {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.role-card__req-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--theme-space-xs);
  margin-bottom: var(--theme-space-xs);
  text-align: center;
}

.role-card__req-item::before {
  content: '';
  flex-shrink: 0;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--theme-text-muted);
}

.role-card__req-sep {
  font-weight: 600;
  color: var(--theme-text-muted);
  margin: var(--theme-space-xs) 0;
  padding-left: 0;
  text-align: center;
}

.role-card__empty {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  text-align: center;
}
</style>
