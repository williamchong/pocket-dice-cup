<template>
  <div
    class="result"
    role="status"
  >
    <template v-if="showTotal">
      <span class="result__total">{{ rollTotal(values) }}</span>
      <span
        v-if="rollBreakdown(values, kinds)"
        class="result__dice"
      >{{ rollBreakdown(values, kinds) }}</span>
    </template>
    <!-- With the total off, the dice's values take its place, as the line to read. -->
    <span
      v-else
      class="result__faces"
    >{{ rollFaces(values, kinds) }}</span>
    <!-- Shown by rings on the felt under the dice; said only to screen readers. -->
    <span
      v-if="slid"
      class="sr-only"
    >{{ $t('cup.slid', slid) }}</span>
  </div>
</template>

<script setup lang="ts">
import type { DieKind } from '~/engine/dice/shapes'

defineProps<{
  values: readonly number[]
  kinds: readonly DieKind[]
  /** How many of the dice slid without turning over, which a gentle shake can leave. */
  slid: number
  /** Whether to add the dice up; off for games that read each die, such as liar's dice. */
  showTotal: boolean
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
  background: color-mix(in srgb, var(--color-felt) 85%, transparent);
  font-variant-numeric: tabular-nums;
  animation: result-in 0.2s ease-out;
}

.result__total {
  font-size: 2.75rem;
  font-weight: 700;
  line-height: 1;
}

.result__faces {
  max-width: 16rem;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  word-spacing: 0.25em;
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
