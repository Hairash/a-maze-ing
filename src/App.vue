<template>
  <main :class="{ 'main--revealed': mapRevealed }">
    <Board
      ref="board"
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
      :edge-hide-sequence-active="edgeHideSequenceActive"
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
      :style="bubbleStylesById[bubble.id]"
      aria-live="polite"
      aria-atomic="true"
      @pointerdown.prevent.stop="dismissThoughtBubble(bubble.id)"
    >
      <span class="thought-bubble__text">{{ bubble.text }}</span>
    </aside>
  </main>
  <teleport to="body">
    <div v-if="showPortalDialog" class="portal-dialog-backdrop">
      <div class="portal-dialog" role="dialog" aria-modal="true" aria-label="Level complete">
        <div class="portal-dialog__plate">
          <h2 class="portal-dialog__title">Portal discovered</h2>
          <p class="portal-dialog__body">Your soul remembers every step.</p>
          <p class="portal-dialog__hint">Press OK to reveal the full map.</p>
          <button type="button" class="brick-btn portal-dialog__ok" @click="confirmRevealMap">OK</button>
        </div>
      </div>
    </div>

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
import { randomGhostImage } from './game/const.js'
import {
  initialThoughtBubbleState,
  startThoughtBubbleLoop,
  stopThoughtBubbleLoop,
  resetThoughtState,
  hideBubble as hideThoughtBubble,
  hideOldestBubble as hideOldestThoughtBubble,
  onMove as onThoughtMove,
  onLevelComplete as onThoughtLevelComplete,
  onMapRevealed as onThoughtMapRevealed,
  debugFillAllSlots,
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
      mapRevealed: false,
      showPortalDialog: false,
      levelComplete: false,
      edgeHideSequenceActive: false,
      edgeHideSequenceTimerId: null,
      carryOnBlink: false,
      carryOnBlinkTimerId: null,
      bubblePlacementById: {},
      ...initialThoughtBubbleState(),
    }
  },
  created() {
    initLevel(this)
    if (this.isHeroOnPortalCell()) {
      this.finishLevel(true)
    }
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
    if (consts.DEBUG_ALL_THOUGHT_BUBBLES) {
      debugFillAllSlots(this)
    }
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
    this.clearEdgeHideSequenceTimer()
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
    bubbleStylesById() {
      const placements = {}
      for (const bubble of this.thoughtBubbles) {
        const placement = this.bubblePlacementById[bubble.id]
        const size = placement?.size ?? this.computeBubbleSize(bubble.text)
        const rect = placement?.rect ?? { left: 8, top: 8 }
        placements[bubble.id] = {
          width: `${Math.round(size.width)}px`,
          height: `${Math.round(size.height)}px`,
          left: `${Math.round(rect.left)}px`,
          top: `${Math.round(rect.top)}px`,
          '--bubble-flip-x': placement?.flipX ? -1 : 1,
          '--bubble-flip-y': placement?.flipY ? -1 : 1,
          '--bubble-text-top': placement?.flipY ? '25px' : '-25px',
        }
      }
      return placements
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
    thoughtBubbles: {
      handler() {
        this.reconcileBubblePlacements()
      },
      deep: true,
      immediate: true,
    },
  },

  methods: {
    isHeroOnPortalCell() {
      return this.field?.[this.heroX]?.[this.heroY] === 'finish'
    },

    clearEdgeHideSequenceTimer() {
      if (this.edgeHideSequenceTimerId === null) return
      window.clearTimeout(this.edgeHideSequenceTimerId)
      this.edgeHideSequenceTimerId = null
    },

    getBoardElement() {
      return this.$refs.board?.$el ?? null
    },

    getHeroViewportRect() {
      const board = this.getBoardElement()
      if (!board) return null
      const boardRect = board.getBoundingClientRect()
      const size = this.cellSize
      return {
        left: boardRect.left + this.heroX * size,
        top: boardRect.top + this.heroY * size,
        right: boardRect.left + (this.heroX + 1) * size,
        bottom: boardRect.top + (this.heroY + 1) * size,
      }
    },

    computeBubbleSize(text) {
      const vw = this.viewportWidth
      const baseMaxWidth = Math.min(340, Math.max(220, vw * 0.35))
      const baseMinWidth = Math.min(220, Math.max(170, vw * 0.24))
      const len = (text ?? '').length
      const width = Math.max(baseMinWidth, Math.min(baseMaxWidth, 170 + len * 2.2))
      const height = width / (1085 / 768)
      return { width, height }
    },

    // Viewport zone of the hero: 'left'/'center'/'right' × 'top'/'center'/'bottom'.
    // Hero is considered centered if it's within one cell of the viewport
    // midline. We compute this from scroll math rather than the live DOM —
    // `getBoundingClientRect` may not yet reflect a just-scheduled
    // `scrollToPoint`, which would otherwise leave us reading the
    // pre-centred board position and misclassifying the zone.
    getHeroViewportZone() {
      const cellSize = this.cellSize
      const vw = this.viewportWidth
      const vh = this.viewportHeight
      const heroCellCx = (this.heroX + 0.5) * cellSize
      const heroCellCy = (this.heroY + 0.5) * cellSize
      const boardWidth = this.width * cellSize
      const boardHeight = this.height * cellSize
      const maxScrollX = Math.max(0, boardWidth - vw)
      const maxScrollY = Math.max(0, boardHeight - vh)
      const scrollX = Math.max(0, Math.min(heroCellCx - vw / 2, maxScrollX))
      const scrollY = Math.max(0, Math.min(heroCellCy - vh / 2, maxScrollY))
      const heroVx = heroCellCx - scrollX
      const heroVy = heroCellCy - scrollY
      const midX = vw / 2
      const midY = vh / 2
      const tolerance = cellSize
      return {
        h: heroVx < midX - tolerance ? 'left' : heroVx > midX + tolerance ? 'right' : 'center',
        v: heroVy < midY - tolerance ? 'top' : heroVy > midY + tolerance ? 'bottom' : 'center',
      }
    },

    isMobileViewport() {
      return this.viewportWidth <= 768
    },

    // Ordered list of 4 slot descriptors { corner, offset } for the current zone.
    // `offset` = 0 means at the corner; `offset` = 1 means stacked one bubble
    // inward (below a top corner, above a bottom corner).
    getLayoutSlots() {
      const zone = this.getHeroViewportZone()
      if (this.isMobileViewport()) {
        // Hero near the bottom — all four go on top (two stacks).
        if (zone.v === 'bottom') {
          return [
            { corner: 'top-right', offset: 0 },
            { corner: 'top-left', offset: 0 },
            { corner: 'top-right', offset: 1 },
            { corner: 'top-left', offset: 1 },
          ]
        }
        // Hero near the top — two at bottom-left, plus two elsewhere.
        if (zone.v === 'top') {
          const base = [
            { corner: 'bottom-left', offset: 0 },
            { corner: 'bottom-left', offset: 1 },
          ]
          if (zone.h === 'left') {
            return [
              ...base,
              { corner: 'top-right', offset: 0 },
              { corner: 'top-right', offset: 1 },
            ]
          }
          if (zone.h === 'right') {
            return [
              ...base,
              { corner: 'top-left', offset: 0 },
              { corner: 'top-left', offset: 1 },
            ]
          }
          return [
            ...base,
            { corner: 'top-right', offset: 0 },
            { corner: 'top-left', offset: 0 },
          ]
        }
        // Hero vertically centered — default mobile layout.
        return [
          { corner: 'top-right', offset: 0 },
          { corner: 'top-left', offset: 0 },
          { corner: 'bottom-left', offset: 0 },
          { corner: 'bottom-left', offset: 1 },
        ]
      }

      // Desktop. Hero left of center → all four on the right. Mirror for right.
      if (zone.h === 'left') {
        return [
          { corner: 'top-right', offset: 0 },
          { corner: 'bottom-right', offset: 0 },
          { corner: 'top-right', offset: 1 },
          { corner: 'bottom-right', offset: 1 },
        ]
      }
      if (zone.h === 'right') {
        return [
          { corner: 'top-left', offset: 0 },
          { corner: 'bottom-left', offset: 0 },
          { corner: 'top-left', offset: 1 },
          { corner: 'bottom-left', offset: 1 },
        ]
      }
      // Hero centered horizontally — one per corner.
      return [
        { corner: 'top-right', offset: 0 },
        { corner: 'top-left', offset: 0 },
        { corner: 'bottom-right', offset: 0 },
        { corner: 'bottom-left', offset: 0 },
      ]
    },

    slotToRect(slot, size) {
      const margin = 8
      const stackGap = 16
      const maxX = Math.max(margin, this.viewportWidth - size.width - margin)
      const maxY = Math.max(margin, this.viewportHeight - size.height - margin)
      const inward = slot.offset * (size.height + stackGap)
      let left = margin
      let top = margin
      if (slot.corner === 'top-right') {
        left = maxX
        top = Math.min(maxY, margin + inward)
      } else if (slot.corner === 'top-left') {
        left = margin
        top = Math.min(maxY, margin + inward)
      } else if (slot.corner === 'bottom-right') {
        left = maxX
        top = Math.max(margin, maxY - inward)
      } else {
        left = margin
        top = Math.max(margin, maxY - inward)
      }
      return {
        left,
        top,
        right: left + size.width,
        bottom: top + size.height,
      }
    },

    reconcileBubblePlacements() {
      const activeIds = new Set(this.thoughtBubbles.map((bubble) => bubble.id))

      // Drop placements for bubbles that are gone; keep the rest untouched —
      // once a bubble has a spot, it never moves.
      const nextPlacements = {}
      for (const [id, placement] of Object.entries(this.bubblePlacementById)) {
        const numericId = Number(id)
        if (activeIds.has(numericId)) nextPlacements[numericId] = placement
      }

      // Track which (corner, offset) pairs are already taken by cached bubbles.
      const occupiedKeys = new Set()
      for (const placement of Object.values(nextPlacements)) {
        occupiedKeys.add(`${placement.corner}:${placement.offset}`)
      }

      const slots = this.getLayoutSlots()
      const flipByCorner = {
        'top-right': { flipX: false, flipY: false },
        'top-left': { flipX: true, flipY: false },
        'bottom-right': { flipX: false, flipY: true },
        'bottom-left': { flipX: true, flipY: true },
      }

      for (const bubble of this.thoughtBubbles) {
        if (nextPlacements[bubble.id]) continue // already placed — leave it
        const slot = slots.find((s) => !occupiedKeys.has(`${s.corner}:${s.offset}`))
        if (!slot) continue
        occupiedKeys.add(`${slot.corner}:${slot.offset}`)
        const size = this.computeBubbleSize(bubble.text)
        const rect = this.slotToRect(slot, size)
        const flip = flipByCorner[slot.corner] ?? flipByCorner['top-right']
        nextPlacements[bubble.id] = {
          rect,
          corner: slot.corner,
          offset: slot.offset,
          flipX: flip.flipX,
          flipY: flip.flipY,
          size,
        }
      }

      this.bubblePlacementById = nextPlacements
    },

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
      this.reconcileBubblePlacements()
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
      if (e.key.toLowerCase() === 'x') {
        const hidden = hideOldestThoughtBubble(this)
        if (hidden) e.preventDefault()
        return
      }

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

    finishLevel(isLoad = false) {
      this.levelComplete = true
      this.showMovePad = false
      this.edgeHideSequenceActive = true
      onThoughtLevelComplete(this)
      this.clearEdgeHideSequenceTimer()

      const edgeLayers = Math.floor(Math.min(this.width, this.height) / 2)
      const perLayerDelayMs = 24
      const fadeDurationMs = 500
      const sequenceDurationMs = edgeLayers * perLayerDelayMs + fadeDurationMs

      this.edgeHideSequenceTimerId = window.setTimeout(() => {
        this.edgeHideSequenceActive = false
        this.edgeHideSequenceTimerId = null
        this.showPortalDialog = true
      }, isLoad ? Math.max(200, sequenceDurationMs * 0.5) : sequenceDurationMs)
    },

    confirmRevealMap() {
      this.showPortalDialog = false
      this.revealMap()
    },

    revealMap() {
      this.mapRevealed = true
      onThoughtMapRevealed(this)
      this.$nextTick(() => {
        this.clampScrollPosition()
      })
    },

    carryOn() {
      this.clearEdgeHideSequenceTimer()
      this.edgeHideSequenceActive = false
      this.showPortalDialog = false
      this.mapRevealed = false
      this.levelComplete = false
      initLevel(this, true)
      this.heroImage = randomGhostImage()
      this.updateMovePadVisibility()
      this.queueCenterOnHero()
      resetThoughtState(this)
    },

    dismissThoughtBubble(id) {
      hideThoughtBubble(this, id)
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
  --bubble-flip-x: 1;
  --bubble-flip-y: 1;
  --bubble-text-top: -25px;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.thought-bubble::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url('/images/thought.png') no-repeat center / 100% 100%;
  transform: scaleX(var(--bubble-flip-x)) scaleY(var(--bubble-flip-y));
  transform-origin: center;
  z-index: 0;
}

.thought-bubble__text {
  position: relative;
  top: var(--bubble-text-top);
  z-index: 1;
  display: block;
  width: 100%;
  padding: 0 41px;
  box-sizing: border-box;
  color: rgba(0, 0, 0, 0.9);
  font-size: clamp(0.76rem, 1.6vw, 0.92rem);
  font-style: italic;
  line-height: 1.3;
  text-align: center;
  overflow-wrap: anywhere;
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
}

.portal-dialog__plate {
  width: min(90vw, 520px);
  background: url('/images/plate.png') no-repeat center / 100% 100%;
  aspect-ratio: 1317 / 687;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10% 14%;
  text-align: center;
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
  margin: 0 0 0.8em;
}

</style>
