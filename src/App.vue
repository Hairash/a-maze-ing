<script>
import Board from './components/Board.vue'
import { generateField, selectEmptyRandomCell } from './game/generator.js'
import { processKey } from './game/engine.js'
import * as consts from './game/const.js'


export default {
  name: 'App',
  components: {
    Board,
  },
  data() {
    const width = 10;
    const height = 10;
    const field = generateField(width, height);
    const [heroX, heroY] = selectEmptyRandomCell(field, width, height);
    console.log('Hero:', heroX, heroY);
    const heroSight = consts.INIT_SIGHT;
    const stepCtr = 0;
    // console.log(field);

    return {
      width,
      height,
      field,
      heroX,
      heroY,
      heroSight,
      stepCtr,
    }
  },
  created() {
    window.addEventListener('keydown', (e) => {
      processKey(e.key, this);
    });
  }
}
</script>

<template>
  <main>
    <Board
      :cell-size=50
      :width=width
      :height=height
      :field=field
      :hero-x=heroX
      :hero-y=heroY
      :hero-sight=heroSight
    />
  </main>
</template>

<style>
@import './assets/base.css';

/* #app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;

  font-weight: normal;
} */
/*
header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

a,
.green {
  text-decoration: none;
  color: hsla(160, 100%, 37%, 1);
  transition: 0.4s;
}

@media (hover: hover) {
  a:hover {
    background-color: hsla(160, 100%, 37%, 0.2);
  }
}

@media (min-width: 1024px) {
  body {
    display: flex;
    place-items: center;
  }

  #app {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 0 2rem;
  }

  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  .logo {
    margin: 0 2rem 0 0;
  } */
/* } */
</style>
