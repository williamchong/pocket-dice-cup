<template>
  <section
    class="skins"
    :aria-label="$t('cup.style')"
  >
    <h2
      id="skins-dice"
      class="skins__heading"
    >
      {{ $t('skin.label') }}
    </h2>
    <div
      class="skins__grid"
      role="radiogroup"
      aria-labelledby="skins-dice"
    >
      <button
        v-for="option in DIE_SKINS"
        :key="option.id"
        type="button"
        class="skins__option"
        role="radio"
        :aria-checked="option.id === skin.id"
        @click="emit('change', option)"
      >
        <img
          v-if="icons[option.id]"
          class="skins__die"
          :src="icons[option.id]"
          alt=""
        >
        <span
          v-else
          class="skins__die skins__swatch"
          :style="{ background: option.body }"
        />
        <span class="skins__name">{{ $t(`skin.${option.id}`) }}</span>
      </button>
    </div>
    <h2
      id="skins-table"
      class="skins__heading"
    >
      {{ $t('table.label') }}
    </h2>
    <div
      class="skins__grid"
      role="radiogroup"
      aria-labelledby="skins-table"
    >
      <button
        v-for="option in TABLES"
        :key="option.id"
        type="button"
        class="skins__option"
        role="radio"
        :aria-checked="option.id === table.id"
        @click="emit('changeTable', option)"
      >
        <span
          class="skins__die skins__swatch skins__table"
          :class="{ 'skins__table--grid': option.floor.pattern === 'grid' }"
          :style="{ backgroundColor: option.floor.colour, borderColor: option.wall.colour }"
        />
        <span class="skins__name">{{ $t(`table.${option.id}`) }}</span>
      </button>
    </div>
    <UButton
      class="min-h-11 self-end"
      :label="$t('sheet.done')"
      @click="emit('close')"
    />
  </section>
</template>

<script setup lang="ts">
import { DIE_SKINS, type DieSkin } from '~/engine/render/skins'
import { TABLES, type Table } from '~/engine/tables'

defineProps<{
  skin: DieSkin
  table: Table
}>()

const emit = defineEmits<{ change: [skin: DieSkin], changeTable: [table: Table], close: [] }>()

const icons = useSkinIcons()
</script>

<style scoped>
.skins {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skins__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.skins__option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.25rem;
  border: 2px solid transparent;
  border-radius: 0.75rem;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.skins__option:hover {
  background: rgb(244 239 227 / 10%);
}

.skins__option[aria-checked="true"] {
  border-color: var(--color-cream);
  background: rgb(244 239 227 / 15%);
}

.skins__die {
  width: 2.75rem;
  height: 2.75rem;
}

/* Stands in for the picture while it is drawn. */
.skins__swatch {
  border-radius: 0.5rem;
}

.skins__heading {
  font-size: 0.8rem;
  opacity: 0.7;
}

/* A corner of the cup seen from above: the floor in its rail. */
.skins__table {
  border: 0.3rem solid;
}

/* The battle mat's squares, a third of the swatch across. */
.skins__table--grid {
  background-image:
    linear-gradient(rgb(0 0 0 / 30%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(0 0 0 / 30%) 1px, transparent 1px);
  background-size: 33% 33%;
}

.skins__name {
  font-size: 0.8rem;
  white-space: nowrap;
}
</style>
