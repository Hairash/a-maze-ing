<template>
  <main :class="{ 'main--revealed': mapRevealed }">
    <Board
      :cell-size="cellSize"
      :width="width"
      :height="height"
      :field="field"
      :hero-x="heroX"
      :hero-y="heroY"
      :hero-sight="heroSight"
      :hero-image="heroImage"
      :reveal-map="mapRevealed"
      :soul-path="soulPath"
      :show-soul-track="mapRevealed"
    />
    <button
      v-if="mapRevealed"
      class="brick-btn carry-on"
      :class="{ 'carry-on--blink': carryOnBlink }"
      type="button"
      @click="carryOn"
    >
      Carry on
    </button>
    <aside
      v-for="bubble in thoughtBubbles"
      :key="bubble.id"
      class="thought-bubble"
      :class="`thought-bubble--${bubble.slot}`"
      aria-live="polite"
      aria-atomic="true"
    >
      <span class="thought-bubble__text">{{ bubble.text }}</span>
    </aside>
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

    <div v-if="showPortalDialog" class="portal-dialog-backdrop">
      <div class="portal-dialog" role="dialog" aria-modal="true" aria-label="Level complete">
        <div class="portal-dialog__plate">
          <h2 class="portal-dialog__title">Portal discovered</h2>
          <p class="portal-dialog__body">Your soul remembers every step.</p>
          <p class="portal-dialog__hint">Press OK to reveal the full map.</p>
          <button type="button" class="brick-btn portal-dialog__ok" @click="revealMap">OK</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script>
import Board from './components/Board.vue'
import { processKey, scrollToPoint, clampScrollToBoardBounds, initLevel } from './game/engine.js'
import * as consts from './game/const.js'
import { randomGhostImage } from './game/const.js'
import {
  initialThoughtBubbleState,
  startThoughtBubbleLoop,
  stopThoughtBubbleLoop,
  resetThoughtState,
  onMove as onThoughtMove,
  onLevelComplete as onThoughtLevelComplete,
  onMapRevealed as onThoughtMapRevealed,
} from './game/thoughtBubble.js'

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
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 768,
      stepCtr: 0,
      soulTrack: {},
      soulPath: [],
      centerOnHeroTimerIds: [],
      scrollClampFrameId: null,
      movePadStyle: {
        left: '0px',
        top: '0px',
      },
      movePadFrameId: null,
      showMovePad: false,
      heroImage: randomGhostImage(),
      showPortalDialog: false,
      mapRevealed: false,
      levelComplete: false,
      carryOnBlink: false,
      carryOnBlinkTimerId: null,
      ...initialThoughtBubbleState(),
    }
  },
  created() {
    initLevel(this)
  },

  mounted() {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    this.queueCenterOnHero()
    this.updateMovePadVisibility()
    this.updateMovePadPosition()
    window.addEventListener('keydown', this.handleKeydown)
    document.body.addEventListener('scroll', this.handleWindowScroll, { passive: true })
    document.body.addEventListener('scroll', this.scheduleMovePadPositionUpdate, { passive: true })
    window.addEventListener('resize', this.handleWindowScroll)
    window.addEventListener('resize', this.updateMovePadVisibility)
    window.addEventListener('resize', this.scheduleMovePadPositionUpdate)
    window.addEventListener('resize', this.updateViewportSize)
    window.addEventListener('orientationchange', this.updateViewportSize)
    window.addEventListener('load', this.queueCenterOnHero)
    window.addEventListener('pageshow', this.queueCenterOnHero)
    this.updateViewportSize()
    startThoughtBubbleLoop(this)
  },

  beforeUnmount() {
    this.clearCenterOnHeroTimers()
    this.cancelScrollClampFrame()
    this.cancelMovePadPositionUpdate()
    window.removeEventListener('keydown', this.handleKeydown)
    document.body.removeEventListener('scroll', this.handleWindowScroll)
    document.body.removeEventListener('scroll', this.scheduleMovePadPositionUpdate)
    window.removeEventListener('resize', this.handleWindowScroll)
    window.removeEventListener('resize', this.updateMovePadVisibility)
    window.removeEventListener('resize', this.scheduleMovePadPositionUpdate)
    window.removeEventListener('resize', this.updateViewportSize)
    window.removeEventListener('orientationchange', this.updateViewportSize)
    window.removeEventListener('load', this.queueCenterOnHero)
    window.removeEventListener('pageshow', this.queueCenterOnHero)
    stopThoughtBubbleLoop(this)
    this.clearCarryOnBlinkTimer()
    document.body.removeEventListener('scroll', this.resetCarryOnBlinkTimer)
    window.removeEventListener('pointerdown', this.resetCarryOnBlinkTimer)
  },

  computed: {
    cellSize() {
      // Make the sight square fit the shorter viewport axis exactly.
      // Cells use box-sizing: border-box, so total = cellSize * count.
      // Sight diameter = 2 * floor(INIT_SIGHT) + 1 cells.
      const sightDiameter = 2 * Math.floor(consts.INIT_SIGHT) + 1
      const shorter = Math.min(this.viewportWidth, this.viewportHeight)
      return Math.max(16, Math.min(consts.CELL_SIZE, Math.floor(shorter / sightDiameter)))
    },
  },

  watch: {
    field() {
      this.queueCenterOnHero()
    },
    cellSize() {
      if (!this.mapRevealed) this.queueCenterOnHero()
    },
    mapRevealed(val) {
      if (val) {
        this.resetCarryOnBlinkTimer()
        document.body.addEventListener('scroll', this.resetCarryOnBlinkTimer, { passive: true })
        window.addEventListener('pointerdown', this.resetCarryOnBlinkTimer)
      } else {
        this.clearCarryOnBlinkTimer()
        document.body.removeEventListener('scroll', this.resetCarryOnBlinkTimer)
        window.removeEventListener('pointerdown', this.resetCarryOnBlinkTimer)
      }
    },
  },

  methods: {
    resetCarryOnBlinkTimer() {
      this.carryOnBlink = false
      if (this.carryOnBlinkTimerId !== null) {
        window.clearTimeout(this.carryOnBlinkTimerId)
      }
      this.carryOnBlinkTimerId = window.setTimeout(() => {
        this.carryOnBlink = true
      }, 5000)
    },

    clearCarryOnBlinkTimer() {
      this.carryOnBlink = false
      if (this.carryOnBlinkTimerId !== null) {
        window.clearTimeout(this.carryOnBlinkTimerId)
        this.carryOnBlinkTimerId = null
      }
    },

    updateViewportSize() {
      this.viewportWidth = window.innerWidth
      this.viewportHeight = window.innerHeight
    },

    centerOnHero() {
      if (this.mapRevealed) return

      this.$nextTick(() => {
        setTimeout(() => {
          scrollToPoint(this.heroX, this.heroY, this.cellSize)
        }, 0)
      })
    },

    clearCenterOnHeroTimers() {
      this.centerOnHeroTimerIds.forEach((timerId) => window.clearTimeout(timerId))
      this.centerOnHeroTimerIds = []
    },

    cancelScrollClampFrame() {
      if (this.scrollClampFrameId === null) return
      window.cancelAnimationFrame(this.scrollClampFrameId)
      this.scrollClampFrameId = null
    },

    clampScrollPosition() {
      clampScrollToBoardBounds()
    },

    handleWindowScroll() {
      if (this.scrollClampFrameId !== null) return

      this.scrollClampFrameId = window.requestAnimationFrame(() => {
        this.scrollClampFrameId = null
        this.clampScrollPosition()
      })
    },

    queueCenterOnHero() {
      if (!this.field) return
      if (this.mapRevealed) return

      this.clearCenterOnHeroTimers()

      ;[0, 100, 250, 500, 1000].forEach((delay) => {
        const timerId = window.setTimeout(() => {
          this.centerOnHero()
        }, delay)

        this.centerOnHeroTimerIds.push(timerId)
      })
    },

    cancelMovePadPositionUpdate() {
      if (this.movePadFrameId === null) return
      window.cancelAnimationFrame(this.movePadFrameId)
      this.movePadFrameId = null
    },

    scheduleMovePadPositionUpdate() {
      if (!this.showMovePad) return
      if (this.movePadFrameId !== null) return

      this.movePadFrameId = window.requestAnimationFrame(() => {
        this.movePadFrameId = null
        this.updateMovePadPosition()
      })
    },

    updateMovePadPosition() {
      if (!this.showMovePad) return

      const padSize = 56 * 3 + 8 * 2
      const insetRight = 20
      const insetBottom = 20
      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = document.documentElement.clientHeight
      const scrollLeft = document.body.scrollLeft
      const scrollTop = document.body.scrollTop
      const left = scrollLeft + viewportWidth - padSize - insetRight
      const top = scrollTop + viewportHeight - padSize - insetBottom

      this.movePadStyle = {
        left: `${Math.max(0, left)}px`,
        top: `${Math.max(0, top)}px`,
      }
    },

    updateMovePadVisibility() {
      if (this.levelComplete) {
        this.showMovePad = false
        return
      }

      this.showMovePad = (
        window.matchMedia('(pointer: coarse)').matches
        || navigator.maxTouchPoints > 0
        || 'ontouchstart' in window
      )
    },

    handleKeydown(e) {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        return
      }

      e.preventDefault()
      this.moveHero(e.key)
    },

    moveHero(key) {
      if (this.levelComplete) return

      const result = processKey(key, this)
      this.heroImage = randomGhostImage()
      onThoughtMove(this)

      if (result.reachedFinish) {
        this.finishLevel()
      }
    },

    finishLevel() {
      this.levelComplete = true
      this.showMovePad = false
      this.heroSight = -1
      setTimeout(() => {
        this.showPortalDialog = true
        onThoughtLevelComplete(this)
      }, consts.CELL_HIDE_DELAY)
    },

    revealMap() {
      this.showPortalDialog = false
      this.mapRevealed = true
      onThoughtMapRevealed(this)
      this.$nextTick(() => {
        this.clampScrollPosition()
      })
    },

    carryOn() {
      this.showPortalDialog = false
      this.mapRevealed = false
      this.levelComplete = false
      initLevel(this, true)
      this.heroImage = randomGhostImage()
      this.updateMovePadVisibility()
      this.queueCenterOnHero()
      resetThoughtState(this)
    },
  },
}
</script>

<style>
@import './assets/base.css';

main {
  touch-action: none;
  overscroll-behavior: none;
}

.main--revealed {
  touch-action: auto;
}

.carry-on {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9000;
  opacity: 0.5;
  transition: opacity 0.3s;
}

.carry-on:hover {
  opacity: 1;
}

.carry-on--blink {
  animation: carry-on-blink 1.2s ease-in-out infinite;
}

@keyframes carry-on-blink {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.thought-bubble {
  position: fixed;
  z-index: 8000;
  width: min(280px, 36vw);
  background: url('/images/thought.png') no-repeat center / 100% 100%;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1085 / 768;
}

.thought-bubble__text {
  display: block;
  padding: 18% 16% 28% 16%;
  color: rgba(0, 0, 0, 0.9);
  font-size: 0.85rem;
  font-style: italic;
  line-height: 1.35;
  text-align: center;
}

/* Vertical anchoring */
.thought-bubble--top-right,
.thought-bubble--top-left {
  top: clamp(8px, 4vh, 40px);
}

.thought-bubble--bottom-right,
.thought-bubble--bottom-left {
  bottom: clamp(8px, 4vh, 40px);
}

/* Horizontal anchoring */
.thought-bubble--top-right,
.thought-bubble--bottom-right {
  right: clamp(12px, 2vw, 28px);
}

.thought-bubble--top-left,
.thought-bubble--bottom-left {
  left: clamp(12px, 2vw, 28px);
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

.portal-dialog-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 99999;
  background: rgba(3, 8, 18, 0.45);
}

.portal-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.portal-dialog__plate {
  width: min(90vw, 520px);
  background: url('/images/plate.png') no-repeat center / 100% 100%;
  aspect-ratio: 1317 / 687;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12% 14%;
}

.portal-dialog__title {
  color: #111;
  font-size: clamp(1.1rem, 4vw, 1.8rem);
  font-weight: 700;
  margin: 0 0 0.4em;
}

.portal-dialog__body {
  color: #333;
  font-size: clamp(0.8rem, 2.5vw, 1rem);
  margin: 0 0 0.3em;
}

.portal-dialog__hint {
  color: #555;
  font-size: clamp(0.7rem, 2vw, 0.9rem);
  margin: 0;
}

.brick-btn {
  border: none;
  background: url('/images/brick_btn.png') no-repeat center / 100% 100%;
  color: #fff;
  font-weight: 700;
  font-size: clamp(0.85rem, 2.5vw, 1.1rem);
  padding: 14px 36px;
  cursor: pointer;
  min-width: 120px;
}

.portal-dialog__ok {
  margin-top: 0.6em;
}
</style>
