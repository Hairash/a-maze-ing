<script setup>
import { computed } from 'vue'
import { WALL_FOLDER } from '../game/const.js'

const props = defineProps({
  size: {
    type: Number,
    required: false,
  },
  type: {
    type: String,
    required: true,
  },
  wallVariant: {
    type: Number,
    required: false,
    default: null,
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

const cellImageSrc = computed(() => {
  if (props.type === 'wall' && props.wallVariant) {
    return `/images/${WALL_FOLDER}/wall${props.wallVariant}.png`
  }
  return `/images/${props.type}.png`
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
    <span v-if="type === 'lamp' || type === 'finish'" class="lamp-glow"></span>
    <img v-if="type === 'lamp' && activated" src="/images/glow.png" class="cell-img">
    <img v-else-if="type !== 'empty'" :src="cellImageSrc" class="cell-img">
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
.cell-img {
  position: relative;
  z-index: 4;
}
.lamp-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.5);
  z-index: 3;
}
</style>
