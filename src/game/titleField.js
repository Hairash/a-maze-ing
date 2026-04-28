// Static 2D field for the start-menu title "A-MAZE-ING".
// Cells are 'wall' (letter strokes + outer border) or 'empty' (background).
// Letters are 5 rows tall in a tiny pixel font; '#' = wall, '.' = empty.

const LETTER_SOURCE = {
  A: [
    '.###.',
    '#...#',
    '#####',
    '#...#',
    '#...#',
  ],
  M: [
    '#...#',
    '##.##',
    '#.#.#',
    '#...#',
    '#...#',
  ],
  Z: [
    '#####',
    '...#.',
    '..#..',
    '.#...',
    '#####',
  ],
  E: [
    '####',
    '#...',
    '###.',
    '#...',
    '####',
  ],
  I: [
    '###',
    '.#.',
    '.#.',
    '.#.',
    '###',
  ],
  N: [
    '#...#',
    '##..#',
    '#.#.#',
    '#..##',
    '#...#',
  ],
  G: [
    '.####',
    '#....',
    '#.###',
    '#...#',
    '.###.',
  ],
  '-': [
    '.....',
    '.....',
    '.###.',
    '.....',
    '.....',
  ],
}

const TITLE_TEXT = 'A-MAZE-ING'
const LETTER_GAP = 1   // empty cols between letters
const INNER_PAD = 1    // empty padding inside the maze border
const BORDER = 1       // wall cells around the outside

function letterToGrid(rows) {
  return rows.map((row) => row.split('').map((ch) => (ch === '#' ? 1 : 0)))
}

function joinHorizontally(grids, gap) {
  const height = grids[0].length
  const out = Array.from({ length: height }, () => [])
  grids.forEach((g, i) => {
    if (i > 0) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < gap; x++) out[y].push(0)
      }
    }
    for (let y = 0; y < height; y++) out[y].push(...g[y])
  })
  return out
}

function pad(grid, t, r, b, l, value) {
  const cols = grid[0].length + l + r
  const fillRow = () => Array(cols).fill(value)
  const top = Array.from({ length: t }, fillRow)
  const bottom = Array.from({ length: b }, fillRow)
  const middle = grid.map((row) => [
    ...Array(l).fill(value),
    ...row,
    ...Array(r).fill(value),
  ])
  return [...top, ...middle, ...bottom]
}

const letterGrids = TITLE_TEXT.split('').map((ch) => letterToGrid(LETTER_SOURCE[ch]))
const inner = joinHorizontally(letterGrids, LETTER_GAP)
const padded = pad(inner, INNER_PAD, INNER_PAD, INNER_PAD, INNER_PAD, 0)
const withBorder = pad(padded, BORDER, BORDER, BORDER, BORDER, 1)
const inverted = padded.map((row) => row.map((v) => v === 1 ? 0 : 1))

export const TITLE_FIELD = withBorder.map((row) =>
  row.map((v) => (v === 1 ? 'wall' : 'empty')),
)
export const TITLE_FIELD_ROWS = TITLE_FIELD.length
export const TITLE_FIELD_COLS = TITLE_FIELD[0].length

// Per-letter binary grids used by the pulse-letters start menu.
// Each entry is { char, grid: number[][] } where 1 = brick, 0 = empty.
// Dashes are included so they can pulse like the other glyphs.
export const LETTER_GRIDS = TITLE_TEXT.split('').map((ch) => ({
  char: ch,
  grid: letterToGrid(LETTER_SOURCE[ch]),
}))
export const LETTER_ROW_COUNT = letterGrids[0].length
export const LETTER_INTER_GAP_COLS = LETTER_GAP
