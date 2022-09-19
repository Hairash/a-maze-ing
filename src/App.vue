<script>
import Board from './components/Board.vue'
import { generateField, selectEmptyRandomCell } from './game/generator.js'
import { processKey } from './game/engine.js'
import * as consts from './game/const.js'


export default {
  name: 'App',
  components: {
    Board,
  },
  data() {
    const width = consts.BOARD.width;
    const height = consts.BOARD.height;
    const field = generateField(width, height);
    const [heroX, heroY] = selectEmptyRandomCell(field, width, height);
    console.log('Hero:', heroX, heroY);
    const heroSight = consts.INIT_SIGHT;
    const cellSize = consts.CELL_SIZE;
    const stepCtr = 0;
    // console.log(field);

    return {
      width,
      height,
      field,
      heroX,
      heroY,
      heroSight,
      cellSize,
      stepCtr,
    }
  },
  created() {
    window.addEventListener('keydown', (e) => {
      processKey(e.key, this);
    });
  }
}
</script>

<template>
  <main>
    <Board
      :cell-size=cellSize
      :width=width
      :height=height
      :field=field
      :hero-x=heroX
      :hero-y=heroY
      :hero-sight=heroSight
    />
  </main>
</template>

<style>
@import './assets/base.css';
</style>
