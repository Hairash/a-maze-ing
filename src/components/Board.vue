<script setup>
import { computed } from 'vue'
import Cell from './Cell.vue'
import SoulTrailOverlay from './SoulTrailOverlay.vue'
import { isHidden } from '../game/engine.js'
import {
  CELL_FADE_DURATION_MS,
  CELL_FADE_STEP_DELAY_MS,
  INTRO_REVEAL_FADE_DURATION_MS,
  HERO_FADE_DURATION_MS,
} from '../game/const.js'

const props = defineProps({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  field: { type: Array, required: true },
  wallVariants: { type: Array, default: null },
  heroX: { type: Number, required: true },
  heroY: { type: Number, required: true },
  cellSize: { type: Number, required: false },
  heroSight: { type: Number, required: true },
  heroImage: { type: String, required: true },
  revealMap: { type: Boolean, default: false },
  soulPath: { type: Array, default: () => [] },
  showSoulTrack: { type: Boolean, default: false },
  soulFadeSequenceActive: { type: Boolean, default: false },
  edgeHideSequenceActive: { type: Boolean, default: false },
  introActive: { type: Boolean, default: false },
  introRevealing: { type: Boolean, default: false },
})

const heroFadeDurationCss = `${HERO_FADE_DURATION_MS}ms`

const effectiveSight = computed(() => (props.revealMap ? Number.POSITIVE_INFINITY : props.heroSight))

function getCellType(x, y) {
  return props.field?.[x]?.[y] ?? 'wall'
}

function getWallVariant(x, y) {
  return props.wallVariants?.[x]?.[y] ?? null
}

function getEdgeRank(x, y) {
  const left = x
  const right = props.width - 1 - x
  const top = y
  const bottom = props.height - 1 - y
  return Math.min(left, right, top, bottom)
}

function getHeroDistance(x, y) {
  const dx = x - props.heroX
  const dy = y - props.heroY
  return Math.round(Math.sqrt(dx * dx + dy * dy))
}

function getCellTransitionDelayMs(x, y) {
  if (props.edgeHideSequenceActive) {
    return getEdgeRank(x, y) * CELL_FADE_STEP_DELAY_MS
  }
  if (props.introRevealing) {
    return getHeroDistance(x, y) * CELL_FADE_STEP_DELAY_MS
  }
  return 0
}

function getCellTransitionDurationMs() {
  return props.introRevealing ? INTRO_REVEAL_FADE_DURATION_MS : CELL_FADE_DURATION_MS
}

function isCellHidden(x, y) {
  if (props.edgeHideSequenceActive || props.introActive) return true
  return isHidden(x, y, props.heroX, props.heroY, effectiveSight.value)
}
</script>

<template>
  <div class="board">
    <div class="cell_line" :style="`width: ${cellSize * width}px`" v-for="y in height" :key="`line-${y - 1}`">
      <template v-for="x in width" :key="`cell-${x - 1}-${y - 1}`">
        <Cell
          :size="cellSize"
          :type="getCellType(x - 1, y - 1)"
          :wall-variant="getWallVariant(x - 1, y - 1)"
          :is-hidden="isCellHidden(x - 1, y - 1)"
          :transition-delay-ms="getCellTransitionDelayMs(x - 1, y - 1)"
          :transition-duration-ms="getCellTransitionDurationMs()"
          :activated="x - 1 === heroX && y - 1 === heroY"
        />
      </template>
    </div>
    <SoulTrailOverlay
      v-if="showSoulTrack"
      :soul-path="soulPath"
      :cell-size="cellSize"
      :width="width"
      :height="height"
    />
    <img
      v-if="!revealMap"
      :class="['board-hero', { 'board-hero--fading': soulFadeSequenceActive || introActive }]"
      :src="heroImage"
      :style="`left: ${heroX * cellSize}px; top: ${heroY * cellSize}px; width: ${cellSize}px; height: ${cellSize}px;`">
  </div>
</template>

<style scoped>
.cell_line {
  line-height: 0;
}

.board {
  position: relative;
  background-color: #000;
}

.board-hero {
  position: absolute;
  pointer-events: none;
  z-index: 3;
  opacity: 1;
  transition: opacity v-bind(heroFadeDurationCss) ease-out;
}

.board-hero--fading {
  opacity: 0;
}
</style>
