<template>
  <div class="stepper">
    <button
      type="button"
      :aria-label="`Fewer ${kind}`"
      :disabled="disabled || count <= min"
      @click="emit('change', count - 1)"
    >
      −
    </button>
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
    <button
      type="button"
      :aria-label="`More ${kind}`"
      :disabled="disabled || count >= max"
      @click="emit('change', count + 1)"
    >
      +
    </button>
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

.stepper button {
  width: 2.75rem;
  height: 2.75rem;
  border: 0;
  border-radius: 999px;
  background: rgb(244 239 227 / 15%);
  color: inherit;
  font: 20px/1 system-ui, sans-serif;
}

.stepper button:disabled {
  opacity: 0.35;
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
