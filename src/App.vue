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
      :soul-track="soulTrack"
      :show-soul-track="mapRevealed"
    />
    <button
      v-if="mapRevealed"
      class="carry-on"
      type="button"
      @click="carryOn"
    >
      Carry on
    </button>
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
        <svg class="portal-dialog__svg" viewBox="0 0 520 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="dialogFrame" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#66d9ff" stop-opacity="0.95" />
              <stop offset="100%" stop-color="#8d79ff" stop-opacity="0.95" />
            </linearGradient>
            <linearGradient id="dialogFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#111b2f" stop-opacity="0.95" />
              <stop offset="100%" stop-color="#0b1324" stop-opacity="0.95" />
            </linearGradient>
          </defs>
          <rect x="8" y="8" width="504" height="244" rx="22" fill="url(#dialogFill)" stroke="url(#dialogFrame)" stroke-width="4" />
          <rect x="24" y="24" width="472" height="212" rx="16" fill="none" stroke="rgba(180,223,255,0.45)" stroke-dasharray="10 8" />
          <circle cx="73" cy="64" r="15" fill="#99e9ff" fill-opacity="0.22" />
          <circle cx="443" cy="80" r="12" fill="#b1a4ff" fill-opacity="0.3" />
          <circle cx="460" cy="177" r="17" fill="#72ffe0" fill-opacity="0.2" />
          <text x="260" y="98" text-anchor="middle" fill="#b8f0ff" font-size="32" font-family="Inter, sans-serif" font-weight="700">
            Portal discovered
          </text>
          <text x="260" y="140" text-anchor="middle" fill="#f4f8ff" font-size="18" font-family="Inter, sans-serif">
            Your soul remembers every step.
          </text>
          <text x="260" y="170" text-anchor="middle" fill="#c7d4ef" font-size="16" font-family="Inter, sans-serif">
            Press OK to reveal the full map.
          </text>
        </svg>
        <button type="button" class="portal-dialog__ok" @click="revealMap">OK</button>
      </div>
    </div>
  </teleport>
</template>

<script>
import Board from './components/Board.vue'
import { processKey, scrollToPoint, clampScrollToBoardBounds, initLevel } from './game/engine.js'
import * as consts from './game/const.js'
import { randomGhostImage } from './game/const.js'

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
      soulTrack: {},
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
    window.addEventListener('load', this.queueCenterOnHero)
    window.addEventListener('pageshow', this.queueCenterOnHero)
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
    window.removeEventListener('load', this.queueCenterOnHero)
    window.removeEventListener('pageshow', this.queueCenterOnHero)
  },

  watch: {
    field() {
      this.queueCenterOnHero()
    },
  },

  methods: {
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
      }, consts.CELL_HIDE_DELAY)
    },

    revealMap() {
      this.showPortalDialog = false
      this.mapRevealed = true
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
  top: 20px;
  right: 20px;
  z-index: 9000;
  padding: 10px 20px;
  border-radius: 14px;
  border: 1px solid rgba(188, 229, 255, 0.7);
  background: rgba(16, 32, 58, 0.5);
  color: #e8f5ff;
  font-weight: 600;
  backdrop-filter: blur(2px);
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

.portal-dialog__svg {
  width: min(90vw, 520px);
  height: auto;
  filter: drop-shadow(0 18px 28px rgba(0, 0, 0, 0.35));
}

.portal-dialog__ok {
  padding: 9px 28px;
  border-radius: 999px;
  border: 1px solid #84e2ff;
  color: #e8f8ff;
  background: linear-gradient(135deg, rgba(53, 125, 185, 0.95), rgba(96, 79, 209, 0.95));
  font-weight: 700;
}
</style>
