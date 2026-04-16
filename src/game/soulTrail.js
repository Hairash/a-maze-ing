// Computes a dotted polyline representation of the soul's walk for the
// map-reveal overlay.
//
// How it works:
//   1. The walk is turned into a polyline — one vertex per step in the path.
//      Each vertex lies inside its cell, offset from the cell's center based
//      on which visit of that cell it is.
//   2. Because consecutive vertices share endpoints, the polyline is
//      continuous by construction — no gaps between adjacent cells.
//   3. Different passes through the same cell land on different offset
//      slots, so multiple lines in one cell don't overlap (for the first
//      5 visits). Visits beyond that pick overlapping slots with a little
//      deterministic jitter.
//   4. A small per-vertex jitter is always applied, so lines look
//      hand-drawn rather than machine-straight.
//   5. Finally we walk the polyline and drop a dot every `spacing` pixels.

// First five visits get distinct slots around the cell center. Values are
// fractions of cellSize from the center (so ±0.28 ≈ 28% from middle).
const VISIT_OFFSETS = [
  [0, 0],        // visit 1: center
  [0, -0.28],    // visit 2: upper
  [0, 0.28],     // visit 3: lower
  [-0.28, 0],    // visit 4: left
  [0.28, 0],     // visit 5: right
]

// Deterministic pseudo-random in [0, 1) based on three integer seeds.
function hashUnit(a, b, c) {
  let h = (a | 0) * 73856093 ^ (b | 0) * 19349663 ^ (c | 0) * 83492791
  h = (h ^ (h >>> 16)) >>> 0
  h = Math.imul(h, 0x85ebca6b)
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h, 0xc2b2ae35)
  h = (h ^ (h >>> 16)) >>> 0
  return h / 4294967296
}

function getVertexPos(cellX, cellY, visitNum, cellSize) {
  const base =
    visitNum <= VISIT_OFFSETS.length
      ? VISIT_OFFSETS[visitNum - 1]
      : [
          (hashUnit(cellX, cellY, visitNum * 3) - 0.5) * 0.5,
          (hashUnit(cellX, cellY, visitNum * 3 + 1) - 0.5) * 0.5,
        ]

  // Small hand-drawn wobble (deterministic per vertex).
  const wobble = 0.06
  const jx = (hashUnit(cellX, cellY, visitNum * 5 + 1) - 0.5) * 2 * wobble
  const jy = (hashUnit(cellX, cellY, visitNum * 5 + 2) - 0.5) * 2 * wobble

  return {
    x: (cellX + 0.5 + base[0] + jx) * cellSize,
    y: (cellY + 0.5 + base[1] + jy) * cellSize,
  }
}

export function computeTrailDots(soulPath, cellSize, dotSpacingRatio = 0.22) {
  if (!Array.isArray(soulPath) || soulPath.length === 0) return []

  // Build polyline vertices, numbering visits per cell.
  const visitCount = new Map()
  const vertices = []
  for (const [x, y] of soulPath) {
    const key = `${x},${y}`
    const n = (visitCount.get(key) ?? 0) + 1
    visitCount.set(key, n)
    vertices.push(getVertexPos(x, y, n, cellSize))
  }

  if (vertices.length === 1) {
    return [{ x: vertices[0].x, y: vertices[0].y }]
  }

  // Walk the polyline, dropping a dot every `spacing` pixels.
  const spacing = Math.max(2, cellSize * dotSpacingRatio)
  const dots = [{ x: vertices[0].x, y: vertices[0].y }]
  let distToNextDot = spacing

  for (let i = 0; i < vertices.length - 1; i++) {
    const v1 = vertices[i]
    const v2 = vertices[i + 1]
    const dx = v2.x - v1.x
    const dy = v2.y - v1.y
    const segLen = Math.sqrt(dx * dx + dy * dy)
    if (segLen === 0) continue

    let traveled = 0
    while (traveled + distToNextDot <= segLen) {
      traveled += distToNextDot
      const t = traveled / segLen
      dots.push({
        x: v1.x + dx * t,
        y: v1.y + dy * t,
      })
      distToNextDot = spacing
    }
    distToNextDot -= segLen - traveled
  }

  return dots
}
