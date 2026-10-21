<template>
  <!-- Small drawings for the about page, in the shake hint's line style
       (ShakeHintIcon.vue). The text beside each says the same to screen
       readers. -->
  <svg
    class="picture"
    viewBox="0 0 64 64"
    aria-hidden="true"
  >
    <!-- The phone lying screen up on the table, the dice at rest on it. -->
    <template v-if="name === 'flat'">
      <path d="M2 56 H62" />
      <path
        class="picture__screen"
        d="M4 50 H38 L60 26 H26 Z"
      />
      <path
        class="picture__die"
        d="M18 45 H26 L30 40.5 H22 Z M34 37 H42 L46 32.5 H38 Z"
      />
    </template>
    <!-- The phone tipped in the hand, the dice slid down to its low edge. -->
    <template v-else-if="name === 'settle'">
      <g transform="rotate(18 28 30)">
        <rect
          class="picture__screen"
          x="18"
          y="8"
          width="20"
          height="40"
          rx="4"
        />
        <rect
          class="picture__die"
          x="21"
          y="40"
          width="5"
          height="5"
          rx="1.2"
        />
        <rect
          class="picture__die"
          x="27"
          y="40"
          width="5"
          height="5"
          rx="1.2"
        />
      </g>
      <path d="M52 16 V40 M46 34 L52 40 L58 34" />
    </template>
    <!-- A die that only slid, with the faint ring the table draws round it. -->
    <template v-else-if="name === 'ring'">
      <circle
        class="picture__ring"
        cx="36"
        cy="32"
        r="20"
      />
      <rect
        x="26"
        y="22"
        width="20"
        height="20"
        rx="4"
      />
      <circle
        class="picture__die"
        cx="31"
        cy="27"
        r="2"
      />
      <circle
        class="picture__die"
        cx="36"
        cy="32"
        r="2"
      />
      <circle
        class="picture__die"
        cx="41"
        cy="37"
        r="2"
      />
      <path d="M4 28 H12 M6 36 H14" />
    </template>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: 'flat' | 'settle' | 'ring' }>()
</script>

<style scoped>
.picture {
  width: 3rem;
  height: 3rem;
  flex: none;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.picture__screen {
  fill: var(--color-felt);
}

.picture__die {
  fill: currentColor;
  stroke: none;
}

.picture__ring {
  stroke-width: 1.5;
  opacity: 0.45;
}
</style>
