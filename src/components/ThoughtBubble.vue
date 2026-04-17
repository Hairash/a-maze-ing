<script setup>
defineProps({
  text: { type: String, required: true },
  // Pre-computed style object: positioning, size, --bubble-flip-x/y,
  // --bubble-text-top.
  styleVars: { type: Object, default: () => ({}) },
})
defineEmits(['dismiss'])
</script>

<template>
  <aside
    class="thought-bubble"
    :style="styleVars"
    aria-live="polite"
    aria-atomic="true"
    @pointerdown.prevent.stop="$emit('dismiss')"
  >
    <span class="thought-bubble__text">{{ text }}</span>
  </aside>
</template>

<style scoped>
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
</style>
