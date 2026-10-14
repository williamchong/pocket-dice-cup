<template>
  <!-- Laid out as app/spa-loading-template.html and the iOS launch screen,
       so the three hand over without a jump. -->
  <div class="splash">
    <svg
      class="splash__die"
      width="96"
      height="96"
      viewBox="0 0 96 96"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="4"
        width="88"
        height="88"
        rx="20"
        fill="var(--color-cream)"
      />
      <g fill="var(--color-felt)">
        <circle
          v-for="[cx, cy] in PIPS"
          :key="`${cx},${cy}`"
          :cx="cx"
          :cy="cy"
          r="8"
        />
      </g>
    </svg>
    <div class="splash__text">
      <h1>Pocket Dice Cup</h1>
      <p>Loading…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const PIPS = [[28, 28], [68, 28], [48, 48], [28, 68], [68, 68]] as const
</script>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  text-align: center;
  background: var(--color-felt);
}

.splash__die {
  position: absolute;
  top: 50%;
  left: 50%;
  translate: -50% -50%;
}

/* Below the die, from the middle of the screen as on the launch screen. */
.splash__text {
  position: absolute;
  top: calc(50% + 72px);
  right: 0;
  left: 0;
}

.splash__text h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.splash__text p {
  margin: 12px 0 0;
  opacity: 0.7;
}
</style>
