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

    window.addEventListener('touchstart', (e) => {
      // e.preventDefault();
      const touch = e.touches[0];
      // console.log(touch);
      const touchX = touch.screenX;
      // console.log(touchX);
      const touchY = touch.screenY;
      // console.log(touchY);

      // Get the dimensions of the screen / container
      const width = window.innerWidth;
      const height = window.innerHeight;
      // console.log(width, height);

      // Determine which part of the screen was touched
      if (touchX > width * 0.7) {
        // Right part of the screen
        processKey('ArrowRight', this);
      } else if (touchX < width * 0.3) {
        // Left part of the screen
        processKey('ArrowLeft', this);
      } else if (touchY > height * 0.7) {
        // Bottom part of the screen
        processKey('ArrowDown', this);
      } else if (touchY < height * 0.3) {
        // Top part of the screen
        processKey('ArrowUp', this);
      }
    });
  }
}
</script>


<style>
@import './assets/base.css';
</style>
