<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useViewportSize } from '../composables/useViewportSize.js'
import {
  LETTER_GRIDS,
  LETTER_ROW_COUNT,
  LETTER_INTER_GAP_COLS,
} from '../game/titleField.js'

const emit = defineEmits(['start'])

const { width: vw, height: vh } = useViewportSize()

// ────────────────────────────────────────────────────────────────────
// Layout
// ────────────────────────────────────────────────────────────────────

// Total columns the title occupies, including gaps between letters.
const TITLE_TOTAL_COLS = LETTER_GRIDS.reduce(
  (sum, l, i) => sum + l.grid[0].length + (i > 0 ? LETTER_INTER_GAP_COLS : 0),
  0,
)
const TITLE_VIEWPORT_FRACTION = 0.92
const VERTICAL_RESERVE_FRACTION = 0.5

const cellSize = computed(() => {
  const maxByWidth = (vw.value * TITLE_VIEWPORT_FRACTION) / TITLE_TOTAL_COLS
  const maxByHeight = (vh.value * VERTICAL_RESERVE_FRACTION) / LETTER_ROW_COUNT
  return Math.max(2, Math.floor(Math.min(maxByWidth, maxByHeight)))
})

// ────────────────────────────────────────────────────────────────────
// Pulse animation: each letter independently fades in, holds, and fades
// out at random durations. A scheduler keeps spawning new pulses so the
// title is never fully black for long, while a cap on simultaneously
// active pulses prevents everything lighting up at once.
// ────────────────────────────────────────────────────────────────────

const MAX_SIMULTANEOUS_PULSES = 4
const FADE_IN_MIN_MS = 700
const FADE_IN_MAX_MS = 1500
const HOLD_MIN_MS = 80
const HOLD_MAX_MS = 600
const FADE_OUT_MIN_MS = 700
const FADE_OUT_MAX_MS = 1500
const SCHEDULER_DELAY_MIN_MS = 150
const SCHEDULER_DELAY_MAX_MS = 1100

// Outro: synchronized reveal-all → 1s pause → fade-all-out → emit 'start'.
const OUTRO_FADE_IN_MS = 800
const OUTRO_HOLD_MS = 2000
const OUTRO_FADE_OUT_MS = 800
const OUTRO_BUTTON_FADE_MS = 300
const outroButtonFadeCss = `${OUTRO_BUTTON_FADE_MS}ms`

const letterStates = reactive(
  LETTER_GRIDS.map(() => ({
    opacity: 0,
    transitionMs: FADE_IN_MIN_MS,
    pulseActive: false,
  })),
)

let activePulseCount = 0
const activeTimers = new Set()
const outroActive = ref(false)

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function trackTimeout(fn, ms) {
  const id = window.setTimeout(() => {
    activeTimers.delete(id)
    fn()
  }, ms)
  activeTimers.add(id)
  return id
}

function triggerPulse() {
  if (activePulseCount >= MAX_SIMULTANEOUS_PULSES) return
  // Pick a random letter that isn't currently pulsing.
  const candidates = []
  for (let i = 0; i < letterStates.length; i++) {
    if (!letterStates[i].pulseActive) candidates.push(i)
  }
  if (candidates.length === 0) return
  const idx = candidates[Math.floor(Math.random() * candidates.length)]

  const fadeInMs = rand(FADE_IN_MIN_MS, FADE_IN_MAX_MS)
  const holdMs = rand(HOLD_MIN_MS, HOLD_MAX_MS)
  const fadeOutMs = rand(FADE_OUT_MIN_MS, FADE_OUT_MAX_MS)

  activePulseCount++
  letterStates[idx].pulseActive = true
  letterStates[idx].transitionMs = fadeInMs
  letterStates[idx].opacity = 1

  trackTimeout(() => {
    letterStates[idx].transitionMs = fadeOutMs
    letterStates[idx].opacity = 0
    trackTimeout(() => {
      letterStates[idx].pulseActive = false
      activePulseCount--
    }, fadeOutMs)
  }, fadeInMs + holdMs)
}

function scheduleLoop() {
  if (outroActive.value) return
  const delay = rand(SCHEDULER_DELAY_MIN_MS, SCHEDULER_DELAY_MAX_MS)
  trackTimeout(() => {
    triggerPulse()
    scheduleLoop()
  }, delay)
}

function clearAllTimers() {
  activeTimers.forEach((id) => window.clearTimeout(id))
  activeTimers.clear()
}

function onStartClick() {
  if (outroActive.value) return
  outroActive.value = true

  // Stop the random pulse system and reset all per-letter state so the
  // synchronized reveal animates from current opacity → 1.
  clearAllTimers()
  for (let i = 0; i < letterStates.length; i++) {
    letterStates[i].pulseActive = true
    letterStates[i].transitionMs = OUTRO_FADE_IN_MS
    letterStates[i].opacity = 1
  }

  // After the synchronized reveal + 1s hold, fade everything out, then
  // emit 'start' so App.vue can play the intro cutscene.
  trackTimeout(() => {
    for (let i = 0; i < letterStates.length; i++) {
      letterStates[i].transitionMs = OUTRO_FADE_OUT_MS
      letterStates[i].opacity = 0
    }
    trackTimeout(() => {
      emit('start')
    }, OUTRO_FADE_OUT_MS)
  }, OUTRO_FADE_IN_MS + OUTRO_HOLD_MS)
}

onMounted(() => {
  // Kick off a few pulses immediately so the title isn't blank for the
  // first scheduler tick.
  triggerPulse()
  trackTimeout(() => triggerPulse(), 250)
  scheduleLoop()
})

onBeforeUnmount(() => {
  clearAllTimers()
})
</script>

<template>
  <div class="start-menu">
    <div class="start-menu__title" :style="{ gap: `${cellSize * LETTER_INTER_GAP_COLS}px` }">
      <div
        v-for="(letter, i) in LETTER_GRIDS"
        :key="i"
        class="letter"
        :style="{
          opacity: letterStates[i].opacity,
          transitionDuration: `${letterStates[i].transitionMs}ms`,
        }"
      >
        <div
          v-for="(row, ry) in letter.grid"
          :key="ry"
          class="letter-row"
        >
          <div
            v-for="(cell, cx) in row"
            :key="cx"
            class="letter-cell"
            :class="{ 'letter-cell--brick': cell === 1 }"
            :style="{ width: `${cellSize}px`, height: `${cellSize}px` }"
          ></div>
        </div>
      </div>
    </div>
    <button
      class="brick-btn start-menu__btn"
      :class="{ 'start-menu__btn--hidden': outroActive }"
      :disabled="outroActive"
      @click="onStartClick"
    >
      Start game
    </button>
  </div>
</template>

<style scoped>
.start-menu {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 36px;
  padding: 16px;
  box-sizing: border-box;
}

.start-menu__title {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  flex: 0 0 auto;
}

.letter {
  display: flex;
  flex-direction: column;
  line-height: 0;
  /* Default; the per-letter pulse overrides duration via inline style. */
  transition-property: opacity;
  transition-timing-function: ease-in-out;
  will-change: opacity;
}

.letter-row {
  display: flex;
}

.letter-cell {
  display: inline-block;
  vertical-align: top;
  background: transparent;
}

.letter-cell--brick {
  /* Stand-in for a white brick texture: solid white block. */
  background: #fff;
}

.start-menu__btn {
  flex: 0 0 auto;
  transition: opacity v-bind(outroButtonFadeCss) ease-out;
}
.start-menu__btn--hidden {
  opacity: 0;
  pointer-events: none;
}
</style>
