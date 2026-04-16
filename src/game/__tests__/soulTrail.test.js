import { describe, it, expect } from 'vitest'
import { computeTrailDots } from '../soulTrail.js'

describe('computeTrailDots', () => {
  it('returns empty array for empty path', () => {
    expect(computeTrailDots([], 50)).toEqual([])
    expect(computeTrailDots(null, 50)).toEqual([])
    expect(computeTrailDots(undefined, 50)).toEqual([])
  })

  it('returns a single dot for a single-step path', () => {
    const dots = computeTrailDots([[3, 4]], 50)
    expect(dots).toHaveLength(1)
    // Should be near cell center (3.5 * 50, 4.5 * 50) with small jitter
    expect(dots[0].x).toBeCloseTo(3.5 * 50, -1)
    expect(dots[0].y).toBeCloseTo(4.5 * 50, -1)
  })

  it('produces dots along a straight horizontal path', () => {
    const path = [[0, 0], [1, 0], [2, 0], [3, 0]]
    const cellSize = 50
    const dots = computeTrailDots(path, cellSize)

    expect(dots.length).toBeGreaterThan(4)

    // All dots should have y near the cell center row (0.5 * 50 = 25, with jitter)
    for (const dot of dots) {
      expect(dot.y).toBeGreaterThan(0)
      expect(dot.y).toBeLessThan(cellSize)
    }

    // Dots should progress left to right overall
    for (let i = 1; i < dots.length; i++) {
      expect(dots[i].x).toBeGreaterThanOrEqual(dots[i - 1].x - 1)
    }
  })

  it('dots are approximately evenly spaced', () => {
    const path = [[0, 0], [1, 0], [2, 0]]
    const cellSize = 100
    const dots = computeTrailDots(path, cellSize)

    const expectedSpacing = cellSize * 0.22
    const distances = []
    for (let i = 1; i < dots.length; i++) {
      const dx = dots[i].x - dots[i - 1].x
      const dy = dots[i].y - dots[i - 1].y
      distances.push(Math.sqrt(dx * dx + dy * dy))
    }

    // All inter-dot distances should be close to the expected spacing
    // (some variance is expected at segment boundaries)
    for (const d of distances) {
      expect(d).toBeLessThanOrEqual(expectedSpacing * 1.5)
    }
  })

  it('continuity: dots cross cell boundaries without large gaps', () => {
    const path = [[0, 0], [1, 0], [2, 0]]
    const cellSize = 50
    const dots = computeTrailDots(path, cellSize)
    const maxGap = cellSize * 0.35

    for (let i = 1; i < dots.length; i++) {
      const dx = dots[i].x - dots[i - 1].x
      const dy = dots[i].y - dots[i - 1].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      expect(dist).toBeLessThanOrEqual(maxGap)
    }
  })

  it('multiple visits to the same cell produce offset lines', () => {
    // Go right then left then right through cell (1,0)
    const path = [[0, 0], [1, 0], [2, 0], [1, 0], [0, 0], [1, 0]]
    const cellSize = 100
    const dots = computeTrailDots(path, cellSize)

    // Filter dots that fall within cell (1,0) boundaries
    const cellDots = dots.filter(
      (d) => d.x >= 100 && d.x <= 200 && d.y >= 0 && d.y <= 100,
    )

    // Should have dots from multiple passes, not all on the same y
    const uniqueYs = new Set(cellDots.map((d) => Math.round(d.y / 5)))
    expect(uniqueYs.size).toBeGreaterThan(1)
  })

  it('is deterministic — same input always produces same output', () => {
    const path = [[0, 0], [1, 0], [1, 1], [2, 1]]
    const dots1 = computeTrailDots(path, 50)
    const dots2 = computeTrailDots(path, 50)

    expect(dots1).toEqual(dots2)
  })

  it('handles vertical movement', () => {
    const path = [[0, 0], [0, 1], [0, 2], [0, 3]]
    const cellSize = 50
    const dots = computeTrailDots(path, cellSize)

    expect(dots.length).toBeGreaterThan(4)

    // Dots should progress downward overall
    for (let i = 1; i < dots.length; i++) {
      expect(dots[i].y).toBeGreaterThanOrEqual(dots[i - 1].y - 1)
    }
  })

  it('respects custom dotSpacingRatio', () => {
    const path = [[0, 0], [1, 0], [2, 0]]
    const cellSize = 100
    const dotsNarrow = computeTrailDots(path, cellSize, 0.1)
    const dotsWide = computeTrailDots(path, cellSize, 0.5)

    // Narrower spacing = more dots
    expect(dotsNarrow.length).toBeGreaterThan(dotsWide.length)
  })
})
