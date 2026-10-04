<template>
  <main class="cup">
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

    <pre
      v-if="debug"
      class="cup__debug"
    >{{ debugText }}</pre>
  </main>
</template>

<script setup lang="ts">
// `?debug` shows what the sensor and the state machine are doing, for tuning
// on a real phone where there is no console. It also starts the die in the
// same place every time, so runs can be compared.
const debug = 'debug' in useRoute().query

const canvas = useTemplateRef('canvas')
const { ready, failed, state, result, permission, start, toss, debugInfo } = useDiceCup(canvas, { randomStart: !debug })
const debugText = ref('')

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
  bottom: env(safe-area-inset-bottom, 0);
  left: 0;
  margin: 0;
  padding: 1rem 2rem;
  text-align: center;
  pointer-events: none;
}

.cup__debug {
  position: absolute;
  top: env(safe-area-inset-top, 0);
  left: 0;
  margin: 0;
  padding: 0.5rem;
  font: 12px/1.4 ui-monospace, monospace;
  background: rgb(0 0 0 / 55%);
  pointer-events: none;
}
</style>
