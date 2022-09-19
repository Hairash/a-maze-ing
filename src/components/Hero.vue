<script setup>
    import Cell from './Cell.vue'

    defineProps({
      width: {
        type: Number,
        required: true,
      },
      height: {
        type: Number,
        required: true,
      },
      field: {
        type: Array[Array[String]],
        required: true,
      },
    })
    </script>

    <template>
      <div class="board">
        <div class="cell_line" v-for="(line, y) in field">
          <template v-for="(cellType, x) in line">
            <Cell :size=100 :type=cellType />
          </template>
        </div>
      </div>
    </template>

    <style scoped>
    .board {
      border: solid 2px;
    }

    .cell_line {
      line-height: 0;
    }
    </style>
