# Hero Image Transition

Notes on implementing crossfade transitions between ghost poses on move.

## Architecture

The hero is rendered as a single persistent `<img>` at the Board level (not per-cell), positioned absolutely via `left`/`top`. This eliminates the destroy/create DOM cycle that caused directional blinking (see "Why right was smooth" below).

## Crossfade approach

Render two `<img>` elements at the hero position:

1. **New image** (z-index 1) — always fully opaque
2. **Previous image** (z-index 2) — sits on top, fades out via CSS animation

The old ghost fades out, revealing the new ghost underneath.

### State needed (App.vue)

```js
data() {
  return {
    heroImage: randomGhostImage(),
    prevHeroImage: null,
    moveCount: 0,
  }
}

// In moveHero():
this.prevHeroImage = this.heroImage;
this.heroImage = randomGhostImage();
this.moveCount++;
```

### Template (Board.vue)

```html
<img class="board-hero" :src="heroImage"
  :style="`left: ${heroX * cellSize}px; top: ${heroY * cellSize}px; width: ${cellSize}px; height: ${cellSize}px;`">
<img v-if="prevHeroImage" :key="moveCount" class="board-hero board-hero--prev" :src="prevHeroImage"
  :style="`left: ${heroX * cellSize}px; top: ${heroY * cellSize}px; width: ${cellSize}px; height: ${cellSize}px;`">
```

`:key="moveCount"` forces Vue to recreate the element each move, re-triggering the animation.

### CSS (Board.vue)

```css
.board-hero {
  position: absolute;
  pointer-events: none;
  z-index: 1;
}
.board-hero--prev {
  z-index: 2;
  animation: ghost-fade-out 0.3s ease-out forwards;
}
@keyframes ghost-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
```

## Why right movement was smooth (historical)

Previously the hero was rendered inside each Cell via `v-if="hasHero"`. On move, the `<img>` was destroyed in the old cell and recreated in the new one. Right movement looked smooth because cells are inline-blocks rendered left-to-right in the same row — the DOM remove/add happened on adjacent sibling elements. Other directions crossed different parent `<div>`s (rows) or went backwards in DOM order, causing visible flicker.

The fix was moving the hero to a single persistent `<img>` at Board level, so no DOM elements are destroyed/created on move.

## Approaches that didn't work

- **Scale/bounce animation** (`transform: scale`) on cell-level hero — looked jarring on small cells
- **Slide transition** (rendering hero at offset, transitioning `transform` to 0) — didn't look good with the grid-based movement
