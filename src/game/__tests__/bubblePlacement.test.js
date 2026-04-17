import { describe, it, expect } from 'vitest'
import {
  isMobileViewport,
  computeBubbleSize,
  getHeroViewportZone,
  getLayoutSlots,
  slotToRect,
  reconcilePlacements,
} from '../bubblePlacement.js'

const PC_VIEWPORT = { viewportWidth: 1920, viewportHeight: 1080 }
const MOBILE_VIEWPORT = { viewportWidth: 400, viewportHeight: 800 }
const BOARD = { width: 50, height: 50, cellSize: 50 }

function ctx(overrides = {}) {
  return { ...BOARD, ...PC_VIEWPORT, heroX: 25, heroY: 25, ...overrides }
}

describe('isMobileViewport', () => {
  it('treats <=768 as mobile', () => {
    expect(isMobileViewport(768)).toBe(true)
    expect(isMobileViewport(400)).toBe(true)
  })
  it('treats >768 as desktop', () => {
    expect(isMobileViewport(769)).toBe(false)
    expect(isMobileViewport(1920)).toBe(false)
  })
})

describe('computeBubbleSize', () => {
  it('width grows with text length', () => {
    const small = computeBubbleSize('a', 1920)
    const big = computeBubbleSize('a'.repeat(80), 1920)
    expect(big.width).toBeGreaterThan(small.width)
  })
  it('clamps to a max width on desktop', () => {
    const huge = computeBubbleSize('a'.repeat(500), 1920)
    expect(huge.width).toBeLessThanOrEqual(340)
  })
  it('preserves the bubble image aspect ratio', () => {
    const { width, height } = computeBubbleSize('hello world', 1920)
    expect(width / height).toBeCloseTo(1085 / 768, 2)
  })
  it('shrinks on narrow viewports', () => {
    const desktop = computeBubbleSize('hello world', 1920)
    const mobile = computeBubbleSize('hello world', 400)
    expect(mobile.width).toBeLessThanOrEqual(desktop.width)
  })
})

describe('getHeroViewportZone', () => {
  it('hero centered in a large viewport → center,center', () => {
    expect(getHeroViewportZone(ctx({ heroX: 25, heroY: 25 }))).toEqual({ h: 'center', v: 'center' })
  })
  it('hero at top-left of map → left,top (scroll clamped)', () => {
    expect(getHeroViewportZone(ctx({ heroX: 0, heroY: 0 }))).toEqual({ h: 'left', v: 'top' })
  })
  it('hero at bottom-right of map → right,bottom', () => {
    expect(getHeroViewportZone(ctx({ heroX: 49, heroY: 49 }))).toEqual({ h: 'right', v: 'bottom' })
  })
  it('hero at left edge but vertically centered → left,center', () => {
    expect(getHeroViewportZone(ctx({ heroX: 0, heroY: 25 }))).toEqual({ h: 'left', v: 'center' })
  })
  it('hero one cell from center is still classified as center (tolerance)', () => {
    expect(getHeroViewportZone(ctx({ heroX: 25, heroY: 25 }))).toEqual({ h: 'center', v: 'center' })
  })
  it('mobile: hero at top of map → left,top with clamped scroll', () => {
    const z = getHeroViewportZone({ ...BOARD, ...MOBILE_VIEWPORT, heroX: 0, heroY: 0 })
    expect(z.h).toBe('left')
    expect(z.v).toBe('top')
  })
})

describe('getLayoutSlots — desktop', () => {
  it('hero centered → one bubble per corner', () => {
    const slots = getLayoutSlots({ h: 'center', v: 'center' }, { isMobile: false })
    const corners = slots.map((s) => s.corner).sort()
    expect(corners).toEqual(['bottom-left', 'bottom-right', 'top-left', 'top-right'])
  })
  it('hero on the left → all 4 on the right side', () => {
    const slots = getLayoutSlots({ h: 'left', v: 'center' }, { isMobile: false })
    expect(slots.every((s) => s.corner === 'top-right' || s.corner === 'bottom-right')).toBe(true)
  })
  it('hero on the right → all 4 on the left side', () => {
    const slots = getLayoutSlots({ h: 'right', v: 'center' }, { isMobile: false })
    expect(slots.every((s) => s.corner === 'top-left' || s.corner === 'bottom-left')).toBe(true)
  })
  it('always returns 4 unique (corner,offset) slots', () => {
    for (const h of ['left', 'center', 'right']) {
      const slots = getLayoutSlots({ h, v: 'center' }, { isMobile: false })
      expect(slots.length).toBe(4)
      const keys = new Set(slots.map((s) => `${s.corner}:${s.offset}`))
      expect(keys.size).toBe(4)
    }
  })
})

describe('getLayoutSlots — mobile', () => {
  it('never uses bottom-right (move pad lives there)', () => {
    for (const h of ['left', 'center', 'right']) {
      for (const v of ['top', 'center', 'bottom']) {
        const slots = getLayoutSlots({ h, v }, { isMobile: true })
        expect(slots.some((s) => s.corner === 'bottom-right')).toBe(false)
      }
    }
  })
  it('hero centered → top-right + top-left + 2× bottom-left', () => {
    const slots = getLayoutSlots({ h: 'center', v: 'center' }, { isMobile: true })
    const keys = slots.map((s) => `${s.corner}:${s.offset}`)
    expect(keys).toEqual([
      'top-right:0',
      'top-left:0',
      'bottom-left:0',
      'bottom-left:1',
    ])
  })
  it('hero in bottom half → all 4 on top', () => {
    const slots = getLayoutSlots({ h: 'center', v: 'bottom' }, { isMobile: true })
    expect(slots.every((s) => s.corner === 'top-right' || s.corner === 'top-left')).toBe(true)
  })
  it('hero in top half + left horiz → 2 bottom-left + 2 top-right', () => {
    const slots = getLayoutSlots({ h: 'left', v: 'top' }, { isMobile: true })
    const counts = countCorners(slots)
    expect(counts['bottom-left']).toBe(2)
    expect(counts['top-right']).toBe(2)
  })
  it('hero in top half + right horiz → 2 bottom-left + 2 top-left', () => {
    const slots = getLayoutSlots({ h: 'right', v: 'top' }, { isMobile: true })
    const counts = countCorners(slots)
    expect(counts['bottom-left']).toBe(2)
    expect(counts['top-left']).toBe(2)
  })
  it('hero in top half + center horiz → 2 bottom-left + top-right + top-left', () => {
    const slots = getLayoutSlots({ h: 'center', v: 'top' }, { isMobile: true })
    const counts = countCorners(slots)
    expect(counts['bottom-left']).toBe(2)
    expect(counts['top-right']).toBe(1)
    expect(counts['top-left']).toBe(1)
  })
  it('always returns 4 unique slots regardless of zone', () => {
    for (const h of ['left', 'center', 'right']) {
      for (const v of ['top', 'center', 'bottom']) {
        const slots = getLayoutSlots({ h, v }, { isMobile: true })
        expect(slots.length).toBe(4)
        const keys = new Set(slots.map((s) => `${s.corner}:${s.offset}`))
        expect(keys.size).toBe(4)
      }
    }
  })
})

function countCorners(slots) {
  return slots.reduce((acc, s) => {
    acc[s.corner] = (acc[s.corner] ?? 0) + 1
    return acc
  }, {})
}

describe('slotToRect', () => {
  const vp = { viewportWidth: 1000, viewportHeight: 800 }
  const size = { width: 200, height: 100 }
  const margin = 8
  const stackGap = 16
  const expectedMaxX = 1000 - 200 - margin

  it('top-right corner sits at the right edge, top margin', () => {
    const r = slotToRect({ corner: 'top-right', offset: 0 }, size, vp)
    expect(r.left).toBe(expectedMaxX)
    expect(r.top).toBe(margin)
  })
  it('top-left corner sits at the left edge, top margin', () => {
    const r = slotToRect({ corner: 'top-left', offset: 0 }, size, vp)
    expect(r.left).toBe(margin)
    expect(r.top).toBe(margin)
  })
  it('bottom corners use bottom margin', () => {
    const r = slotToRect({ corner: 'bottom-right', offset: 0 }, size, vp)
    expect(r.top).toBe(800 - 100 - margin)
  })
  it('offset 1 stacks inward from a top corner (downward)', () => {
    const r0 = slotToRect({ corner: 'top-right', offset: 0 }, size, vp)
    const r1 = slotToRect({ corner: 'top-right', offset: 1 }, size, vp)
    expect(r1.top).toBe(r0.top + size.height + stackGap)
  })
  it('offset 1 stacks inward from a bottom corner (upward)', () => {
    const r0 = slotToRect({ corner: 'bottom-left', offset: 0 }, size, vp)
    const r1 = slotToRect({ corner: 'bottom-left', offset: 1 }, size, vp)
    expect(r1.top).toBe(r0.top - size.height - stackGap)
  })
})

describe('reconcilePlacements — sticky behaviour', () => {
  it('preserves placements for bubbles still present', () => {
    const bubbles = [{ id: 1, text: 'first' }]
    const initial = reconcilePlacements(bubbles, {}, ctx())
    expect(initial[1]).toBeTruthy()
    const next = reconcilePlacements(bubbles, initial, ctx({ heroX: 0, heroY: 0 }))
    // Hero moved to a different zone, but bubble 1 stays at the same place.
    expect(next[1]).toEqual(initial[1])
  })
  it('drops placements for bubbles no longer in the list', () => {
    const initial = reconcilePlacements([{ id: 1, text: 'a' }, { id: 2, text: 'b' }], {}, ctx())
    expect(Object.keys(initial)).toHaveLength(2)
    const next = reconcilePlacements([{ id: 2, text: 'b' }], initial, ctx())
    expect(next[1]).toBeUndefined()
    expect(next[2]).toEqual(initial[2])
  })
  it('a new bubble takes the first slot not occupied by cached placements', () => {
    // Hero centered on PC → slots are top-right, top-left, bottom-right, bottom-left.
    const placements = reconcilePlacements([{ id: 1, text: 'a' }], {}, ctx())
    expect(placements[1].corner).toBe('top-right')
    const placements2 = reconcilePlacements(
      [{ id: 1, text: 'a' }, { id: 2, text: 'b' }],
      placements,
      ctx(),
    )
    expect(placements2[2].corner).toBe('top-left')
  })
  it('fills 4 bubbles into 4 distinct slots', () => {
    const bubbles = [1, 2, 3, 4].map((id) => ({ id, text: 'msg' }))
    const placements = reconcilePlacements(bubbles, {}, ctx())
    const keys = new Set(
      Object.values(placements).map((p) => `${p.corner}:${p.offset}`),
    )
    expect(keys.size).toBe(4)
  })
  it('a 5th bubble has nowhere to go and is skipped', () => {
    const bubbles = [1, 2, 3, 4, 5].map((id) => ({ id, text: 'msg' }))
    const placements = reconcilePlacements(bubbles, {}, ctx())
    expect(placements[5]).toBeUndefined()
    expect(Object.keys(placements)).toHaveLength(4)
  })
  it('zone change: cached bubble keeps its slot; new bubble uses new zone', () => {
    // Centered → bubble 1 placed at top-right.
    const p1 = reconcilePlacements([{ id: 1, text: 'a' }], {}, ctx())
    expect(p1[1].corner).toBe('top-right')

    // Hero moves to right → all-bubbles-on-left zone. New bubble must go
    // to top-left or bottom-left (not top-right, that slot is still
    // logically taken by the cached bubble).
    const p2 = reconcilePlacements(
      [{ id: 1, text: 'a' }, { id: 2, text: 'b' }],
      p1,
      ctx({ heroX: 49, heroY: 25 }),
    )
    expect(p2[1].corner).toBe('top-right') // unchanged
    expect(['top-left', 'bottom-left']).toContain(p2[2].corner)
  })
  it('records flipX/flipY based on corner', () => {
    const bubbles = [1, 2, 3, 4].map((id) => ({ id, text: 'msg' }))
    const placements = reconcilePlacements(bubbles, {}, ctx())
    for (const p of Object.values(placements)) {
      const expectedFlipX = p.corner.endsWith('-left')
      const expectedFlipY = p.corner.startsWith('bottom-')
      expect(p.flipX).toBe(expectedFlipX)
      expect(p.flipY).toBe(expectedFlipY)
    }
  })
})
