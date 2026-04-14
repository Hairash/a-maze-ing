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
})
</script>

<template>
  <div :class="isHidden ? 'cell hidden' : 'cell'" :style="`width: ${size}px; height: ${size}px`">
    <img :src="`/images/${type}.png`">
  </div>
</template>

<style scoped>
.cell {
  width: 100px;
  height: 100px;
  /* background-color: #115522; */
  display: inline-block;
  border: solid 1px;
  transition: opacity 0.5s;
}
.cell.hidden {
  opacity: 0;
}
.cell img {
  width: 100%;
  height: 100%;
}
</style>
