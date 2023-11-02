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
      @handleClick="handleClick"
    />
  </main>
</template>


<script>
import Board from './components/Board.vue'
import { processKey, scrollToPoint, initLevel } from './game/engine.js'
import * as consts from './game/const.js'

export default {
  name: 'App',
  components: {
    Board,
  },
  data() {
    return {
      width: consts.BOARD.width,
      height: consts.BOARD.height,
      field: null,
      heroX: 0,
      heroY: 0,
      heroSight: -1,
      cellSize: consts.CELL_SIZE,
      stepCtr: 0,
    }
  },
  created() {
    initLevel(this);

    window.addEventListener('load', (e) => {
      // TODO: Forbid manual scroll and hide scrollers
      scrollToPoint(this.heroX, this.heroY, this.cellSize);
    });

    window.addEventListener('keydown', (e) => {
      // TODO: Prevent only arrow keys actions
      e.preventDefault();
      processKey(e.key, this);
    });
  },

  methods: {
    handleClick(key) {
      processKey(key, this);
    }
  },
}
</script>


<style>
@import './assets/base.css';
</style>
