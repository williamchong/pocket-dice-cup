<template>
  <div
    class="result"
    role="status"
  >
    <span class="result__total">{{ rollTotal(values) }}</span>
    <span
      v-if="rollBreakdown(values, kinds)"
      class="result__dice"
    >{{ rollBreakdown(values, kinds) }}</span>
  </div>
</template>

<script setup lang="ts">
import type { DieKind } from '~/engine/dice/shapes'

defineProps<{
  values: readonly number[]
  kinds: readonly DieKind[]
}>()
</script>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1.5rem;
  border-radius: 1rem;
  background: rgb(18 36 27 / 85%);
  font-variant-numeric: tabular-nums;
  animation: result-in 0.2s ease-out;
}

.result__total {
  font-size: 2.75rem;
  font-weight: 700;
  line-height: 1;
}

.result__dice {
  max-width: 16rem;
  text-align: center;
  opacity: 0.8;
}

@keyframes result-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
}

@media (prefers-reduced-motion: reduce) {
  .result {
    animation: none;
  }
}
</style>
