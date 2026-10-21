<template>
  <section
    class="skins"
    :aria-label="$t('cup.style')"
  >
    <!-- The dice and the table are chosen apart, so only one set of options shows at a time. -->
    <div
      class="skins__tabs"
      role="tablist"
    >
      <button
        v-for="{ id, label } in TABS"
        :id="`skins-tab-${id}`"
        :key="id"
        type="button"
        class="skins__tab"
        role="tab"
        :aria-selected="id === tab"
        aria-controls="skins-panel"
        @click="tab = id"
      >
        {{ $t(label) }}
      </button>
    </div>
    <div
      id="skins-panel"
      ref="panel"
      class="skins__panel"
      role="tabpanel"
      :aria-labelledby="`skins-tab-${tab}`"
    >
      <template v-if="tab === 'dice'">
        <template
          v-for="group in groups"
          :key="group.finish"
        >
          <h2
            :id="`skins-${group.finish}`"
            class="skins__heading"
          >
            {{ $t(`finish.${group.finish}`) }}
          </h2>
          <div
            class="skins__grid"
            role="radiogroup"
            :aria-labelledby="`skins-${group.finish}`"
          >
            <button
              v-for="option in group.skins"
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
        </template>
      </template>
      <div
        v-else
        class="skins__grid"
        role="radiogroup"
        aria-labelledby="skins-tab-table"
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
    </div>
    <UButton
      class="min-h-11 self-end"
      :label="$t('sheet.done')"
      @click="emit('close')"
    />
  </section>
</template>

<script setup lang="ts">
import { DIE_SKINS, FINISHES, type DieSkin } from '~/engine/render/skins'
import { TABLES, type Table } from '~/engine/tables'

defineProps<{
  skin: DieSkin
  table: Table
}>()

const emit = defineEmits<{ change: [skin: DieSkin], changeTable: [table: Table], close: [] }>()

const TABS = [
  { id: 'dice', label: 'skin.label' },
  { id: 'table', label: 'table.label' },
] as const

/** Kept while the app is open, so the sheet opens where it was left; a new visit starts on the dice. */
const tab = useState<typeof TABS[number]['id']>('skin-sheet-tab', () => 'dice')

const groups = FINISHES
  .map(finish => ({ finish, skins: DIE_SKINS.filter(skin => skin.finish === finish) }))
  .filter(group => group.skins.length > 0)

const icons = useSkinIcons()

const panel = useTemplateRef('panel')

/**
 * Scrolls the panel just far enough that the chosen option shows. The panel
 * scrolls itself rather than with scrollIntoView, which could also scroll
 * the fixed page under it.
 */
function showChosen() {
  const chosen = panel.value?.querySelector<HTMLElement>('[aria-checked="true"]')
  if (!panel.value || !chosen) return
  panel.value.scrollTop = Math.max(0, chosen.offsetTop + chosen.offsetHeight - panel.value.clientHeight)
}

onMounted(showChosen)
watch(tab, showChosen, { flush: 'post' })
</script>

<style scoped>
.skins {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  /* The cup shows above it, so a new style can be seen on the dice while
     choosing. One height for both tabs, so the tabs stay under the thumb
     when switching between them. */
  height: 60vh;
}

.skins__tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: 999px;
  background: rgb(244 239 227 / 8%);
}

.skins__tab {
  flex: 1;
  min-height: 2.75rem;
  border: none;
  border-radius: 999px;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.skins__tab[aria-selected="true"] {
  background: rgb(244 239 227 / 18%);
  font-weight: 600;
}

.skins__panel {
  /* The parent for offsetTop in showChosen. */
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  /* Takes the sheet's height, so Done stays at the foot with fewer options. */
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* The body turns touch scrolling off everywhere else (main.css). */
  touch-action: pan-y;
  overscroll-behavior: contain;
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
