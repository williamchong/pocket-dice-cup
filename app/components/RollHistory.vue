<template>
  <section
    class="history"
    aria-label="Roll history"
  >
    <p
      v-if="rolls.length === 0"
      class="history__empty"
    >
      No rolls yet.
    </p>
    <ol
      v-else
      class="history__list"
    >
      <li
        v-for="roll in rolls"
        :key="roll.time"
        class="history__roll"
      >
        <span class="history__total">{{ rollTotal(roll.values) }}</span>
        <span
          v-if="rollBreakdown(roll.values, roll.kinds)"
          class="history__dice"
        >{{ rollBreakdown(roll.values, roll.kinds) }}</span>
        <time
          class="history__time"
          :datetime="new Date(roll.time).toISOString()"
        >{{ formatTime(roll.time) }}</time>
      </li>
    </ol>
    <div class="history__buttons">
      <button
        type="button"
        :disabled="rolls.length === 0"
        @click="emit('clear')"
      >
        Clear
      </button>
      <button
        type="button"
        @click="emit('close')"
      >
        Close
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Roll } from '~/utils/rollHistory'

defineProps<{
  /** Newest first. */
  rolls: readonly Roll[]
}>()

const emit = defineEmits<{ clear: [], close: [] }>()

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** The time alone for a roll from today, with the date for older ones. */
function formatTime(time: number): string {
  const today = new Date().toDateString() === new Date(time).toDateString()
  return (today ? TIME_FORMAT : DATE_TIME_FORMAT).format(time)
}
</script>

<style scoped>
.history {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: min(100%, 22rem);
  max-height: 50vh;
  padding: 1rem;
  box-sizing: border-box;
  border-radius: 1rem;
  background: rgb(18 36 27 / 92%);
}

.history__empty {
  margin: 0;
  text-align: center;
  opacity: 0.8;
}

.history__list {
  flex: 1;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  /* The body turns touch scrolling off everywhere else (main.css). */
  touch-action: pan-y;
  overscroll-behavior: contain;
}

.history__roll {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgb(244 239 227 / 12%);
  font-variant-numeric: tabular-nums;
}

.history__total {
  min-width: 2ch;
  font-size: 1.25rem;
  font-weight: 700;
  text-align: right;
}

.history__dice {
  flex: 1;
  opacity: 0.8;
}

.history__time {
  margin-left: auto;
  font-size: 0.85rem;
  opacity: 0.6;
  white-space: nowrap;
}

.history__buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.history__buttons button {
  padding: 0.5rem 1rem;
  border: 0;
  border-radius: 999px;
  background: rgb(244 239 227 / 15%);
  color: inherit;
  font: 16px/1.2 system-ui, sans-serif;
}

.history__buttons button:disabled {
  opacity: 0.35;
}
</style>
