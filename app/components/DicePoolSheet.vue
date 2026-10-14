<template>
  <section
    class="pool"
    :aria-label="$t('pool.label')"
  >
    <!-- The last die left cannot be taken out, and the cup holds MAX_DICE in all. -->
    <DiceCountStepper
      v-for="kind in DIE_KINDS"
      :key="kind"
      :kind="kind"
      :icon="icons[kind]"
      :count="counts[kind]"
      :min="pool.length === 1 ? counts[kind] : 0"
      :max="counts[kind] + MAX_DICE - pool.length"
      :disabled="disabled"
      @change="count => emit('change', withCount(pool, kind, count))"
    />
    <UButton
      class="min-h-11 self-end"
      :label="$t('sheet.done')"
      @click="emit('close')"
    />
  </section>
</template>

<script setup lang="ts">
import { countKinds, MAX_DICE, withCount, type DicePool } from '~/engine/core/pool'
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
</style>
