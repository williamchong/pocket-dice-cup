<template>
  <!-- A hand shaking a phone in short bursts, the dice rattling on its
       screen, for the hint beside it; the text says it to screen readers. -->
  <svg
    class="shake"
    viewBox="0 0 64 64"
    aria-hidden="true"
  >
    <path
      class="shake__lines"
      d="M9 12 Q5 20 9 28 M55 12 Q59 20 55 28"
    />
    <g class="shake__hand">
      <!-- The palm and wrist, open below the phone. -->
      <path
        fill="none"
        d="M19 30 C15 38 17 47 25 51 L25 62 M45 30 C49 38 47 47 40 51 L40 62"
      />
      <rect
        x="22"
        y="5"
        width="20"
        height="34"
        rx="4"
      />
      <g class="shake__dice">
        <rect
          x="27"
          y="12"
          width="5"
          height="5"
          rx="1.2"
        />
        <rect
          x="32"
          y="22"
          width="5"
          height="5"
          rx="1.2"
        />
      </g>
      <!-- Fingers curled round the right edge, the thumb over the left. -->
      <rect
        x="38"
        y="17"
        width="9"
        height="5"
        rx="2.5"
      />
      <rect
        x="38"
        y="22.5"
        width="9.5"
        height="5"
        rx="2.5"
      />
      <rect
        x="38"
        y="28"
        width="9"
        height="5"
        rx="2.5"
      />
      <rect
        x="15"
        y="31"
        width="15"
        height="6"
        rx="3"
        transform="rotate(-55 22.5 34)"
      />
    </g>
  </svg>
</template>

<style scoped>
.shake {
  width: 3rem;
  height: 3rem;
  flex: none;
  overflow: visible;
  fill: var(--color-felt);
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Three quick shakes from the wrist and a rest, about the pace of shaking a
   cup. Five times, not for ever: SVG inside the page is not animated on the
   compositor, so each frame of it is the page's own work, and it would keep
   drawing while the dice are asleep and the cup draws nothing. The hint comes
   anew, and plays again, each time the dice stop after a tap. */
.shake__hand {
  transform-origin: 32px 62px;
  animation: shake__hand 1.8s ease-in-out 5;
}

.shake__dice {
  fill: currentColor;
  stroke: none;
  animation: shake__dice 1.8s ease-in-out 5;
}

.shake__lines {
  fill: none;
  opacity: 0;
  animation: shake__lines 1.8s ease-in-out 5;
}

@keyframes shake__hand {
  0%, 55%, 100% { transform: rotate(0deg); }
  9% { transform: rotate(-14deg); }
  18% { transform: rotate(14deg); }
  27% { transform: rotate(-14deg); }
  36% { transform: rotate(14deg); }
  45% { transform: rotate(-6deg); }
}

/* The dice lag the phone, thrown against the far side of each swing. */
@keyframes shake__dice {
  0%, 60%, 100% { transform: translate(0, 0); }
  12% { transform: translate(2.5px, -1px); }
  21% { transform: translate(-2.5px, 1px); }
  30% { transform: translate(2.5px, -1px); }
  39% { transform: translate(-2.5px, 1px); }
}

@keyframes shake__lines {
  0%, 50%, 100% { opacity: 0; }
  10%, 40% { opacity: 0.7; }
}

@media (prefers-reduced-motion: reduce) {
  .shake__hand,
  .shake__dice {
    animation: none;
  }

  .shake__lines {
    animation: none;
    opacity: 0.7;
  }
}
</style>
