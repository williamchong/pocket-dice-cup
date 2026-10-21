<template>
  <div class="stepper">
    <UButton
      icon="i-lucide-minus"
      class="size-11"
      :aria-label="$t('pool.fewer', { kind })"
      :disabled="disabled || count <= min"
      @click="emit('change', count - 1)"
    />
    <span class="stepper__count">
      <!-- A fixed width, so the dice line up from 0 to 12. -->
      <span class="stepper__number">{{ count }}</span>
      <!-- Named as well as pictured: at this size a d8, a d10 and a d12
           are hard to tell apart. The name is what a screen reader says. -->
      <img
        v-if="icon"
        class="stepper__die"
        :src="icon"
        alt=""
      >
      <span class="stepper__kind">{{ kind }}</span>
    </span>
    <UButton
      icon="i-lucide-plus"
      class="size-11"
      :aria-label="$t('pool.more', { kind })"
      :disabled="disabled || count >= max"
      @click="emit('change', count + 1)"
    />
    <!-- Hidden rather than removed when there is nothing to take out, or
         when the kind fills the cup and must keep a die, so the rows keep
         lining up. -->
    <UButton
      icon="i-lucide-x"
      variant="ghost"
      color="neutral"
      class="size-11"
      :class="{ invisible: !clearable }"
      :aria-label="$t('pool.clear', { kind })"
      :disabled="disabled || !clearable"
      @click="emit('change', 0)"
    />
  </div>
</template>

<script setup lang="ts">
import type { DieKind } from '~/engine/dice/shapes'

const props = defineProps<{
  kind: DieKind
  /** A picture of the die, shown beside its name once there is one. */
  icon?: string
  count: number
  min: number
  max: number
  /** During a roll, when the cup ignores a change anyway. */
  disabled?: boolean
}>()

const emit = defineEmits<{ change: [count: number] }>()

const clearable = computed(() => props.count > 0 && props.min === 0)
</script>

<style scoped>
.stepper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stepper__count {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  min-width: 7rem;
  font-variant-numeric: tabular-nums;
}

.stepper__number {
  min-width: 1.25em;
  text-align: right;
}

.stepper__kind {
  min-width: 2.25em;
  opacity: 0.8;
}

.stepper__die {
  width: 2.75rem;
  height: 2.75rem;
}
</style>
