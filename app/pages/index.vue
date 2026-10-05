<template>
  <main
    class="cup"
    :style="counterRotationStyle"
  >
    <!-- Tap to shake stays on with a working sensor too: desktop Chrome
         reports one but never sends a reading, and a tap is a quick re-roll. -->
    <canvas
      ref="canvas"
      class="cup__canvas"
      @pointerdown="toss"
    />

    <div
      v-if="failed || permission === null"
      class="cup__gate"
    >
      <h1>Pocket Dice Cup</h1>
      <p v-if="failed">
        3D graphics could not start in this browser.
      </p>
      <template v-else>
        <p>Shake your phone like a dice cup, then put it down screen-up.</p>
        <button
          type="button"
          :disabled="!ready"
          @click="start"
        >
          {{ ready ? 'Start' : 'Loading…' }}
        </button>
      </template>
    </div>

    <p
      v-else-if="permission === 'denied'"
      class="cup__hint"
    >
      Motion access was refused, so tap to shake. To shake the phone instead, open the page again and allow motion access.
    </p>
    <p
      v-else-if="permission === 'unsupported'"
      class="cup__hint"
    >
      This browser has no motion sensor, so click or tap to shake.
    </p>

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
        <!-- Closed at first: open, the panel covers the start button on a phone. -->
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
import { DEFAULT_SOUND_TUNING, type SoundTuning } from '~/engine/feedback/clackSound'
import { DEFAULT_HAPTIC_TUNING, type HapticTuning } from '~/engine/feedback/cupFeedback'
import type { Surface } from '~/engine/physics/world'

// `?debug` shows what the sensor and the state machine are doing, for tuning
// on a real phone where there is no console. It also starts the die in the
// same place every time, so runs can be compared.
const debug = 'debug' in useRoute().query || Boolean(useRuntimeConfig().public.debug)

const canvas = useTemplateRef('canvas')
// Shaking tips the phone far enough for the browser to rotate the page; the
// cup stays put in the phone's own frame instead.
const counterRotationStyle = useCounterRotation()
const { ready, failed, state, result, permission, start, toss, debugInfo, exportTrace, hapticTuning, soundTuning, testHit } = useDiceCup(canvas, { randomStart: !debug, recordTrace: debug })
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
  Object.assign(live.sharpness, haptics.sharpness)
})
watchEffect(() => {
  const live = ready.value ? soundTuning() : null
  if (!live) return
  live.muffleHz = sound.muffleHz
  Object.assign(live.floor, sound.floor)
  Object.assign(live.side, sound.side)
})

const TEST_SURFACES: Surface[] = ['floor', 'wall', 'glass']

interface TuningSlider {
  label: string
  min: number
  max: number
  step: number
  read: () => number
  write: (value: number) => void
}

const voiceSliders = (name: 'floor' | 'side'): TuningSlider[] => {
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
    ...TEST_SURFACES.map(surface => ({ label: `${surface} sharp`, min: 0, max: 1, step: 0.05, read: () => haptics.sharpness[surface], write: (value: number) => haptics.sharpness[surface] = value })),
  ],
  sound: [
    { label: 'muffle Hz', min: 500, max: 8000, step: 100, read: () => sound.muffleHz, write: value => sound.muffleHz = value },
    ...voiceSliders('side'),
    ...voiceSliders('floor'),
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

.cup__gate {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  background: rgb(18 36 27 / 85%);
}

.cup__gate h1,
.cup__gate p {
  margin: 0;
  max-width: 22rem;
}

.cup__gate button {
  padding: 0.9rem 2.5rem;
  border: 0;
  border-radius: 999px;
  background: #f4efe3;
  color: #12241b;
  font: inherit;
  font-weight: 600;
}

.cup__gate button:disabled {
  opacity: 0.5;
}

.cup__hint {
  position: absolute;
  right: 0;
  bottom: var(--safe-inset);
  left: 0;
  margin: 0;
  padding: 1rem 2rem;
  text-align: center;
  pointer-events: none;
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
