<template>
  <div class="stepper">
    <button
      type="button"
      aria-label="Fewer dice"
      :disabled="disabled || count <= 1"
      @click="emit('change', count - 1)"
    >
      −
    </button>
    <span class="stepper__count">{{ count }} {{ count === 1 ? 'die' : 'dice' }}</span>
    <button
      type="button"
      aria-label="More dice"
      :disabled="disabled || count >= max"
      @click="emit('change', count + 1)"
    >
      +
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  count: number
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
  min-width: 4.5rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
