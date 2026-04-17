<script setup>
import { computed } from 'vue'
import { computeTrailDots } from '../game/soulTrail.js'

const props = defineProps({
  soulPath: { type: Array, default: () => [] },
  cellSize: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
})

const trailDots = computed(() => computeTrailDots(props.soulPath, props.cellSize))
const dotRadius = computed(() => Math.max(1.2, props.cellSize / 20))
const trailStartDot = computed(() => trailDots.value[0] ?? null)
const trailStartCell = computed(() => {
  const first = props.soulPath?.[0]
  if (!first) return null
  return { x: first[0] * props.cellSize, y: first[1] * props.cellSize }
})
// cross.png has ~20% transparent padding on each side, so we upscale
// to keep the "X" content roughly the same visual size as the cell.
const startCrossHalfSize = computed(() => Math.max(8, props.cellSize * 0.5))
</script>

<template>
  <svg
    class="soul-trail-overlay"
    :width="cellSize * width"
    :height="cellSize * height"
    aria-hidden="true"
  >
    <circle
      v-for="(dot, i) in trailDots"
      :key="i"
      :cx="dot.x"
      :cy="dot.y"
      :r="dotRadius"
      fill="rgba(0, 0, 0, 0.85)"
    />
    <rect
      v-if="trailStartCell"
      :x="trailStartCell.x"
      :y="trailStartCell.y"
      :width="cellSize"
      :height="cellSize"
      fill="rgba(255, 255, 255, 0.5)"
    />
    <image
      v-if="trailStartDot"
      class="trail-start-cross"
      href="/images/cross.png"
      :x="trailStartDot.x - startCrossHalfSize"
      :y="trailStartDot.y - startCrossHalfSize"
      :width="startCrossHalfSize * 2"
      :height="startCrossHalfSize * 2"
    />
  </svg>
</template>

<style scoped>
.soul-trail-overlay {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 2;
}

.trail-start-cross {
  pointer-events: none;
}
</style>
