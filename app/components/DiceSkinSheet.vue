<template>
  <section
    class="skins"
    aria-label="Dice style"
  >
    <div
      class="skins__grid"
      role="radiogroup"
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
        <span class="skins__name">{{ option.name }}</span>
      </button>
    </div>
    <UButton
      class="self-end"
      label="Done"
      @click="emit('close')"
    />
  </section>
</template>

<script setup lang="ts">
import { DIE_SKINS, type DieSkin } from '~/engine/render/skins'

defineProps<{
  skin: DieSkin
}>()

const emit = defineEmits<{ change: [skin: DieSkin], close: [] }>()

const icons = useSkinIcons()
</script>

<style scoped>
.skins {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: min(100%, 22rem);
  padding: 1rem;
  box-sizing: border-box;
  border-radius: 1rem;
  background: rgb(18 36 27 / 92%);
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

.skins__name {
  font-size: 0.8rem;
  white-space: nowrap;
}
</style>
