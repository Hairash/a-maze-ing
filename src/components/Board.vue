<template>
  <div class="board">
    <div class="cell_line" :style="`width: ${cellSize * width}px`" v-for="y in height" :key="`line-${y - 1}`">
      <template v-for="x in width" :key="`cell-${x - 1}-${y - 1}`">
        <Cell
          :size="cellSize"
          :type="getCellType(x - 1, y - 1)"
          :is-hidden="isCellHidden(x - 1, y - 1)"
          :transition-delay-ms="getCellHideDelayMs(x - 1, y - 1)"
          :activated="x - 1 === heroX && y - 1 === heroY"
        />
      </template>
    </div>
    <svg
      v-if="showSoulTrack"
      class="soul-trail-overlay"
      :width="cellSize * width"
      :height="cellSize * height"
      aria-hidden="true"
    >
      <g
        v-if="trailStartDot"
        class="trail-start-cross"
        :transform="`translate(${trailStartDot.x}, ${trailStartDot.y})`"
      >
        <line
          :x1="-startCrossHalfSize"
          :y1="-startCrossHalfSize"
          :x2="startCrossHalfSize"
          :y2="startCrossHalfSize"
          :stroke-width="startCrossStroke"
          stroke="rgba(255, 72, 122, 0.95)"
          stroke-linecap="round"
        />
        <line
          :x1="-startCrossHalfSize"
          :y1="startCrossHalfSize"
          :x2="startCrossHalfSize"
          :y2="-startCrossHalfSize"
          :stroke-width="startCrossStroke"
          stroke="rgba(255, 72, 122, 0.95)"
          stroke-linecap="round"
        />
      </g>
      <circle
        v-for="(dot, i) in trailDots"
        :key="i"
        :cx="dot.x"
        :cy="dot.y"
        :r="dotRadius"
        fill="rgba(0, 0, 0, 0.85)"
      />
    </svg>
    <img class="board-hero" :src="heroImage"
      :style="`left: ${heroX * cellSize}px; top: ${heroY * cellSize}px; width: ${cellSize}px; height: ${cellSize}px;`">
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Cell from './Cell.vue'
import { isHidden } from '../game/engine.js'
import { computeTrailDots } from '../game/soulTrail.js'

const props = defineProps({
  width: {
    type: Number,
    required: true,
  },
  height: {
    type: Number,
    required: true,
  },
  field: {
    type: Array,
    required: true,
  },
  heroX: {
    type: Number,
    required: true,
  },
  heroY: {
    type: Number,
    required: true,
  },
  cellSize: {
    type: Number,
    required: false,
  },
  heroSight: {
    type: Number,
    required: true,
  },
  heroImage: {
    type: String,
    required: true,
  },
  revealMap: {
    type: Boolean,
    required: false,
    default: false,
  },
  soulPath: {
    type: Array,
    required: false,
    default: () => [],
  },
  showSoulTrack: {
    type: Boolean,
    required: false,
    default: false,
  },
  edgeHideSequenceActive: {
    type: Boolean,
    required: false,
    default: false,
  },
})

const effectiveSight = computed(() => (props.revealMap ? Number.POSITIVE_INFINITY : props.heroSight))

const trailDots = computed(() => {
  if (!props.showSoulTrack) return []
  return computeTrailDots(props.soulPath, props.cellSize)
})

const dotRadius = computed(() => Math.max(1.2, props.cellSize / 20))
const trailStartDot = computed(() => trailDots.value[0] ?? null)
const startCrossHalfSize = computed(() => Math.max(5, props.cellSize * 0.22))
const startCrossStroke = computed(() => Math.max(2, props.cellSize * 0.1))

function getCellType(x, y) {
  return props.field?.[x]?.[y] ?? 'wall'
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

<style scoped>
.cell_line {
  line-height: 0;
}

.board {
  position: relative;
}

.board-hero {
  position: absolute;
  pointer-events: none;
  z-index: 3;
}

.soul-trail-overlay {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 2;
}

.trail-start-cross {
  filter: drop-shadow(0 0 6px rgba(255, 72, 122, 0.7));
}
</style>
