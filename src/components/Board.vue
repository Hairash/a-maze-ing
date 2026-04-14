<template>
  <div class="board">
    <div class="cell_line" :style="`width: ${cellSize * width}px`" v-for="(line, y) in field">
      <template v-for="(cellType, x) in line">
        <Cell
          :size="cellSize"
          :type="cellType"
          :is-hidden="isHidden(x, y, heroX, heroY, effectiveSight)"
        />
      </template>
    </div>
    <div
      v-if="showSoulTrack"
      class="soul-track-overlay"
      aria-hidden="true"
    >
      <div
        v-for="(count, key) in soulTrack"
        :key="key"
        class="soul-track-cell"
        :style="getTrackCellStyle(key, count)"
      ></div>
    </div>
    <img class="board-hero" :src="heroImage"
      :style="`left: ${heroX * cellSize}px; top: ${heroY * cellSize}px; width: ${cellSize}px; height: ${cellSize}px;`">
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Cell from './Cell.vue'
import { isHidden } from '../game/engine.js'

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
  soulTrack: {
    type: Object,
    required: false,
    default: () => ({}),
  },
  showSoulTrack: {
    type: Boolean,
    required: false,
    default: false,
  },
})

const effectiveSight = computed(() => (props.revealMap ? Number.POSITIVE_INFINITY : props.heroSight))

function getTrackCellStyle(key, count) {
  const [x, y] = key.split(',').map(Number)
  const lineCount = Math.min(Math.max(1, Number(count) || 1), 10)
  const gradients = Array.from({ length: lineCount }, (_, idx) => {
    const offset = idx * 4
    const alpha = Math.min(0.2 + idx * 0.05, 0.75)
    return `repeating-linear-gradient(45deg, transparent ${offset}px, rgba(153, 228, 255, ${alpha}) ${offset}px ${offset + 1.7}px, transparent ${offset + 1.7}px ${offset + 7}px)`
  }).join(', ')

  return {
    left: `${x * props.cellSize}px`,
    top: `${y * props.cellSize}px`,
    width: `${props.cellSize}px`,
    height: `${props.cellSize}px`,
    backgroundImage: gradients,
    opacity: 0.8,
  }
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

.soul-track-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.soul-track-cell {
  position: absolute;
  border-radius: 8px;
  mix-blend-mode: screen;
}
</style>
