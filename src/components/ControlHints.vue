<script setup>
import { computed, onMounted, ref } from 'vue'
import { HINT_FADE_MS } from '../game/const.js'

const props = defineProps({
  isMobile: { type: Boolean, default: false },
})

const text = computed(() =>
  props.isMobile
    ? 'Use buttons to move the soul.\nTap thought to hide it.'
    : 'Use \u2190 \u2192 \u2191 \u2193 keys to move the soul.\nUse X key to hide the thought.',
)

// Mount with opacity 0, then animate to 1 next frame so the entrance
// uses the CSS transition (no flash on mount).
const visible = ref(false)
onMounted(() => {
  requestAnimationFrame(() => { visible.value = true })
})

const fadeMsCss = `${HINT_FADE_MS}ms`
</script>

<template>
  <div
    class="control-hints"
    :class="{
      'control-hints--visible': visible,
      'control-hints--mobile': isMobile,
    }"
    role="note"
  >{{ text }}</div>
</template>

<style scoped>
.control-hints {
  position: fixed;
  top: env(safe-area-inset-top, 0px);
  left: 50%;
  transform: translateX(-50%);
  margin-top: 16px;
  z-index: 9500;
  max-width: min(90vw, 520px);
  padding: 12px 18px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: clamp(0.85rem, 2vw, 1rem);
  line-height: 1.4;
  text-align: center;
  white-space: pre-line;
  pointer-events: none;
  opacity: 0;
  transition: opacity v-bind(fadeMsCss) ease-out;
}
.control-hints--visible {
  opacity: 1;
}

/* Mobile: ~10% larger and anchored just above the MovePad's arrows.
   MovePad geometry: PAD_SIZE = 56*3 + 8*2 = 184px, INSET_BOTTOM = 20px;
   add a 16px gap above the pad. */
.control-hints--mobile {
  top: auto;
  bottom: calc(220px + env(safe-area-inset-bottom, 0px));
  margin-top: 0;
  padding: 13px 20px;
  font-size: clamp(0.94rem, 2.2vw, 1.1rem);
  border-radius: 15px;
  width: min(90vw, 250px);
  max-width: 250px;
}
</style>
