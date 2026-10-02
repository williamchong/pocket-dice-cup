<template>
  <main class="cup">
    <canvas
      ref="canvas"
      class="cup__canvas"
    />

    <div
      v-if="permission !== 'granted'"
      class="cup__gate"
    >
      <h1>3D Dice Cup</h1>
      <p v-if="failed">
        3D graphics could not start in this browser.
      </p>
      <template v-else-if="permission === null">
        <p>Shake your phone like a dice cup, then put it down screen-up.</p>
        <button
          type="button"
          :disabled="!ready"
          @click="start"
        >
          {{ ready ? 'Start' : 'Loading…' }}
        </button>
      </template>
      <p v-else-if="permission === 'denied'">
        Motion access was refused, so shaking cannot be detected. Close this tab, open the page again and allow motion access.
      </p>
      <p v-else>
        This browser has no motion sensor. Open the page on a phone.
      </p>
    </div>

    <pre
      v-if="debug"
      class="cup__debug"
    >{{ debugText }}</pre>
  </main>
</template>

<script setup lang="ts">
const canvas = useTemplateRef('canvas')
const { ready, failed, state, result, permission, start, debugInfo } = useDiceCup(canvas)

// `?debug` shows what the sensor and the state machine are doing, for tuning
// on a real phone where there is no console.
const debug = 'debug' in useRoute().query
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
