<template>
  <section
    class="pool"
    :aria-label="$t('pool.label')"
  >
    <!-- The last die left cannot be taken out, so a kind that fills the cup
         keeps one, and the cup holds MAX_DICE in all. -->
    <DiceCountStepper
      v-for="kind in DIE_KINDS"
      :key="kind"
      :kind="kind"
      :icon="icons[kind]"
      :count="counts[kind]"
      :min="counts[kind] === pool.length ? 1 : 0"
      :max="counts[kind] + MAX_DICE - pool.length"
      :disabled="disabled"
      @change="count => emit('change', withCount(pool, kind, count))"
    />
    <div class="pool__buttons self-end">
      <!-- Back to the lone d6 the cup starts with. A pool is quick to build
           again, so unlike History's Clear it does not ask first. -->
      <UButton
        class="min-h-11"
        color="neutral"
        :label="$t('pool.reset')"
        :disabled="disabled || (pool.length === 1 && pool[0] === 'd6')"
        @click="emit('change', d6Pool(1))"
      />
      <UButton
        class="min-h-11"
        :label="$t('sheet.done')"
        @click="emit('close')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { countKinds, d6Pool, MAX_DICE, withCount, type DicePool } from '~/engine/core/pool'
import { DIE_KINDS } from '~/engine/dice/shapes'
import type { DieSkin } from '~/engine/render/skins'

const props = defineProps<{
  pool: DicePool
  /** How the dice are finished, for their pictures. */
  skin: DieSkin
  /** During a roll, when the cup ignores a change anyway. */
  disabled?: boolean
}>()

const emit = defineEmits<{ change: [pool: DicePool], close: [] }>()

const counts = computed(() => countKinds(props.pool))
const icons = useDieIcons(() => props.skin)
</script>

<style scoped>
.pool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.pool__buttons {
  display: flex;
  gap: 0.5rem;
}
</style>
