<script setup>
import { computed, toRef } from 'vue'
import { useInactivityTimer } from '../composables/useInactivityTimer.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
})
defineEmits(['click'])

// Blink after 5s of no scroll/pointer activity while the button is shown.
const visibleRef = toRef(props, 'visible')
const { fired: blink } = useInactivityTimer({
  delayMs: 5000,
  enabledRef: visibleRef,
})
</script>

<template>
  <button
    v-if="visible"
    class="brick-btn carry-on"
    :class="{ 'carry-on--blink': blink }"
    type="button"
    @click="$emit('click')"
  >
    Carry on
  </button>
</template>

<style scoped>
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
</style>
