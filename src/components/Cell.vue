<script setup>
defineProps({
  size: {
    type: Number,
    required: false,
  },
  type: {
    type: String,
    required: true,
  },
  isHidden: {
    type: Boolean,
    required: true,
  },
  activated: {
    type: Boolean,
    required: false,
    default: false,
  },
  transitionDelayMs: {
    type: Number,
    required: false,
    default: 0,
  },
})
</script>

<template>
  <div
    :class="isHidden ? 'cell hidden' : 'cell'"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      transitionDelay: `${Math.max(0, transitionDelayMs)}ms`,
    }"
  >
    <span v-if="type === 'lamp'" class="lamp-glow"></span>
    <img v-if="type === 'lamp' && activated" src="/images/glow.png">
    <img v-else-if="type !== 'empty'" :src="`/images/${type}.png`">
  </div>
</template>

<style scoped>
.cell {
  width: 100px;
  height: 100px;
  background-color: #ffffff;
  display: inline-block;
  vertical-align: top;
  border: solid 1px #ddd;
  transition: opacity 0.5s;
}
.cell.hidden {
  opacity: 0;
}
.cell img {
  width: 100%;
  height: 100%;
}
.lamp-glow {
  position: absolute;
  top: 10%;
  left: 10%;
  width: 80%;
  height: 80%;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
}
</style>
