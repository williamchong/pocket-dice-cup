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
              <template v-if="!canUse(option, ownsPro)">
                <UIcon
                  name="i-lucide-lock-keyhole"
                  class="skins__lock"
                />
                <span class="sr-only">{{ $t('pro.locked') }}</span>
              </template>
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
          v-for="option in tables"
          :key="option.id"
          type="button"
          class="skins__option"
          role="radio"
          :aria-checked="option.id === table.id"
          @click="emit('changeTable', option)"
        >
          <span
            class="skins__die skins__swatch skins__table"
            :class="`skins__table--${option.floor.pattern}`"
            :style="{ backgroundColor: option.floor.colour, borderColor: option.wall.colour }"
          />
          <span class="skins__name">{{ $t(`table.${option.id}`) }}</span>
          <template v-if="!canUse(option, ownsPro)">
            <UIcon
              name="i-lucide-lock-keyhole"
              class="skins__lock"
            />
            <span class="sr-only">{{ $t('pro.locked') }}</span>
          </template>
        </button>
      </div>
    </div>
    <!-- Shown while a Pro item is tried on: Apple asks for Restore beside Buy. -->
    <p
      v-if="tryingOn"
      class="skins__pro"
    >
      {{ $t(STATUS_TEXT[status]) }}
    </p>
    <div class="skins__actions">
      <template v-if="tryingOn">
        <UButton
          class="min-h-11"
          :label="$t('pro.restore')"
          :disabled="busy"
          @click="run(restore, 'notFound')"
        />
        <UButton
          class="min-h-11"
          variant="solid"
          :label="$t('pro.buy')"
          :loading="busy"
          @click="run(buy, 'offer')"
        />
      </template>
      <UButton
        class="min-h-11"
        :label="$t('sheet.done')"
        @click="emit('close')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { DIE_SKINS, FINISHES, type DieSkin } from '~/engine/render/skins'
import { TABLES, type Table } from '~/engine/tables'

const props = defineProps<{
  skin: DieSkin
  table: Table
  ownsPro: boolean
  /** Whether Pro can be bought here, so Pro items are offered with a lock rather than left out. */
  sellsPro: boolean
  /** Each resolves to whether Pro is owned afterwards. */
  buy: () => Promise<boolean>
  restore: () => Promise<boolean>
}>()

const emit = defineEmits<{ change: [skin: DieSkin], changeTable: [table: Table], close: [] }>()

const TABS = [
  { id: 'dice', label: 'skin.label' },
  { id: 'table', label: 'table.label' },
] as const

/** Kept while the app is open, so the sheet opens where it was left; a new visit starts on the dice. */
const tab = useState<typeof TABS[number]['id']>('skin-sheet-tab', () => 'dice')

// Where Pro can be bought, Pro skins and tables show with a lock, to try on
// in the cup; elsewhere, as on the web, they are left out until Pro is owned.
const offered = (item: { pro?: boolean }) => canUse(item, props.ownsPro) || props.sellsPro
const skins: readonly DieSkin[] = DIE_SKINS
const groups = computed(() => FINISHES
  .map(finish => ({ finish, skins: skins.filter(skin => skin.finish === finish && offered(skin)) }))
  .filter(group => group.skins.length > 0))
const allTables: readonly Table[] = TABLES
const tables = computed(() => allTables.filter(offered))

const tryingOn = computed(() => !canUse(props.skin, props.ownsPro) || !canUse(props.table, props.ownsPro))
const busy = ref(false)
/** What the last buy or restore came to, if it needs saying, in place of the offer. */
const STATUS_TEXT = { offer: 'pro.tryOn', notFound: 'pro.notFound', failed: 'pro.failed' } as const
const status = ref<keyof typeof STATUS_TEXT>('offer')

/** Runs a buy or restore, saying `notOwned` if it ends without Pro and that it failed if the store could not be reached. */
async function run(action: () => Promise<boolean>, notOwned: keyof typeof STATUS_TEXT) {
  busy.value = true
  status.value = 'offer'
  try {
    if (!await action()) status.value = notOwned
  }
  catch (error) {
    console.warn('The store could not complete the purchase', error)
    status.value = 'failed'
  }
  finally {
    busy.value = false
  }
}

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
  /* The parent the lock badge sits in the corner of. */
  position: relative;
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

/* A few stars over a wisp of nebula. */
.skins__table--starfield {
  background-image:
    radial-gradient(1px 1px at 25% 30%, #fff 100%, transparent),
    radial-gradient(1px 1px at 70% 20%, #cfe0ff 100%, transparent),
    radial-gradient(1.5px 1.5px at 55% 65%, #fff 100%, transparent),
    radial-gradient(1px 1px at 20% 80%, #ffecd2 100%, transparent),
    radial-gradient(circle at 70% 75%, rgb(163 48 122 / 55%), transparent 60%),
    radial-gradient(circle at 30% 40%, rgb(31 111 139 / 55%), transparent 60%);
}

.skins__lock {
  position: absolute;
  top: 0.4rem;
  right: 0.6rem;
  width: 1rem;
  height: 1rem;
  opacity: 0.8;
}

.skins__pro {
  margin: 0;
  font-size: 0.9rem;
  text-wrap: pretty;
}

.skins__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.skins__name {
  font-size: 0.8rem;
  white-space: nowrap;
}
</style>
