// Game parameters
export const BOARD = {
    width: 50,
    height: 50,
}
export const CELL_SIZE = 50
export const INIT_SIGHT = 5.5

// Graphic parameters
export const CELL_HIDE_DELAY = 100
export const GHOST_COUNT = 19

export function randomGhostImage() {
    const idx = Math.floor(Math.random() * GHOST_COUNT) + 1
    return `/images/ghost_${idx}.png`
}
