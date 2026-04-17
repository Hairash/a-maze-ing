<template>
  <main :class="{ 'main--revealed': game.mapRevealed }">
    <Board
      :cell-size="cellSize"
      :width="game.width"
      :height="game.height"
      :field="game.field"
      :hero-x="game.heroX"
      :hero-y="game.heroY"
      :hero-sight="game.heroSight"
      :hero-image="heroImage"
      :reveal-map="game.mapRevealed"
      :soul-path="game.soulPath"
      :show-soul-track="game.mapRevealed"
      :edge-hide-sequence-active="edgeHideSequenceActive"
    />
    <CarryOnButton :visible="game.mapRevealed" @click="carryOn" />
    <ThoughtBubble
      v-for="bubble in game.thoughtBubbles"
      :key="bubble.id"
      :text="bubble.text"
      :style-vars="bubbleStylesById[bubble.id]"
      @dismiss="dismissThoughtBubble(bubble.id)"
    />
  </main>
  <PortalDialog :visible="showPortalDialog" @confirm="confirmRevealMap" />
  <MovePad :enabled="!game.levelComplete" @move="moveHero" />
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Board from './components/Board.vue'
import CarryOnButton from './components/CarryOnButton.vue'
import PortalDialog from './components/PortalDialog.vue'
import MovePad from './components/MovePad.vue'
import ThoughtBubble from './components/ThoughtBubble.vue'
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
import {
  reconcilePlacements as reconcileBubblePlacementsPure,
  computeBubbleSize,
} from './game/bubblePlacement.js'
import { useViewportSize } from './composables/useViewportSize.js'
import { useKeyboardControls } from './composables/useKeyboardControls.js'

// Engine/thoughtBubble modules mutate this object directly.
const game = reactive({
  width: consts.BOARD.width,
  height: consts.BOARD.height,
  field: null,
  heroX: 0,
  heroY: 0,
  heroSight: -1,
  stepCtr: 0,
  soulTrack: {},
  soulPath: [],
  cellSize: consts.CELL_SIZE,
  mapRevealed: false,
  levelComplete: false,
  ...initialThoughtBubbleState(),
})

const { width: viewportWidth, height: viewportHeight } = useViewportSize()
const heroImage = ref(randomGhostImage())
const showPortalDialog = ref(false)
const edgeHideSequenceActive = ref(false)
const bubblePlacementById = ref({})

let scrollClampFrameId = null
let centerOnHeroTimerIds = []
let edgeHideSequenceTimerId = null

const cellSize = computed(() => {
  // Make the sight square fit the shorter viewport axis exactly.
  // Sight diameter = 2 * floor(INIT_SIGHT) + 1 cells. Cells use
  // box-sizing: border-box, so total = cellSize * count.
  const sightDiameter = 2 * Math.floor(consts.INIT_SIGHT) + 1
  const shorter = Math.min(viewportWidth.value, viewportHeight.value)
  return Math.max(16, Math.min(consts.CELL_SIZE, Math.floor(shorter / sightDiameter)))
})

// Engine reads game.cellSize for scrollToPoint.
watch(cellSize, (val) => { game.cellSize = val }, { immediate: true })

const bubbleStylesById = computed(() => {
  const placements = {}
  for (const bubble of game.thoughtBubbles) {
    const placement = bubblePlacementById.value[bubble.id]
    const size = placement?.size ?? computeBubbleSize(bubble.text, viewportWidth.value)
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
})

function reconcileBubblePlacements() {
  bubblePlacementById.value = reconcileBubblePlacementsPure(
    game.thoughtBubbles,
    bubblePlacementById.value,
    {
      heroX: game.heroX,
      heroY: game.heroY,
      width: game.width,
      height: game.height,
      cellSize: cellSize.value,
      viewportWidth: viewportWidth.value,
      viewportHeight: viewportHeight.value,
    },
  )
}

function isHeroOnPortalCell() {
  return game.field?.[game.heroX]?.[game.heroY] === 'finish'
}

function clearEdgeHideSequenceTimer() {
  if (edgeHideSequenceTimerId === null) return
  window.clearTimeout(edgeHideSequenceTimerId)
  edgeHideSequenceTimerId = null
}

function centerOnHero() {
  if (game.mapRevealed) return
  nextTick(() => {
    setTimeout(() => {
      scrollToPoint(game.heroX, game.heroY, cellSize.value)
    }, 0)
  })
}

function clearCenterOnHeroTimers() {
  centerOnHeroTimerIds.forEach((timerId) => window.clearTimeout(timerId))
  centerOnHeroTimerIds = []
}

function cancelScrollClampFrame() {
  if (scrollClampFrameId === null) return
  window.cancelAnimationFrame(scrollClampFrameId)
  scrollClampFrameId = null
}

function handleWindowScroll() {
  if (scrollClampFrameId !== null) return
  scrollClampFrameId = window.requestAnimationFrame(() => {
    scrollClampFrameId = null
    clampScrollToBoardBounds()
  })
}

function queueCenterOnHero() {
  if (!game.field) return
  if (game.mapRevealed) return
  clearCenterOnHeroTimers()
  ;[0, 100, 250, 500, 1000].forEach((delay) => {
    const timerId = window.setTimeout(centerOnHero, delay)
    centerOnHeroTimerIds.push(timerId)
  })
}

function handleKeydown(e) {
  if (e.key === 'Enter') {
    if (showPortalDialog.value) {
      confirmRevealMap()
      e.preventDefault()
    } else if (game.mapRevealed) {
      carryOn()
      e.preventDefault()
    }
    return
  }
  if (e.key.toLowerCase() === 'x') {
    const hidden = hideOldestThoughtBubble(game)
    if (hidden) e.preventDefault()
    return
  }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    return
  }
  e.preventDefault()
  moveHero(e.key)
}

function moveHero(key) {
  if (game.levelComplete) return
  const result = processKey(key, game)
  heroImage.value = randomGhostImage()
  onThoughtMove(game)
  if (result.reachedFinish) {
    finishLevel()
  }
}

function finishLevel(isLoad = false) {
  game.levelComplete = true
  edgeHideSequenceActive.value = true
  onThoughtLevelComplete(game)
  clearEdgeHideSequenceTimer()

  const edgeLayers = Math.floor(Math.min(game.width, game.height) / 2)
  const perLayerDelayMs = 24
  const fadeDurationMs = 500
  const sequenceDurationMs = edgeLayers * perLayerDelayMs + fadeDurationMs

  edgeHideSequenceTimerId = window.setTimeout(() => {
    edgeHideSequenceTimerId = null
    // Keep edgeHideSequenceActive = true so the board stays fully hidden
    // behind the dialog. It will be cleared in confirmRevealMap when the
    // map is revealed.
    showPortalDialog.value = true
  }, isLoad ? Math.max(200, sequenceDurationMs * 0.5) : sequenceDurationMs)
}

function confirmRevealMap() {
  showPortalDialog.value = false
  edgeHideSequenceActive.value = false
  revealMap()
}

function revealMap() {
  game.mapRevealed = true
  onThoughtMapRevealed(game)
  nextTick(() => {
    clampScrollToBoardBounds()
  })
}

function carryOn() {
  clearEdgeHideSequenceTimer()
  edgeHideSequenceActive.value = false
  showPortalDialog.value = false
  game.mapRevealed = false
  game.levelComplete = false
  initLevel(game, true)
  heroImage.value = randomGhostImage()
  queueCenterOnHero()
  resetThoughtState(game)
}

function dismissThoughtBubble(id) {
  hideThoughtBubble(game, id)
}

useKeyboardControls(handleKeydown)

watch([viewportWidth, viewportHeight], () => reconcileBubblePlacements())

// --- Lifecycle ---

initLevel(game)
if (isHeroOnPortalCell()) {
  finishLevel(true)
}

onMounted(() => {
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual'
  }

  queueCenterOnHero()
  document.body.addEventListener('scroll', handleWindowScroll, { passive: true })
  window.addEventListener('resize', handleWindowScroll)
  window.addEventListener('load', queueCenterOnHero)
  window.addEventListener('pageshow', queueCenterOnHero)
  startThoughtBubbleLoop(game)
  if (consts.DEBUG_ALL_THOUGHT_BUBBLES) {
    debugFillAllSlots(game)
  }
})

onBeforeUnmount(() => {
  clearCenterOnHeroTimers()
  cancelScrollClampFrame()
  document.body.removeEventListener('scroll', handleWindowScroll)
  window.removeEventListener('resize', handleWindowScroll)
  window.removeEventListener('load', queueCenterOnHero)
  window.removeEventListener('pageshow', queueCenterOnHero)
  stopThoughtBubbleLoop(game)
  clearEdgeHideSequenceTimer()
})

watch(() => game.field, () => queueCenterOnHero())

watch(cellSize, () => {
  if (!game.mapRevealed) queueCenterOnHero()
})

watch(
  () => game.thoughtBubbles,
  () => reconcileBubblePlacements(),
  { deep: true, immediate: true },
)
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
</style>
