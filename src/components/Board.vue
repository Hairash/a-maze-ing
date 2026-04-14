<template>
  <div class="board">
    <div class="cell_line" :style="`width: ${cellSize * width}px`" v-for="(line, y) in field">
      <template v-for="(cellType, x) in line">
        <Cell
          :size=cellSize
          :type=field[x][y]
          :is-hidden="isHidden(x, y, heroX, heroY, heroSight)"
        />
      </template>
    </div>
    <img class="board-hero" :src="heroImage"
      :style="`left: ${heroX * cellSize}px; top: ${heroY * cellSize}px; width: ${cellSize}px; height: ${cellSize}px;`">
  </div>
</template>

<script setup>
import Cell from './Cell.vue'
import { isHidden } from '../game/engine.js'

defineProps({
  width: {
    type: Number,
    required: true,
  },
  height: {
    type: Number,
    required: true,
  },
  field: {
    type: Array[Array[String]],
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
  }
})
</script>

<style scoped>
/* .board {
  border: solid 2px;
} */
.cell_line {
  line-height: 0;
}
.board-hero {
  position: absolute;
  pointer-events: none;
  z-index: 1;
}
</style>
