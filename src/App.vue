<template>
  <main @touchstart.prevent="handleScreenTap">
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
  },

  mounted() {
    this.centerOnHero();
    window.addEventListener('keydown', this.handleKeydown);
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeydown);
  },

  methods: {
    centerOnHero() {
      this.$nextTick(() => {
        requestAnimationFrame(() => {
          scrollToPoint(this.heroX, this.heroY, this.cellSize);
        });
      });
    },

    handleKeydown(e) {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        return;
      }

      e.preventDefault();
      processKey(e.key, this);
    },

    handleClick(key) {
      processKey(key, this);
    },

    handleScreenTap(e) {
      if (!e.touches || !e.touches.length) return;

      const touch = e.touches[0];
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const x = touch.clientX;
      const y = touch.clientY;

      const distances = [
        { key: 'ArrowLeft', value: x },
        { key: 'ArrowRight', value: viewportWidth - x },
        { key: 'ArrowUp', value: y },
        { key: 'ArrowDown', value: viewportHeight - y },
      ];

      distances.sort((a, b) => a.value - b.value);
      processKey(distances[0].key, this);
    }
  },
}
</script>


<style>
@import './assets/base.css';

main {
  touch-action: none;
}
</style>
