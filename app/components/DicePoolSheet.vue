<template>
  <section
    class="pool"
    aria-label="Dice"
  >
    <!-- The last die left cannot be taken out, and the cup holds MAX_DICE in all. -->
    <DiceCountStepper
      v-for="kind in DIE_KINDS"
      :key="kind"
      :kind="kind"
      :count="counts[kind]"
      :min="pool.length === 1 ? counts[kind] : 0"
      :max="counts[kind] + MAX_DICE - pool.length"
      :disabled="disabled"
      @change="count => emit('change', withCount(pool, kind, count))"
    />
    <button
      type="button"
      class="pool__done"
      @click="emit('close')"
    >
      Done
    </button>
  </section>
</template>

<script setup lang="ts">
import { countKinds, MAX_DICE, withCount, type DicePool } from '~/engine/core/pool'
import { DIE_KINDS } from '~/engine/dice/shapes'

const props = defineProps<{
  pool: DicePool
  /** During a roll, when the cup ignores a change anyway. */
  disabled?: boolean
}>()

const emit = defineEmits<{ change: [pool: DicePool], close: [] }>()

const counts = computed(() => countKinds(props.pool))
</script>

<style scoped>
.pool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 1rem;
  background: rgb(18 36 27 / 92%);
}

.pool__done {
  align-self: flex-end;
  padding: 0.5rem 1rem;
  border: 0;
  border-radius: 999px;
  background: rgb(244 239 227 / 15%);
  color: inherit;
  font: 16px/1.2 system-ui, sans-serif;
}
</style>
