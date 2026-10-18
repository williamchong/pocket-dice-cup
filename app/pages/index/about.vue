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
      <section
        v-for="section in SECTIONS"
        :key="section"
      >
        <h2>{{ $t(`about.${section}.title`) }}</h2>
        <p>{{ $t(`about.${section}.body`, COUNTS) }}</p>
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

/** The page's sections in reading order, each a title and a paragraph under about.<name>. */
const SECTIONS = ['shake', 'settle', 'tap', 'dice', 'rolledOver', 'history', 'style', 'feel', 'privacy'] as const

/** The limits the text quotes, from the code that sets them. */
const COUNTS = { dice: MAX_DICE, history: MAX_HISTORY }

const { t } = useI18n()
useHead({
  title: () => `${t('about.label')} · ${t('app.name')}`,
  meta: [{ name: 'description', content: () => t('about.intro') }],
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

.about__buttons {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.75rem;
}
</style>
