<template>
  <div class="stepper">
    <UButton
      icon="i-lucide-minus"
      class="size-11"
      :aria-label="`Fewer ${kind}`"
      :disabled="disabled || count <= min"
      @click="emit('change', count - 1)"
    />
    <span class="stepper__count">
      <!-- A fixed width, so the dice line up from 0 to 12. -->
      <span class="stepper__number">{{ count }}</span>
      <img
        v-if="icon"
        class="stepper__die"
        :src="icon"
        :alt="kind"
      >
      <template v-else>{{ kind }}</template>
    </span>
    <UButton
      icon="i-lucide-plus"
      class="size-11"
      :aria-label="`More ${kind}`"
      :disabled="disabled || count >= max"
      @click="emit('change', count + 1)"
    />
  </div>
</template>

<script setup lang="ts">
import type { DieKind } from '~/engine/dice/shapes'

defineProps<{
  kind: DieKind
  /** A picture of the die, shown in place of its name once there is one. */
  icon?: string
  count: number
  min: number
  max: number
  /** During a roll, when the cup ignores a change anyway. */
  disabled?: boolean
}>()

const emit = defineEmits<{ change: [count: number] }>()
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
  min-width: 4.5rem;
  font-variant-numeric: tabular-nums;
}

.stepper__number {
  min-width: 1.25em;
  text-align: right;
}

.stepper__die {
  width: 2.75rem;
  height: 2.75rem;
}
</style>
