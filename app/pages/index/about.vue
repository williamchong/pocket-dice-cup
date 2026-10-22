<!-- A child of the cup's page, so the dice stay loaded behind it and are
     there as it closes; its own address gives search engines a page that
     says what the app is. It covers the whole cup, margins too, and clicks stop
     here, so no tap reaches the dice behind it. -->
<template>
  <article
    class="about"
    :aria-label="$t('about.label')"
    @click.stop
  >
    <div class="about__body">
      <h1
        ref="heading"
        class="about__title"
        tabindex="-1"
      >
        {{ $t('app.name') }}
      </h1>
      <p class="about__tagline">
        {{ $t('about.tagline') }}
      </p>
      <p>{{ $t('about.intro') }}</p>
      <!-- The whole idea in three pictures, for anyone who reads no further. -->
      <section>
        <h2>{{ $t('about.shake.title') }}</h2>
        <ol class="about__steps">
          <li>
            <ShakeHintIcon />
            {{ $t('about.steps.shake') }}
          </li>
          <li>
            <AboutPicture name="flat" />
            {{ $t('about.steps.flat') }}
          </li>
          <li>
            <img
              class="about__die"
              :src="dieIcons.d6"
              alt=""
            >
            {{ $t('about.steps.read') }}
          </li>
        </ol>
        <p>{{ $t('about.shake.body') }}</p>
      </section>
      <section
        v-for="section in SECTIONS"
        :key="section.name"
        class="about__section"
      >
        <AboutPicture
          v-if="'picture' in section"
          class="about__picture"
          :name="section.picture"
        />
        <UIcon
          v-else
          class="about__picture about__icon"
          :name="section.icon"
        />
        <div>
          <h2>{{ $t(`about.${section.name}.title`) }}</h2>
          <p>{{ $t(`about.${section.name}.body`, COUNTS) }}</p>
          <p
            v-if="$te(`about.${section.name}.note`)"
            class="about__note"
          >
            {{ $t(`about.${section.name}.note`) }}
          </p>
          <!-- The real dice, as rendered for the pickers, rather than a list of their names. -->
          <div
            v-if="'row' in section"
            class="about__dice"
          >
            <img
              v-for="(src, i) in rows[section.row]"
              :key="i"
              class="about__die"
              :src="src"
              alt=""
            >
          </div>
        </div>
      </section>
    </div>
    <div class="about__buttons">
      <UButton
        class="min-h-11"
        :label="$t('sheet.done')"
        @click="close"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { MAX_DICE } from '~/engine/core/pool'
import { DIE_KINDS } from '~/engine/dice/shapes'
import { DIE_SKINS, FINISHES, type DieSkin } from '~/engine/render/skins'

const props = defineProps<{ skin: DieSkin }>()

/**
 * The sections after Shake to roll, in reading order, each a title, a
 * paragraph and maybe a note under about.<name>, beside a drawing or an icon,
 * and some with a row of dice under them.
 */
const SECTIONS = [
  { name: 'settle', picture: 'settle' },
  { name: 'tap', icon: 'i-lucide-mouse-pointer-click' },
  { name: 'dice', icon: 'i-lucide-dices', row: 'kinds' },
  { name: 'rolledOver', picture: 'ring' },
  { name: 'history', icon: 'i-lucide-history' },
  { name: 'style', icon: 'i-lucide-palette', row: 'finishes' },
  { name: 'feel', icon: 'i-lucide-volume-2' },
  { name: 'privacy', icon: 'i-lucide-shield-check' },
] as const

/** The first free skin of each finish, to show what Style offers to everyone. */
const FINISH_SKINS = FINISHES.flatMap(finish => (DIE_SKINS as readonly DieSkin[]).find(skin => skin.finish === finish && canUse(skin, false)) ?? [])

/** The limits the text quotes, from the code that sets them. */
const COUNTS = { dice: MAX_DICE, history: MAX_HISTORY }

// Each kind in the chosen finish, and the first skin of each finish for Style,
// in a fixed order so a picture drawn late keeps its place. The cup draws them
// all for its pickers once the dice are ready; opened by its own address, the
// page asks for that same batch first, so it is drawn in one go rather than two.
drawPickerIcons(props.skin)
const dieIcons = useDieIcons(() => props.skin)
const skinIcons = useSkinIcons()
const rows = computed(() => ({
  kinds: DIE_KINDS.map(kind => dieIcons.value[kind]),
  finishes: FINISH_SKINS.map(skin => skinIcons.value[skin.id]),
}))

const { t } = useI18n()
useHead({
  title: () => `${t('about.label')} · ${t('app.name')}`,
  // The fuller text, for crawlers and link previews that show no pictures.
  meta: [{ name: 'description', content: () => t('about.description') }],
})

const backToCup = useBackToCup()
// Once only: a second back, from a double tap or a held key, would step past the cup and out of the site.
let closing = false
function close() {
  if (closing) return
  closing = true
  backToCup()
}

// Escape closes it on a computer, as it would a dialog.
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}
// The heading takes focus, so a screen reader starts reading at the top.
const heading = useTemplateRef('heading')
onMounted(() => {
  heading.value?.focus()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.about {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  /* On a tablet, or a computer, the text stays a readable width. */
  padding: calc(var(--safe-inset) + 1rem) max(1rem, 50% - 18rem);
  /* Solid, not the sheets' glass: it is read rather than glanced at, and a
     blur would be redrawn with each frame of dice rolling behind it. */
  background: var(--color-felt);
  /* The page is felt whatever the table, so the drawn phone's screen is too. */
  --shake-screen: var(--color-felt);
  /* The body turns scrolling and selection off everywhere else (main.css). */
  user-select: text;
  -webkit-user-select: text;
}

.about__body {
  flex: 1;
  overflow-y: auto;
  touch-action: pan-y;
  overscroll-behavior: contain;
  line-height: 1.5;
}

.about__body p {
  margin: 0 0 0.75rem;
}

.about__body h2 {
  margin: 1.25rem 0 0.25rem;
  font-size: 1.1rem;
  font-weight: 700;
}

.about__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  outline: none;
}

.about__tagline {
  opacity: 0.8;
}

.about__steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin: 0.5rem 0 0.75rem;
  padding: 0;
  list-style: none;
}

.about__steps li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 0.25rem;
  border-radius: 0.75rem;
  background: rgb(255 255 255 / 0.06);
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
}

/* A drawing or icon in a column of its own, the words beside it. */
.about__section {
  display: grid;
  grid-template-columns: 3rem 1fr;
  column-gap: 0.75rem;
  align-items: start;
}

.about__picture {
  margin-top: 1.25rem;
}

.about__icon {
  width: 2rem;
  height: 2rem;
  justify-self: center;
  margin-top: 1.6rem;
}

.about__body .about__note {
  margin-top: -0.5rem;
  font-size: 0.875rem;
  opacity: 0.7;
}

.about__dice {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

/* The pictures come with the dice; until drawn, each keeps its place empty.
   In a row they shrink rather than wrap, so all six kinds stay on one line
   on a narrow phone. */
.about__die {
  flex: 0 1 3rem;
  min-width: 0;
  width: 3rem;
  aspect-ratio: 1;
}

.about__buttons {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.75rem;
}
</style>
