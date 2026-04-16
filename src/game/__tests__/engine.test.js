import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processKey, isHidden } from '../engine.js'

// processKey calls scrollToPoint which accesses document.body — stub it.
vi.stubGlobal('document', {
  body: { scrollLeft: 0, scrollTop: 0, scrollWidth: 2500, scrollHeight: 2500, scrollTo: vi.fn() },
  documentElement: { clientWidth: 1024, clientHeight: 768 },
  querySelector: () => null,
})

// localStorage stub for saveProgress
vi.stubGlobal('localStorage', {
  store: {},
  getItem(key) { return this.store[key] ?? null },
  setItem(key, val) { this.store[key] = val },
  removeItem(key) { delete this.store[key] },
})

function makeField(width, height, fill = 'empty') {
  return Array.from({ length: width }, () => Array.from({ length: height }, () => fill))
}

function makeGameData(overrides = {}) {
  const width = overrides.width ?? 10
  const height = overrides.height ?? 10
  const field = overrides.field ?? makeField(width, height)
  return {
    width,
    height,
    field,
    heroX: overrides.heroX ?? 5,
    heroY: overrides.heroY ?? 5,
    heroSight: overrides.heroSight ?? 5.5,
    cellSize: overrides.cellSize ?? 50,
    stepCtr: overrides.stepCtr ?? 0,
    soulTrack: overrides.soulTrack ?? {},
    soulPath: overrides.soulPath ?? [],
  }
}

describe('isHidden', () => {
  it('cell at hero position is visible', () => {
    expect(isHidden(5, 5, 5, 5, 5.5)).toBe(false)
  })

  it('adjacent cell is visible', () => {
    expect(isHidden(6, 5, 5, 5, 5.5)).toBe(false)
  })

  it('cell just within sight radius is visible', () => {
    expect(isHidden(10, 5, 5, 5, 5.5)).toBe(false) // distance = 5 < 5.5
  })

  it('cell just outside sight radius is hidden', () => {
    expect(isHidden(11, 5, 5, 5, 5.5)).toBe(true) // distance = 6 > 5.5
  })

  it('diagonal cell respects euclidean distance', () => {
    // distance = sqrt(3^2 + 4^2) = 5, sight = 5.5 → visible
    expect(isHidden(8, 9, 5, 5, 5.5)).toBe(false)
    // distance = sqrt(4^2 + 4^2) ≈ 5.66, sight = 5.5 → hidden
    expect(isHidden(9, 9, 5, 5, 5.5)).toBe(true)
  })
})

describe('processKey', () => {
  beforeEach(() => {
    localStorage.store = {}
  })

  it('moves hero right on ArrowRight', () => {
    const data = makeGameData()
    const result = processKey('ArrowRight', data)
    expect(data.heroX).toBe(6)
    expect(data.heroY).toBe(5)
    expect(result.isMoved).toBe(true)
  })

  it('moves hero left on ArrowLeft', () => {
    const data = makeGameData()
    processKey('ArrowLeft', data)
    expect(data.heroX).toBe(4)
  })

  it('moves hero up on ArrowUp', () => {
    const data = makeGameData()
    processKey('ArrowUp', data)
    expect(data.heroY).toBe(4)
  })

  it('moves hero down on ArrowDown', () => {
    const data = makeGameData()
    processKey('ArrowDown', data)
    expect(data.heroY).toBe(6)
  })

  it('does not move into wall', () => {
    const data = makeGameData()
    data.field[6][5] = 'wall'
    const result = processKey('ArrowRight', data)
    expect(data.heroX).toBe(5)
    expect(result.isMoved).toBe(false)
  })

  it('does not move outside field boundaries', () => {
    const data = makeGameData({ heroX: 0 })
    processKey('ArrowLeft', data)
    expect(data.heroX).toBe(0)
  })

  it('increments step counter on every key press', () => {
    const data = makeGameData()
    processKey('ArrowRight', data)
    expect(data.stepCtr).toBe(1)
    processKey('ArrowRight', data)
    expect(data.stepCtr).toBe(2)
  })

  it('increments step counter even when blocked', () => {
    const data = makeGameData({ heroX: 0 })
    processKey('ArrowLeft', data)
    expect(data.stepCtr).toBe(1)
  })

  it('decreases sight every 20 steps', () => {
    const data = makeGameData({ stepCtr: 19, heroSight: 5.5 })
    processKey('ArrowRight', data) // stepCtr becomes 20
    expect(data.heroSight).toBe(4.5)
  })

  it('does not decrease sight below 2', () => {
    const data = makeGameData({ stepCtr: 19, heroSight: 2 })
    processKey('ArrowRight', data)
    expect(data.heroSight).toBe(1)

    data.stepCtr = 19
    data.heroSight = 1
    processKey('ArrowRight', data)
    // heroSight 1 < 2, so decreaseSight does nothing
    expect(data.heroSight).toBe(1)
  })

  it('resets sight on lamp cell', () => {
    const data = makeGameData({ heroSight: 2 })
    data.field[6][5] = 'lamp'
    processKey('ArrowRight', data)
    expect(data.heroSight).toBe(5.5)
    expect(data.stepCtr).toBe(0) // lamp resets step counter
  })

  it('records soul track on move', () => {
    const data = makeGameData()
    processKey('ArrowRight', data)
    expect(data.soulTrack['6,5']).toBe(1)
    processKey('ArrowLeft', data)
    processKey('ArrowRight', data)
    expect(data.soulTrack['6,5']).toBe(2)
  })

  it('records soul path on move', () => {
    const data = makeGameData()
    processKey('ArrowRight', data)
    processKey('ArrowDown', data)
    expect(data.soulPath).toEqual([[6, 5], [6, 6]])
  })

  it('does not record soul track/path when blocked', () => {
    const data = makeGameData({ heroX: 0 })
    processKey('ArrowLeft', data)
    expect(data.soulPath).toEqual([])
    expect(Object.keys(data.soulTrack)).toHaveLength(0)
  })

  it('detects reaching finish', () => {
    const data = makeGameData()
    data.field[6][5] = 'finish'
    const result = processKey('ArrowRight', data)
    expect(result.reachedFinish).toBe(true)
  })

  it('returns reachedFinish false on normal cells', () => {
    const data = makeGameData()
    const result = processKey('ArrowRight', data)
    expect(result.reachedFinish).toBe(false)
  })
})
