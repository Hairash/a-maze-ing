<script setup>
import { computed } from 'vue'
import Cell from './Cell.vue'
import SoulTrailOverlay from './SoulTrailOverlay.vue'
import { isHidden } from '../game/engine.js'

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
  edgeHideSequenceActive: { type: Boolean, default: false },
})

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

function getCellHideDelayMs(x, y) {
  if (!props.edgeHideSequenceActive) return 0
  const stepDelayMs = 24
  return getEdgeRank(x, y) * stepDelayMs
}

function isCellHidden(x, y) {
  if (props.edgeHideSequenceActive) return true
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
          :transition-delay-ms="getCellHideDelayMs(x - 1, y - 1)"
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
    <img v-if="!revealMap" class="board-hero" :src="heroImage"
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
}
</style>
