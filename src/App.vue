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
    <aside
      v-if="thoughtBubble.visible && thoughtBubble.text"
      class="thought-bubble"
      :class="`thought-bubble--${thoughtBubble.side}`"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ thoughtBubble.text }}
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
      thoughtBubble: {
        visible: false,
        text: '',
        side: 'right',
      },
      thoughtBubbleIntervalId: null,
      thoughtBubbleHideTimerId: null,
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
    this.startThoughtBubbleLoop()
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
    this.stopThoughtBubbleLoop()
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

    startThoughtBubbleLoop() {
      this.stopThoughtBubbleLoop()
      this.maybeShowThoughtBubble(true)
      this.thoughtBubbleIntervalId = window.setInterval(() => {
        this.maybeShowThoughtBubble()
      }, 4200)
    },

    stopThoughtBubbleLoop() {
      if (this.thoughtBubbleIntervalId !== null) {
        window.clearInterval(this.thoughtBubbleIntervalId)
        this.thoughtBubbleIntervalId = null
      }
      if (this.thoughtBubbleHideTimerId !== null) {
        window.clearTimeout(this.thoughtBubbleHideTimerId)
        this.thoughtBubbleHideTimerId = null
      }
    },

    getCellAt(x, y) {
      if (!this.field) return null
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null
      return this.field?.[x]?.[y] ?? null
    },

    countNearby(type, radius = 3) {
      let count = 0
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (dx === 0 && dy === 0) continue
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > radius) continue
          if (this.getCellAt(this.heroX + dx, this.heroY + dy) === type) {
            count++
          }
        }
      }
      return count
    },

    countOpenNeighbours() {
      const offsets = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]
      return offsets.reduce((acc, [dx, dy]) => {
        const type = this.getCellAt(this.heroX + dx, this.heroY + dy)
        return type && type !== 'wall' ? acc + 1 : acc
      }, 0)
    },

    getThoughtCandidates() {
      const candidates = []
      const currentCell = this.getCellAt(this.heroX, this.heroY)
      const currentVisits = this.soulTrack?.[`${this.heroX},${this.heroY}`] ?? 1
      const nearbyLamps = this.countNearby('lamp', Math.max(2, Math.ceil(this.heroSight)))
      const nearbyFinish = this.countNearby('finish', Math.max(2, Math.ceil(this.heroSight)))
      const nearbyWalls = this.countNearby('wall', 2)
      const openNeighbours = this.countOpenNeighbours()
      const sightDropSoon = this.stepCtr > 0 && this.stepCtr % 20 >= 17

      if (this.levelComplete) {
        return [
          'Did I win, or just delayed my regrets?',
          'Another portal. Another excuse to keep wandering.',
          'If only closure felt less temporary.',
        ]
      }

      if (this.mapRevealed) {
        return [
          'So many paths… I blamed fate too quickly.',
          'From above, my panic looks almost artistic.',
          'I called it chaos. It was mostly me.',
        ]
      }

      if (this.heroSight <= 1.5) {
        candidates.push(
          'It is so dark around… just like my confidence.',
          'One step of vision, ten steps of doubt.',
          'I mocked caution. Now darkness mocks me back.',
        )
      } else if (this.heroSight <= 3) {
        candidates.push(
          'I can see a little, panic a lot.',
          'Half-blind, fully dramatic.',
          'My pride said “rush.” My eyes said “please no.”',
        )
      }

      if (sightDropSoon) {
        candidates.push(
          'The light is thinning. Like my patience.',
          'I keep wasting moves like I have endless sight.',
          'Another few steps and shadows will own me.',
        )
      }

      if (currentCell === 'lamp') {
        candidates.push(
          'Warm light, cold conscience.',
          'A lamp! I pretend this was the plan all along.',
          'Borrowed light, borrowed bravery.',
        )
      } else if (nearbyLamps > 0) {
        candidates.push(
          'I sense a lamp nearby… hope with a power bill.',
          'There is light close. Try not to fumble it.',
          'I am one good decision away from seeing again.',
        )
      }

      if (nearbyFinish > 0) {
        candidates.push(
          'I feel the exit. Why am I suddenly afraid of success?',
          'The finish is close, and so is my self-sabotage.',
          'One last push. Or one classic detour.',
        )
      }

      if (openNeighbours <= 1) {
        candidates.push(
          'Dead end. Much like my overconfidence.',
          'Cornered by geometry and my own choices.',
          'I keep choosing the path that chooses me back.',
        )
      } else if (nearbyWalls >= 9) {
        candidates.push(
          'Too many walls, not enough wisdom.',
          'The maze and I both specialize in resistance.',
          'So many barriers. Most of them internal.',
        )
      }

      if (currentVisits >= 4) {
        candidates.push(
          'Back here again. Nostalgia is just bad navigation.',
          'I call it thoroughness. It is definitely looping.',
          'If repetition is mastery, I am a grandmaster of getting lost.',
        )
      }

      if (this.stepCtr > 0 && this.stepCtr % 12 === 0) {
        candidates.push(
          'Twelve more steps and still negotiating with my fears.',
          'I measure progress in footsteps and excuses.',
          'Every move forward drags one old flaw behind.',
        )
      }

      if (candidates.length === 0) {
        candidates.push(
          'Quiet maze. Loud thoughts.',
          'I am brave in public, hesitant in corridors.',
          'Some ghosts chase me. Most are mine.',
        )
      }

      return candidates
    },

    maybeShowThoughtBubble(force = false) {
      if (!this.field) return
      if (!force && Math.random() < 0.34) {
        this.thoughtBubble.visible = false
        return
      }

      const candidates = this.getThoughtCandidates()
      const chosen = candidates[Math.floor(Math.random() * candidates.length)]
      const side = this.heroX < this.width / 2 ? 'right' : 'left'

      this.thoughtBubble = {
        visible: true,
        text: chosen,
        side,
      }

      if (this.thoughtBubbleHideTimerId !== null) {
        window.clearTimeout(this.thoughtBubbleHideTimerId)
      }

      this.thoughtBubbleHideTimerId = window.setTimeout(() => {
        this.thoughtBubble.visible = false
      }, 3600)
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
      this.maybeShowThoughtBubble()

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
        this.maybeShowThoughtBubble(true)
      }, consts.CELL_HIDE_DELAY)
    },

    revealMap() {
      this.showPortalDialog = false
      this.mapRevealed = true
      this.maybeShowThoughtBubble(true)
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
      this.thoughtBubble.visible = false
      this.maybeShowThoughtBubble(true)
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

.thought-bubble {
  position: fixed;
  top: clamp(16px, 8vh, 68px);
  z-index: 8000;
  width: min(280px, 36vw);
  padding: 14px 18px;
  border: 2px solid rgba(0, 0, 0, 0.92);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.62);
  color: rgba(0, 0, 0, 0.94);
  font-size: 0.95rem;
  font-style: italic;
  line-height: 1.35;
  box-shadow: 0 5px 16px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(1px);
  pointer-events: none;
}

.thought-bubble::before,
.thought-bubble::after {
  content: '';
  position: absolute;
  bottom: -18px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.92);
  background: rgba(255, 255, 255, 0.62);
}

.thought-bubble::after {
  bottom: -31px;
  width: 8px;
  height: 8px;
}

.thought-bubble--right {
  right: clamp(12px, 2vw, 28px);
}

.thought-bubble--right::before {
  right: 26px;
}

.thought-bubble--right::after {
  right: 14px;
}

.thought-bubble--left {
  left: clamp(12px, 2vw, 28px);
}

.thought-bubble--left::before {
  left: 26px;
}

.thought-bubble--left::after {
  left: 14px;
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
