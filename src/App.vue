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
  <teleport to="body">
    <div v-if="showMovePad" class="move-pad" :style="movePadStyle" aria-label="Movement controls">
      <button
        type="button"
        class="move-pad__button move-pad__button--up"
        aria-label="Move up"
        @pointerdown.prevent.stop="moveHero('ArrowUp')"
      >
        <span class="move-pad__arrow move-pad__arrow--up"></span>
      </button>
      <button
        type="button"
        class="move-pad__button move-pad__button--left"
        aria-label="Move left"
        @pointerdown.prevent.stop="moveHero('ArrowLeft')"
      >
        <span class="move-pad__arrow move-pad__arrow--left"></span>
      </button>
      <button
        type="button"
        class="move-pad__button move-pad__button--right"
        aria-label="Move right"
        @pointerdown.prevent.stop="moveHero('ArrowRight')"
      >
        <span class="move-pad__arrow move-pad__arrow--right"></span>
      </button>
      <button
        type="button"
        class="move-pad__button move-pad__button--down"
        aria-label="Move down"
        @pointerdown.prevent.stop="moveHero('ArrowDown')"
      >
        <span class="move-pad__arrow move-pad__arrow--down"></span>
      </button>
    </div>
  </teleport>
</template>


<script>
import Board from './components/Board.vue'
import { processKey, scrollToPoint, clampScrollToBoardBounds, initLevel } from './game/engine.js'
import * as consts from './game/const.js'

const STORAGE_KEY = 'a-maze-ing:game-state';
const MAX_VISIBLE_CELLS = 11;

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
      centerOnHeroTimerIds: [],
      scrollClampFrameId: null,
      movePadStyle: {
        left: '0px',
        top: '0px',
      },
      movePadFrameId: null,
      showMovePad: false,
    }
  },
  created() {
    this.updateCellSize();
    this.initializeGameState();
  },

  mounted() {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    this.queueCenterOnHero();
    this.updateMovePadVisibility();
    this.updateMovePadPosition();
    window.addEventListener('keydown', this.handleKeydown);
    document.body.addEventListener('scroll', this.handleWindowScroll, { passive: true });
    document.body.addEventListener('scroll', this.scheduleMovePadPositionUpdate, { passive: true });
    window.addEventListener('resize', this.handleWindowScroll);
    window.addEventListener('resize', this.updateCellSize);
    window.addEventListener('resize', this.updateMovePadVisibility);
    window.addEventListener('resize', this.scheduleMovePadPositionUpdate);
    window.addEventListener('load', this.queueCenterOnHero);
    window.addEventListener('pageshow', this.queueCenterOnHero);
  },

  beforeUnmount() {
    this.clearCenterOnHeroTimers();
    this.cancelScrollClampFrame();
    this.cancelMovePadPositionUpdate();
    window.removeEventListener('keydown', this.handleKeydown);
    document.body.removeEventListener('scroll', this.handleWindowScroll);
    document.body.removeEventListener('scroll', this.scheduleMovePadPositionUpdate);
    window.removeEventListener('resize', this.handleWindowScroll);
    window.removeEventListener('resize', this.updateCellSize);
    window.removeEventListener('resize', this.updateMovePadVisibility);
    window.removeEventListener('resize', this.scheduleMovePadPositionUpdate);
    window.removeEventListener('load', this.queueCenterOnHero);
    window.removeEventListener('pageshow', this.queueCenterOnHero);
  },

  watch: {
    field: {
      handler() {
        this.queueCenterOnHero();
        this.persistGameState();
      },
      deep: true,
    },
    heroX() { this.persistGameState(); },
    heroY() { this.persistGameState(); },
    heroSight() { this.persistGameState(); },
    stepCtr() { this.persistGameState(); },
  },

  methods: {
    initializeGameState() {
      if (this.restoreGameState()) return;
      initLevel(this);
    },

    getCellSizeByViewport() {
      if (typeof window === 'undefined') return consts.CELL_SIZE;
      const viewportWidth = document.documentElement.clientWidth;
      if (viewportWidth >= consts.CELL_SIZE * MAX_VISIBLE_CELLS) return consts.CELL_SIZE;
      return Math.max(1, Math.floor(viewportWidth / MAX_VISIBLE_CELLS));
    },

    updateCellSize() {
      const nextCellSize = this.getCellSizeByViewport();
      if (this.cellSize === nextCellSize) return;
      this.cellSize = nextCellSize;
      this.queueCenterOnHero();
    },

    isValidStoredState(state) {
      if (!state || typeof state !== 'object') return false;
      if (!Array.isArray(state.field) || !state.field.length) return false;
      if (state.width !== this.width || state.height !== this.height) return false;
      if (typeof state.heroX !== 'number' || typeof state.heroY !== 'number') return false;
      if (typeof state.heroSight !== 'number' || typeof state.stepCtr !== 'number') return false;
      if (state.heroX < 0 || state.heroX >= this.width || state.heroY < 0 || state.heroY >= this.height) return false;
      return true;
    },

    restoreGameState() {
      try {
        const rawState = localStorage.getItem(STORAGE_KEY);
        if (!rawState) return false;
        const state = JSON.parse(rawState);
        if (!this.isValidStoredState(state)) return false;

        this.field = state.field;
        this.heroX = state.heroX;
        this.heroY = state.heroY;
        this.heroSight = state.heroSight;
        this.stepCtr = state.stepCtr;
        return true;
      } catch (error) {
        console.warn('Cannot restore game state', error);
        return false;
      }
    },

    persistGameState() {
      if (!this.field) return;
      try {
        const state = {
          width: this.width,
          height: this.height,
          field: this.field,
          heroX: this.heroX,
          heroY: this.heroY,
          heroSight: this.heroSight,
          stepCtr: this.stepCtr,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.warn('Cannot save game state', error);
      }
    },

    centerOnHero() {
      this.$nextTick(() => {
        setTimeout(() => {
          scrollToPoint(this.heroX, this.heroY, this.cellSize);
        }, 0);
      });
    },

    clearCenterOnHeroTimers() {
      this.centerOnHeroTimerIds.forEach((timerId) => window.clearTimeout(timerId));
      this.centerOnHeroTimerIds = [];
    },

    cancelScrollClampFrame() {
      if (this.scrollClampFrameId === null) return;
      window.cancelAnimationFrame(this.scrollClampFrameId);
      this.scrollClampFrameId = null;
    },

    clampScrollPosition() {
      clampScrollToBoardBounds();
    },

    handleWindowScroll() {
      if (this.scrollClampFrameId !== null) return;

      this.scrollClampFrameId = window.requestAnimationFrame(() => {
        this.scrollClampFrameId = null;
        this.clampScrollPosition();
      });
    },

    queueCenterOnHero() {
      if (!this.field) return;

      this.clearCenterOnHeroTimers();

      [0, 100, 250, 500, 1000].forEach((delay) => {
        const timerId = window.setTimeout(() => {
          this.centerOnHero();
        }, delay);

        this.centerOnHeroTimerIds.push(timerId);
      });
    },

    cancelMovePadPositionUpdate() {
      if (this.movePadFrameId === null) return;
      window.cancelAnimationFrame(this.movePadFrameId);
      this.movePadFrameId = null;
    },

    scheduleMovePadPositionUpdate() {
      if (!this.showMovePad) return;
      if (this.movePadFrameId !== null) return;

      this.movePadFrameId = window.requestAnimationFrame(() => {
        this.movePadFrameId = null;
        this.updateMovePadPosition();
      });
    },

    updateMovePadPosition() {
      if (!this.showMovePad) return;

      const padSize = 56 * 3 + 8 * 2;
      const insetRight = 20;
      const insetBottom = 20;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const scrollLeft = document.body.scrollLeft;
      const scrollTop = document.body.scrollTop;
      const left = scrollLeft + viewportWidth - padSize - insetRight;
      const top = scrollTop + viewportHeight - padSize - insetBottom;

      this.movePadStyle = {
        left: `${Math.max(0, left)}px`,
        top: `${Math.max(0, top)}px`,
      };
    },

    updateMovePadVisibility() {
      this.showMovePad = (
        window.matchMedia('(pointer: coarse)').matches
        || navigator.maxTouchPoints > 0
        || 'ontouchstart' in window
      );
    },

    handleKeydown(e) {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        return;
      }

      e.preventDefault();
      this.moveHero(e.key);
    },

    moveHero(key) {
      processKey(key, this);
    }
  },
}
</script>


<style>
@import './assets/base.css';

main {
  touch-action: none;
  overscroll-behavior: none;
}

.move-pad {
  position: absolute;
  z-index: 9999;
  display: grid;
  grid-template-columns: repeat(3, 56px);
  grid-template-rows: repeat(3, 56px);
  gap: 8px;
  pointer-events: none;
}

.move-pad__button {
  pointer-events: auto;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 18px;
  background: rgba(18, 25, 40, 0.18);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1);
  transition: transform 0.12s ease, background-color 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
}

.move-pad__button:active {
  transform: scale(0.95);
  background: rgba(28, 40, 64, 0.3);
  border-color: rgba(255, 255, 255, 0.28);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.move-pad__button--up {
  grid-column: 2;
  grid-row: 1;
}

.move-pad__button--left {
  grid-column: 1;
  grid-row: 2;
}

.move-pad__button--right {
  grid-column: 3;
  grid-row: 2;
}

.move-pad__button--down {
  grid-column: 2;
  grid-row: 3;
}

.move-pad__arrow {
  display: block;
  width: 16px;
  height: 16px;
  margin: 0 auto;
  border-top: 3px solid rgba(255, 255, 255, 0.7);
  border-right: 3px solid rgba(255, 255, 255, 0.7);
}

.move-pad__arrow--up {
  transform: rotate(-45deg);
}

.move-pad__arrow--right {
  transform: rotate(45deg);
}

.move-pad__arrow--down {
  transform: rotate(135deg);
}

.move-pad__arrow--left {
  transform: rotate(-135deg);
}
</style>
