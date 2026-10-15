<template>
  <main
    class="cup"
    :style="counterRotationStyle"
    @click="start"
  >
    <!-- Tap to shake stays on with a working sensor too: desktop Chrome
         reports one but never sends a reading, and a tap is a quick re-roll. -->
    <canvas
      ref="canvas"
      class="cup__canvas"
      @pointerdown="toss"
    />

    <p
      v-if="failed"
      class="cup__message"
    >
      {{ $t('cup.failed') }}
    </p>

    <!-- Taps go through to the canvas, so the one that begins also rolls. -->
    <p
      v-else-if="ready && permission === 'prompt'"
      class="cup__message cup__message--pulse"
    >
      {{ $t('cup.begin') }}
    </p>

    <div
      v-if="ready"
      ref="footer"
      class="cup__footer"
    >
      <!-- Held in the hand, the phone is never put down flat enough to end
           the roll, so this ends it as if it were. -->
      <UButton
        v-if="rolling && sensing"
        class="cup__settle min-h-11 py-1.5"
        variant="solid"
        :label="$t('cup.settle')"
        @click="settle"
      />
      <div class="cup__controls">
        <!-- In the default slot, not `label`, which would truncate: a long
             mix of dice wraps onto a second line. -->
        <UButton
          class="min-h-11 rounded-[1.375rem] py-1.5"
          :aria-pressed="openSheet === 'pool'"
          @click="toggle('pool')"
        >
          {{ formatPool(pool) }}
        </UButton>
        <UButton
          class="min-h-11 py-1.5"
          :label="$t('cup.history')"
          :aria-pressed="openSheet === 'history'"
          @click="toggle('history')"
        />
        <UButton
          class="min-h-11 py-1.5"
          :label="$t('cup.style')"
          :aria-pressed="openSheet === 'skin'"
          @click="toggle('skin')"
        />
      </div>
      <!-- Until the first shake, for anyone who only taps: the shake is
           what the app is for. -->
      <p
        v-if="sensing && !everShaken && !rolling"
        class="cup__hint"
      >
        {{ $t('cup.shakeHint') }}
      </p>
      <p
        v-else-if="permission === 'denied'"
        class="cup__hint"
      >
        {{ $t('cup.denied') }}
      </p>
      <p
        v-else-if="permission === 'unsupported'"
        class="cup__hint"
      >
        {{ $t('cup.unsupported') }}
      </p>
    </div>

    <!-- A sheet comes up from the bottom edge over the buttons, as on iOS.
         It stays inside the cup, so it turns with the dice, and leaves the
         rest of the felt to take taps, which roll and close it. -->
    <Transition
      name="cup__sheet"
      mode="out-in"
    >
      <RollHistory
        v-if="openSheet === 'history'"
        class="cup__sheet"
        :rolls="history"
        @clear="clearHistory"
        @close="openSheet = null"
      />
      <DicePoolSheet
        v-else-if="openSheet === 'pool'"
        class="cup__sheet"
        :pool="pool"
        :skin="skin"
        :disabled="rolling"
        @change="changePool"
        @close="openSheet = null"
      />
      <DiceSkinSheet
        v-else-if="openSheet === 'skin'"
        class="cup__sheet"
        :skin="skin"
        @change="changeSkin"
        @close="openSheet = null"
      />
    </Transition>

    <!-- Taps go through to the canvas, so a shown result is re-rolled with a tap like any other. -->
    <ResultPopup
      v-if="state === 'result' && result"
      ref="card"
      class="cup__result"
      :style="cardTop === null ? undefined : { top: `${cardTop}px` }"
      :values="result"
      :kinds="pool"
      :slid="slid"
    />

    <div
      v-if="debug"
      class="cup__debug"
    >
      <pre>{{ debugText }}</pre>
      <!-- For turning a real shake into a test fixture (tests/fixtures/traces). -->
      <form
        class="cup__trace"
        @submit.prevent="copyTrace"
      >
        <input
          v-model="traceNote"
          placeholder="What you did"
        >
        <button type="submit">
          {{ traceStatus.text }}
        </button>
      </form>
      <!-- "Copy tuning" carries the values tuned by feel and by ear back
           into DEFAULT_HAPTIC_TUNING and DEFAULT_SOUND_TUNING. -->
      <form
        class="cup__tuning"
        @submit.prevent="copyTuning"
      >
        <!-- Closed at first: open, the panel covers the cup on a phone. -->
        <div class="cup__buttons">
          <button
            v-for="group in TUNING_GROUPS"
            :key="group"
            type="button"
            :aria-pressed="tuningGroup === group"
            @click="tuningGroup = tuningGroup === group ? null : group"
          >
            {{ group === tuningGroup ? 'Close' : TUNING_LABELS[group] }}
          </button>
        </div>
        <template v-if="tuningGroup">
          <label
            v-for="slider in TUNING_SLIDERS[tuningGroup]"
            :key="slider.label"
          >
            <span>{{ slider.label }} {{ slider.read().toFixed(Number.isInteger(slider.step) ? 0 : 2) }}</span>
            <input
              type="range"
              :min="slider.min"
              :max="slider.max"
              :step="slider.step"
              :value="slider.read()"
              @input="slider.write(($event.target as HTMLInputElement).valueAsNumber)"
            >
          </label>
          <div class="cup__buttons">
            <button
              v-for="surface in TEST_SURFACES"
              :key="surface"
              type="button"
              @click="testHit(surface)"
            >
              Tap {{ surface }}
            </button>
            <button type="submit">
              {{ tuningStatus.text }}
            </button>
          </div>
        </template>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { formatPool, type DicePool } from '~/engine/core/pool'
import { isRolling } from '~/engine/core/stateMachine'
import { DEFAULT_SOUND_TUNING, type SoundTuning, type VoiceName } from '~/engine/feedback/clackSound'
import { DEFAULT_HAPTIC_TUNING, type HapticTuning } from '~/engine/feedback/cupFeedback'
import type { Surface } from '~/engine/physics/world'
import { findSkin, type DieSkin } from '~/engine/render/skins'

// `?debug` shows what the sensor and the state machine are doing, for tuning
// on a real phone where there is no console. It also starts the dice in the
// same place every time, so runs can be compared.
const route = useRoute()
const debug = 'debug' in route.query || Boolean(useRuntimeConfig().public.debug)
// `?dice=N` starts with N d6, and `?dice=2d6+d20` with those dice, over the
// dice saved from last time.
const startPool = parsePoolSetting(route.query.dice) ?? loadPool() ?? undefined
// `?skin=ebony` starts with that finish, over the one saved from last time.
const skin = shallowRef(findSkin(parseSkinSetting(route.query.skin) ?? loadSkin()))

const canvas = useTemplateRef('canvas')
// Shaking tips the phone far enough for the browser to rotate the page; the
// cup stays put in the phone's own frame instead.
const counterRotationStyle = useCounterRotation()
const { ready, failed, state, result, slid, shaken, dice, pool, sensing, permission, start, toss, settle, setPool, setSkin, debugInfo, exportTrace, hapticTuning, soundTuning, testHit } = useDiceCup(canvas, { randomStart: !debug, recordTrace: debug, pool: startPool, skin: skin.value })
const rolling = computed(() => isRolling(state.value))
// Kept across visits, so the hint to shake goes for good after one shake.
const everShaken = ref(loadShaken())
watch(shaken, (now) => {
  if (!now || everShaken.value) return
  everShaken.value = true
  saveShaken()
})

function changePool(next: DicePool) {
  if (setPool(next)) savePool(pool.value)
}

function changeSkin(next: DieSkin) {
  if (next === skin.value) return
  skin.value = next
  setSkin(next)
  saveSkin(next.id)
  // The dice picker's pictures of the new skin, drawn now rather than as it opens.
  drawDieIcons(next)
}

// The result card goes down above the buttons when it would hide a die at
// the top, as a die there can be cocked or read wrong and should be seen.
const card = useTemplateRef<ComponentPublicInstance>('card')
const footer = useTemplateRef('footer')
const cardTop = ref<number | null>(null)
// After the card is laid out at the top and before it is painted, so it
// never shows over the die first. On the result, not the dice, which come
// again when the phone goes screen-down and back with the card already
// moved. Offsets, not getBoundingClientRect, are in the cup's own frame, as
// the dice are, however the page is turned.
watch(result, () => {
  const element = card.value?.$el as HTMLElement | undefined
  if (!dice.value.length || !element || !footer.value) {
    cardTop.value = null
    return
  }
  // offsetLeft is the left edge before the translate, at the cup's centre line.
  const top = { left: element.offsetLeft - element.offsetWidth / 2, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight }
  const low = { ...top, top: footer.value.offsetTop - top.height }
  const places = [top, low]
  cardTop.value = places[placeCard(dice.value, places)] === low ? low.top : null
}, { flush: 'post' })

const history = shallowRef(loadHistory())
/** The sheet open above the controls, if any. */
type Sheet = 'history' | 'pool' | 'skin'
const openSheet = ref<Sheet | null>(null)
function toggle(sheet: Sheet) {
  openSheet.value = openSheet.value === sheet ? null : sheet
}
// Android's back gesture closes the open sheet before it leaves the app.
useBackButton(() => {
  if (!openSheet.value) return false
  openSheet.value = null
  return true
})
// The cup hands over a new array each time the dice settle, and null in between.
watch(result, (values) => {
  if (!values) return
  history.value = addRoll(history.value, values, pool.value, Date.now())
  saveHistory(history.value)
})
// The dice picker's pictures hold the page for a moment as they are drawn,
// unnoticed as the splash fades out.
watch(ready, (now) => {
  if (now) drawDieIcons(skin.value)
})
// The loading screen is the static page's (app/spa-loading-template.html),
// so its animation runs on unbroken from before any script. It fades out once
// the dice are ready, or once they never will be.
watch(() => ready.value || failed.value, (done) => {
  if (done) hideSplash()
})
// Shaking with a sheet open would hide the roll behind it.
watch(rolling, (now) => {
  if (now) openSheet.value = null
})

// The space bar rolls, as a click does; a key press also lets the sound start.
function onKeydown(event: KeyboardEvent) {
  if (!isRollKey(event)) return
  // Space would otherwise scroll the page.
  event.preventDefault()
  toss()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function clearHistory() {
  history.value = []
  saveHistory(history.value)
}

const debugText = ref('')
const traceNote = ref('')

/** A button label that shows `message` for 2 seconds after an action, then goes back. */
function flashLabel(label: string) {
  const status = reactive({ text: label, flash })
  let timer: ReturnType<typeof setTimeout> | undefined
  function flash(message: string) {
    status.text = message
    clearTimeout(timer)
    timer = setTimeout(() => status.text = label, 2000)
  }
  onBeforeUnmount(() => clearTimeout(timer))
  return status
}

const traceStatus = flashLabel('Copy trace')

/**
 * Copies `json` for pasting on the computer through Universal Clipboard, or
 * saves it as a file where the clipboard is refused. Says which it did.
 */
async function copyOrSave(json: string, fileName: string): Promise<'Copied' | 'Saved'> {
  try {
    await navigator.clipboard.writeText(json)
    return 'Copied'
  }
  catch {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    link.download = fileName
    link.click()
    // Safari can drop the download if the URL goes away in the same task.
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    return 'Saved'
  }
}

async function copyTrace() {
  const trace = exportTrace(traceNote.value)
  if (!trace) return
  traceStatus.flash(`${await copyOrSave(JSON.stringify(trace), 'trace.json')} ${trace.samples.length}`)
}

// The engine's own tuning objects stay out of Vue; the sliders change these
// copies, and they are written through.
const haptics = reactive<HapticTuning>(structuredClone(DEFAULT_HAPTIC_TUNING))
const sound = reactive<SoundTuning>(structuredClone(DEFAULT_SOUND_TUNING))
watchEffect(() => {
  const live = ready.value ? hapticTuning() : null
  if (!live) return
  live.minPulseGapMs = haptics.minPulseGapMs
  live.minIntensity = haptics.minIntensity
  live.dieFeel = haptics.dieFeel
  live.fullFeelSpeed = haptics.fullFeelSpeed
  Object.assign(live.sharpness, haptics.sharpness)
})
watchEffect(() => {
  const live = ready.value ? soundTuning() : null
  if (!live) return
  live.muffleHz = sound.muffleHz
  Object.assign(live.floor, sound.floor)
  Object.assign(live.side, sound.side)
  Object.assign(live.die, sound.die)
})

const TEST_SURFACES: Surface[] = ['floor', 'wall', 'glass', 'die']

interface TuningSlider {
  label: string
  min: number
  max: number
  step: number
  read: () => number
  write: (value: number) => void
}

const voiceSliders = (name: VoiceName): TuningSlider[] => {
  const voice = sound[name]
  return [
    { label: `${name} band Hz`, min: 200, max: 4000, step: 50, read: () => voice.band, write: value => voice.band = value },
    { label: `${name} knock Hz`, min: 60, max: 1500, step: 10, read: () => voice.knock, write: value => voice.knock = value },
    { label: `${name} decay ms`, min: 5, max: 80, step: 1, read: () => voice.decay * 1000, write: value => voice.decay = value / 1000 },
    { label: `${name} gain`, min: 0.05, max: 1, step: 0.05, read: () => voice.gain, write: value => voice.gain = value },
  ]
}

type TuningGroup = 'haptics' | 'sound'
const TUNING_LABELS: Record<TuningGroup, string> = { haptics: 'Haptics', sound: 'Sound' }
const TUNING_GROUPS = Object.keys(TUNING_LABELS) as TuningGroup[]

const TUNING_SLIDERS: Record<TuningGroup, TuningSlider[]> = {
  haptics: [
    { label: 'gap ms', min: 15, max: 80, step: 1, read: () => haptics.minPulseGapMs, write: value => haptics.minPulseGapMs = value },
    { label: 'min intensity', min: 0, max: 0.6, step: 0.05, read: () => haptics.minIntensity, write: value => haptics.minIntensity = value },
    { label: 'die feel', min: 0, max: 1, step: 0.05, read: () => haptics.dieFeel, write: value => haptics.dieFeel = value },
    { label: 'full feel cm/s', min: 150, max: 1500, step: 10, read: () => haptics.fullFeelSpeed, write: value => haptics.fullFeelSpeed = value },
    ...TEST_SURFACES.map(surface => ({ label: `${surface} sharp`, min: 0, max: 1, step: 0.05, read: () => haptics.sharpness[surface], write: (value: number) => haptics.sharpness[surface] = value })),
  ],
  sound: [
    { label: 'muffle Hz', min: 500, max: 8000, step: 100, read: () => sound.muffleHz, write: value => sound.muffleHz = value },
    ...voiceSliders('side'),
    ...voiceSliders('floor'),
    ...voiceSliders('die'),
  ],
}
const tuningGroup = ref<TuningGroup | null>(null)

const tuningStatus = flashLabel('Copy tuning')

async function copyTuning() {
  tuningStatus.flash(await copyOrSave(JSON.stringify({ haptics, sound }), 'tuning.json'))
}

if (debug) {
  const format = (value: number) => value.toFixed(1).padStart(6)
  const timer = setInterval(() => {
    const info = debugInfo()
    if (!info) return
    const { x, y, z } = info.acceleration
    debugText.value = [
      `state     ${state.value}`,
      `result    ${result.value?.join(', ') ?? '-'}`,
      `sensor    ${info.sensorActive ? 'active' : 'no readings'}`,
      `accel     ${format(x)}${format(y)}${format(z)}`,
      `agitation ${format(info.agitation)}`,
      `physics   ${format(info.physicsMs)} ms`,
      `impacts/s ${format(info.impactsPerSecond)}`,
      `peak hit  ${format(info.peakStrength)}`,
      `sound     ${info.sound}`,
    ].join('\n')
  }, 100)
  onBeforeUnmount(() => clearInterval(timer))
}
</script>

<style scoped>
.cup,
.cup__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.cup {
  /* The cup is turned back when the screen rotates (useCounterRotation), so
     its edges do not line up with the viewport's safe-area insets. Keeping
     clear of the largest one is right whichever way the phone is held. */
  --safe-inset: max(env(safe-area-inset-top, 0px), env(safe-area-inset-right, 0px), env(safe-area-inset-bottom, 0px), env(safe-area-inset-left, 0px));
}

.cup__message {
  position: absolute;
  top: 50%;
  right: 2rem;
  left: 2rem;
  translate: 0 -50%;
  margin: 0;
  text-align: center;
  font-size: 1.25rem;
  text-shadow: 0 1px 4px rgb(0 0 0 / 60%);
  pointer-events: none;
}

.cup__message--pulse {
  animation: cup__pulse 1.6s ease-in-out infinite;
}

@keyframes cup__pulse {
  50% {
    opacity: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cup__message--pulse {
    animation: none;
  }
}

.cup__footer {
  position: absolute;
  right: 0;
  bottom: var(--safe-inset);
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  /* Taps around the buttons still reach the canvas and shake the cup. */
  pointer-events: none;
}

.cup__settle,
.cup__controls {
  pointer-events: auto;
}

.cup__sheet {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  /* On a tablet, or a phone held sideways, it stays phone-wide. */
  max-width: 28rem;
  margin-inline: auto;
  padding: 1rem 1rem calc(var(--safe-inset) + 1rem);
  box-sizing: border-box;
  border-radius: 1.5rem 1.5rem 0 0;
  /* Glass, but mostly felt: the dice show through as colour and movement,
     while the buttons it covers blur away rather than showing through. */
  background: color-mix(in srgb, var(--color-felt) 80%, transparent);
  -webkit-backdrop-filter: blur(32px) saturate(150%);
  backdrop-filter: blur(32px) saturate(150%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 25%), 0 -8px 24px rgb(0 0 0 / 25%);
}

.cup__sheet-enter-active,
.cup__sheet-leave-active {
  transition: translate 0.25s ease-out;
}

.cup__sheet-enter-from,
.cup__sheet-leave-to {
  translate: 0 100%;
}

@media (prefers-reduced-motion: reduce) {
  .cup__sheet-enter-active,
  .cup__sheet-leave-active {
    transition: none;
  }
}

.cup__controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.cup__result {
  position: absolute;
  top: calc(var(--safe-inset) + 1.5rem);
  left: 50%;
  translate: -50% 0;
  pointer-events: none;
}

.cup__hint {
  margin: 0;
  text-align: center;
  text-wrap: balance;
}

.cup__debug {
  position: absolute;
  top: var(--safe-inset);
  left: 0;
  padding: 0.5rem;
  font: 12px/1.4 ui-monospace, monospace;
  background: rgb(0 0 0 / 55%);
  pointer-events: none;
}

.cup__debug pre {
  margin: 0;
  font: inherit;
}

.cup__trace,
.cup__buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  pointer-events: auto;
}

.cup__tuning {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
  pointer-events: auto;
}

.cup__tuning label {
  display: flex;
  flex-direction: column;
}

/* The browser's look for the debug controls, which preflight strips. Keep
   above the rules below, which it would otherwise reset. */
.cup__debug :is(input, button) {
  all: revert;
}

/* 16px stops iOS Safari zooming in on focus. */
.cup__trace input,
.cup__trace button,
.cup__buttons button {
  font: 16px/1.2 system-ui, sans-serif;
}

.cup__trace input {
  width: 10rem;
}
</style>
