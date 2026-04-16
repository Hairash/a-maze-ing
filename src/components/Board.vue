<template>
  <div class="board">
    <div class="cell_line" :style="`width: ${cellSize * width}px`" v-for="y in height" :key="`line-${y - 1}`">
      <template v-for="x in width" :key="`cell-${x - 1}-${y - 1}`">
        <Cell
          :size="cellSize"
          :type="getCellType(x - 1, y - 1)"
          :is-hidden="isHidden(x - 1, y - 1, heroX, heroY, effectiveSight)"
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
})

const effectiveSight = computed(() => (props.revealMap ? Number.POSITIVE_INFINITY : props.heroSight))

const trailDots = computed(() => {
  if (!props.showSoulTrack) return []
  return computeTrailDots(props.soulPath, props.cellSize)
})

const dotRadius = computed(() => Math.max(1.2, props.cellSize / 20))

function getCellType(x, y) {
  return props.field?.[x]?.[y] ?? 'wall'
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
</style>
