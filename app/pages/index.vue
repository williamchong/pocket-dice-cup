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
          {{ traceStatus }}
        </button>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
// `?debug` shows what the sensor and the state machine are doing, for tuning
// on a real phone where there is no console. It also starts the die in the
// same place every time, so runs can be compared.
const debug = 'debug' in useRoute().query

const canvas = useTemplateRef('canvas')
// Shaking tips the phone far enough for the browser to rotate the page; the
// cup stays put in the phone's own frame instead.
const counterRotationStyle = useCounterRotation()
const { ready, failed, state, result, permission, start, toss, debugInfo, exportTrace } = useDiceCup(canvas, { randomStart: !debug, recordTrace: debug })
const debugText = ref('')
const traceNote = ref('')
const COPY_LABEL = 'Copy trace'
const traceStatus = ref(COPY_LABEL)
let traceStatusTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Copies the trace for pasting on the computer through Universal Clipboard,
 * or saves it as a file where the clipboard is refused.
 */
async function copyTrace() {
  const trace = exportTrace(traceNote.value)
  if (!trace) return
  const json = JSON.stringify(trace)
  try {
    await navigator.clipboard.writeText(json)
    traceStatus.value = `Copied ${trace.samples.length}`
  }
  catch {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    link.download = 'trace.json'
    link.click()
    // Safari can drop the download if the URL goes away in the same task.
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    traceStatus.value = `Saved ${trace.samples.length}`
  }
  clearTimeout(traceStatusTimer)
  traceStatusTimer = setTimeout(() => traceStatus.value = COPY_LABEL, 2000)
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

.cup__trace {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  pointer-events: auto;
}

/* 16px stops iOS Safari zooming in on focus. */
.cup__trace input,
.cup__trace button {
  font: 16px/1.2 system-ui, sans-serif;
}

.cup__trace input {
  width: 10rem;
}
</style>
