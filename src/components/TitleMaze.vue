<script setup>
import { computed } from 'vue'
import { WALL_FOLDER, WALL_VARIANT_COUNT } from '../game/const.js'

const props = defineProps({
  field: { type: Array, required: true },
  cellSize: { type: Number, required: true },
})

// Pre-roll a wall-image variant for every wall cell so the textures don't
// flicker on resize. Computed from `field` only — stable across re-renders.
const variants = computed(() =>
  props.field.map((row) =>
    row.map(() => Math.floor(Math.random() * WALL_VARIANT_COUNT) + 1),
  ),
)
</script>

<template>
  <div class="title-maze">
    <div
      v-for="(row, ry) in field"
      :key="ry"
      class="title-row"
    >
      <div
        v-for="(cell, cx) in row"
        :key="cx"
        class="title-cell"
        :style="{ width: `${cellSize}px`, height: `${cellSize}px` }"
      >
        <img
          v-if="cell === 'wall'"
          :src="`/images/${WALL_FOLDER}/wall${variants[ry][cx]}.png`"
          class="title-cell-img"
          alt=""
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.title-maze {
  display: flex;
  flex-direction: column;
  line-height: 0;
}
.title-row {
  display: flex;
}
.title-cell {
  background-color: #fff;
  display: inline-block;
  vertical-align: top;
}
.title-cell-img {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
