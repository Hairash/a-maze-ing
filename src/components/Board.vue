<template>
  <div class="board">
    <div class="cell_line" :style="`width: ${cellSize * width}px`" v-for="(line, y) in field">
      <template v-for="(cellType, x) in line">
        <Cell
          :size=cellSize
          :type=field[x][y]
          :has-hero="x === heroX && y === heroY"
          :is-hidden="isHidden(x, y, heroX, heroY, heroSight)"
          @click="processClick($event, x, y)"
        />
      </template>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
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
  }
})

const emit = defineEmits(['handleClick']);

function processClick(event, x, y) {
  console.log(x, y);
  if (x === props.heroX - 1 && y === props.heroY) {
    emit('handleClick', 'ArrowLeft');
  }
  else if (x === props.heroX + 1 && y === props.heroY) {
    emit('handleClick', 'ArrowRight');
  }
  else if (x === props.heroX && y === props.heroY - 1) {
    emit('handleClick', 'ArrowUp');
  }
  else if (x === props.heroX && y === props.heroY + 1) {
    emit('handleClick', 'ArrowDown');
  }
}
</script>

<style scoped>
/* .board {
  border: solid 2px;
} */
.cell_line {
  line-height: 0;
}
</style>
