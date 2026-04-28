<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import TitleMaze from './TitleMaze.vue'
import { useViewportSize } from '../composables/useViewportSize.js'
import {
  TITLE_FIELD,
  TITLE_FIELD_ROWS,
  TITLE_FIELD_COLS,
} from '../game/titleField.js'

defineEmits(['start'])

const { width: vw, height: vh } = useViewportSize()

// Fit the title to the viewport with margin for the button below.
const TITLE_VIEWPORT_FRACTION = 0.92
const VERTICAL_RESERVE_FRACTION = 0.55

const cellSize = computed(() => {
  const maxByWidth = (vw.value * TITLE_VIEWPORT_FRACTION) / TITLE_FIELD_COLS
  const maxByHeight = (vh.value * VERTICAL_RESERVE_FRACTION) / TITLE_FIELD_ROWS
  return Math.max(2, Math.floor(Math.min(maxByWidth, maxByHeight)))
})
const titleWidth = computed(() => cellSize.value * TITLE_FIELD_COLS)
const titleHeight = computed(() => cellSize.value * TITLE_FIELD_ROWS)

// ────────────────────────────────────────────────────────────────────
// Reveal animation: a black canvas covers the title; "light streams"
// (particles) carve soft circles into it so the title peeks through.
// Carved areas fade back to black each frame, so the reveal is dynamic.
// ────────────────────────────────────────────────────────────────────

const maskCanvas = ref(null)
let rafId = null
let lastTime = 0
let particles = []
let lastSpawnTime = 0

const FADE_ALPHA = 0.06            // per-frame trail darken-back
const TARGET_PARTICLE_COUNT = 4
const SPAWN_INTERVAL_MS = 260
const SPAWN_BURST_AT_MOUNT = 3
const PARTICLE_SPLIT_PROBABILITY = 0.5
const PARTICLE_LIFETIME_MIN_MS = 2400
const PARTICLE_LIFETIME_MAX_MS = 4800
const LOBE_PEAK_ALPHA = 0.55       // per-lobe peak; blobs overlap to carve more

function rand(min, max) {
  return min + Math.random() * (max - min)
}

// A "blob" particle is a cluster of 3–5 offset lobes around a moving
// center. Each lobe wobbles in angle/distance/size on its own phase,
// so the silhouette looks amorphous and liquid (no straight edges).
function makeLobes(baseRadius) {
  const count = 3 + Math.floor(Math.random() * 3)
  const lobes = []
  for (let i = 0; i < count; i++) {
    lobes.push({
      // Spread around the center but with jitter so they're not symmetric.
      offsetAngle: (i / count) * Math.PI * 2 + rand(-0.5, 0.5),
      offsetDistance: baseRadius * rand(0.15, 0.55),
      sizeMul: rand(0.55, 1.05),
      wobblePhase: rand(0, Math.PI * 2),
      wobbleSpeed: rand(0.6, 1.4),
      wobbleAmp: rand(0.15, 0.35),
    })
  }
  return lobes
}

function spawnParticle() {
  const w = titleWidth.value
  const h = titleHeight.value
  if (w <= 0 || h <= 0) return

  // Speed scales with the title's diagonal so motion feels consistent
  // across viewport sizes.
  const baseSpeed = Math.hypot(w, h) * 0.10
  const speed = rand(baseSpeed * 0.5, baseSpeed * 1.4)

  let x, y, angle
  const fromInside = Math.random() < 0.25
  if (fromInside) {
    x = rand(0, w)
    y = rand(0, h)
    angle = rand(0, Math.PI * 2)
  } else {
    const edge = Math.floor(Math.random() * 4)
    const margin = Math.max(20, h * 0.6)
    if (edge === 0) {        // from top, heading down-ish
      x = rand(-margin * 0.3, w + margin * 0.3); y = -margin
      angle = rand(Math.PI * 0.15, Math.PI * 0.85)
    } else if (edge === 1) { // from right, heading left-ish
      x = w + margin; y = rand(-margin * 0.3, h + margin * 0.3)
      angle = rand(Math.PI * 0.65, Math.PI * 1.35)
    } else if (edge === 2) { // from bottom, heading up-ish
      x = rand(-margin * 0.3, w + margin * 0.3); y = h + margin
      angle = rand(-Math.PI * 0.85, -Math.PI * 0.15)
    } else {                 // from left, heading right-ish
      x = -margin; y = rand(-margin * 0.3, h + margin * 0.3)
      angle = rand(-Math.PI * 0.35, Math.PI * 0.35)
    }
  }

  const baseRadius = h * rand(0.55, 1.05)
  particles.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    baseRadius,
    lobes: makeLobes(baseRadius),
    age: 0,
    maxAge: rand(PARTICLE_LIFETIME_MIN_MS, PARTICLE_LIFETIME_MAX_MS),
    splitsLeft: Math.random() < PARTICLE_SPLIT_PROBABILITY ? 1 : 0,
    splitCooldownMs: rand(400, 1400),
    wiggleStrength: rand(0, 0.7),
    wigglePhase: rand(0, Math.PI * 2),
  })
}

function step(t) {
  const canvas = maskCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dt = lastTime ? Math.min(50, t - lastTime) : 16
  lastTime = t

  const w = canvas.width
  const h = canvas.height

  // Trail fade: darken everything a notch toward fully opaque black.
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = `rgba(0,0,0,${FADE_ALPHA})`
  ctx.fillRect(0, 0, w, h)

  // Carve around each particle.
  ctx.globalCompositeOperation = 'destination-out'
  const newSplits = []
  for (const p of particles) {
    // Wiggle: sinusoidal perturbation of direction.
    p.wigglePhase += dt * 0.005
    const wig = Math.sin(p.wigglePhase) * p.wiggleStrength
    const baseAngle = Math.atan2(p.vy, p.vx)
    const speed = Math.hypot(p.vx, p.vy)
    const newAngle = baseAngle + wig * dt / 1000
    p.vx = Math.cos(newAngle) * speed
    p.vy = Math.sin(newAngle) * speed

    p.x += p.vx * dt / 1000
    p.y += p.vy * dt / 1000
    p.age += dt

    // Random split while inside the title area.
    p.splitCooldownMs -= dt
    if (p.splitsLeft > 0 && p.splitCooldownMs <= 0
      && p.x > 0 && p.x < w && p.y > 0 && p.y < h) {
      p.splitsLeft--
      const sign = Math.random() < 0.5 ? -1 : 1
      const splitAngle = baseAngle + rand(0.5, 1.4) * sign
      const splitSpeed = speed * rand(0.7, 1.0)
      const splitRadius = p.baseRadius * rand(0.65, 0.95)
      newSplits.push({
        x: p.x, y: p.y,
        vx: Math.cos(splitAngle) * splitSpeed,
        vy: Math.sin(splitAngle) * splitSpeed,
        baseRadius: splitRadius,
        lobes: makeLobes(splitRadius),
        age: 0,
        maxAge: Math.max(800, p.maxAge - p.age),
        splitsLeft: 0,
        splitCooldownMs: 0,
        wiggleStrength: p.wiggleStrength * 0.7,
        wigglePhase: rand(0, Math.PI * 2),
      })
    }

    // Carve as a metaball cluster — each lobe is a soft radial gradient
    // offset from the center, with its own wobbling angle / distance /
    // size. Overlapping lobes combine into a smooth amorphous shape.
    const lifeRatio = Math.max(0, 1 - p.age / p.maxAge)
    const lobeAlpha = LOBE_PEAK_ALPHA * lifeRatio
    if (lobeAlpha <= 0) continue
    const tSec = p.age / 1000
    for (const lobe of p.lobes) {
      const phase = lobe.wobblePhase + tSec * lobe.wobbleSpeed
      const wobble = Math.sin(phase) * lobe.wobbleAmp
      const lobeAngle = lobe.offsetAngle + wobble
      const lobeDist = lobe.offsetDistance * (1 + wobble * 0.5)
      const lx = p.x + Math.cos(lobeAngle) * lobeDist
      const ly = p.y + Math.sin(lobeAngle) * lobeDist
      const lr = p.baseRadius * lobe.sizeMul * (1 + Math.cos(phase + 1.0) * 0.18)
      const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr)
      grad.addColorStop(0, `rgba(0,0,0,${lobeAlpha})`)
      grad.addColorStop(0.55, `rgba(0,0,0,${lobeAlpha * 0.5})`)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2)
    }
  }
  if (newSplits.length) particles.push(...newSplits)

  // Cull dead / off-area particles. Margin accounts for the lobe spread
  // around the particle center so big blobs aren't culled prematurely.
  particles = particles.filter((p) => {
    if (p.age >= p.maxAge) return false
    const m = Math.max(220, h * 1.7)
    if (p.x < -m || p.x > w + m || p.y < -m || p.y > h + m) return false
    return true
  })

  // Maintain a steady stream of particles.
  if (t - lastSpawnTime > SPAWN_INTERVAL_MS && particles.length < TARGET_PARTICLE_COUNT) {
    lastSpawnTime = t
    spawnParticle()
  }

  rafId = requestAnimationFrame(step)
}

function resetCanvas() {
  const canvas = maskCanvas.value
  if (!canvas) return
  canvas.width = titleWidth.value
  canvas.height = titleHeight.value
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

onMounted(() => {
  resetCanvas()
  for (let i = 0; i < SPAWN_BURST_AT_MOUNT; i++) spawnParticle()
  lastTime = 0
  lastSpawnTime = 0
  rafId = requestAnimationFrame(step)
})

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})

watch([titleWidth, titleHeight], () => {
  resetCanvas()
})
</script>

<template>
  <div class="start-menu">
    <div class="start-menu__title">
      <TitleMaze :field="TITLE_FIELD" :cell-size="cellSize" />
      <canvas
        ref="maskCanvas"
        class="title-mask"
        :width="titleWidth"
        :height="titleHeight"
        :style="{ width: `${titleWidth}px`, height: `${titleHeight}px` }"
      ></canvas>
    </div>
    <button class="brick-btn start-menu__btn" @click="$emit('start')">
      Start game
    </button>
  </div>
</template>

<style scoped>
.start-menu {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 36px;
  padding: 16px;
  box-sizing: border-box;
}
.start-menu__title {
  /* Wraps TitleMaze so flex centering works regardless of cell size.
     Position relative so the absolutely-positioned mask canvas anchors here. */
  position: relative;
  flex: 0 0 auto;
}
.title-mask {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.start-menu__btn {
  flex: 0 0 auto;
}
</style>
