<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  // When false, the pad stays hidden regardless of touch capability
  // (e.g. while a level-complete sequence is playing).
  enabled: { type: Boolean, default: true },
})
defineEmits(['move'])

const PAD_SIZE = 56 * 3 + 8 * 2
const INSET_RIGHT = 20
const INSET_BOTTOM = 20

const visible = ref(false)
const style = ref({ left: '0px', top: '0px' })
let frameId = null

function detectVisibility() {
  if (!props.enabled) {
    visible.value = false
    return
  }
  visible.value = (
    window.matchMedia('(pointer: coarse)').matches
    || navigator.maxTouchPoints > 0
    || 'ontouchstart' in window
  )
}

function updatePosition() {
  if (!visible.value) return
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  const scrollLeft = document.body.scrollLeft
  const scrollTop = document.body.scrollTop
  const left = scrollLeft + vw - PAD_SIZE - INSET_RIGHT
  const top = scrollTop + vh - PAD_SIZE - INSET_BOTTOM
  style.value = {
    left: `${Math.max(0, left)}px`,
    top: `${Math.max(0, top)}px`,
  }
}

function schedulePositionUpdate() {
  if (!visible.value) return
  if (frameId !== null) return
  frameId = window.requestAnimationFrame(() => {
    frameId = null
    updatePosition()
  })
}

onMounted(() => {
  detectVisibility()
  updatePosition()
  document.body.addEventListener('scroll', schedulePositionUpdate, { passive: true })
  window.addEventListener('resize', detectVisibility)
  window.addEventListener('resize', schedulePositionUpdate)
})

onBeforeUnmount(() => {
  if (frameId !== null) {
    window.cancelAnimationFrame(frameId)
    frameId = null
  }
  document.body.removeEventListener('scroll', schedulePositionUpdate)
  window.removeEventListener('resize', detectVisibility)
  window.removeEventListener('resize', schedulePositionUpdate)
})

watch(() => props.enabled, () => {
  detectVisibility()
  updatePosition()
})
</script>

<template>
  <teleport to="body">
    <div v-if="visible" class="move-pad" :style="style" aria-label="Movement controls">
      <button
        type="button"
        class="move-pad__button move-pad__button--up"
        aria-label="Move up"
        @pointerdown.prevent.stop="$emit('move', 'ArrowUp')"
      >
        <span class="move-pad__arrow move-pad__arrow--up"></span>
      </button>
      <button
        type="button"
        class="move-pad__button move-pad__button--left"
        aria-label="Move left"
        @pointerdown.prevent.stop="$emit('move', 'ArrowLeft')"
      >
        <span class="move-pad__arrow move-pad__arrow--left"></span>
      </button>
      <button
        type="button"
        class="move-pad__button move-pad__button--right"
        aria-label="Move right"
        @pointerdown.prevent.stop="$emit('move', 'ArrowRight')"
      >
        <span class="move-pad__arrow move-pad__arrow--right"></span>
      </button>
      <button
        type="button"
        class="move-pad__button move-pad__button--down"
        aria-label="Move down"
        @pointerdown.prevent.stop="$emit('move', 'ArrowDown')"
      >
        <span class="move-pad__arrow move-pad__arrow--down"></span>
      </button>
    </div>
  </teleport>
</template>

<style scoped>
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

.move-pad__button--up { grid-column: 2; grid-row: 1; }
.move-pad__button--left { grid-column: 1; grid-row: 2; }
.move-pad__button--right { grid-column: 3; grid-row: 2; }
.move-pad__button--down { grid-column: 2; grid-row: 3; }

.move-pad__arrow {
  display: block;
  width: 16px;
  height: 16px;
  margin: 0 auto;
  border-top: 3px solid rgba(255, 255, 255, 0.7);
  border-right: 3px solid rgba(255, 255, 255, 0.7);
}

.move-pad__arrow--up { transform: rotate(-45deg); }
.move-pad__arrow--right { transform: rotate(45deg); }
.move-pad__arrow--down { transform: rotate(135deg); }
.move-pad__arrow--left { transform: rotate(-135deg); }
</style>
