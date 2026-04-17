import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveProgress, loadProgress, clearProgress } from '../progressStorage.js'

vi.stubGlobal('localStorage', {
  store: {},
  getItem(key) { return this.store[key] ?? null },
  setItem(key, val) { this.store[key] = val },
  removeItem(key) { delete this.store[key] },
})

function makeField(width, height, fill = 'empty') {
  return Array.from({ length: width }, () =>
    Array.from({ length: height }, () => fill),
  )
}

beforeEach(() => {
  localStorage.store = {}
})

describe('saveProgress / loadProgress round-trip', () => {
  it('preserves all state fields', () => {
    const data = {
      field: makeField(10, 10),
      heroX: 3,
      heroY: 4,
      heroSight: 4.5,
      stepCtr: 7,
      soulTrack: { '3,4': 1, '2,4': 2 },
      soulPath: [[2, 4], [3, 4]],
    }
    saveProgress(data)
    const loaded = loadProgress(10, 10)
    expect(loaded).toEqual(data)
  })

  it('returns null when nothing has been saved', () => {
    expect(loadProgress(10, 10)).toBeNull()
  })

  it('falls back to defaults for missing soulTrack/soulPath', () => {
    localStorage.setItem('a-maze-ing-progress-v1', JSON.stringify({
      field: makeField(5, 5),
      heroX: 0, heroY: 0, heroSight: 5.5, stepCtr: 0,
    }))
    const loaded = loadProgress(5, 5)
    expect(loaded.soulTrack).toEqual({})
    expect(loaded.soulPath).toEqual([])
  })
})

describe('loadProgress validation', () => {
  function setRaw(payload) {
    localStorage.setItem('a-maze-ing-progress-v1', JSON.stringify(payload))
  }

  const valid = () => ({
    field: makeField(10, 10),
    heroX: 5, heroY: 5, heroSight: 5.5, stepCtr: 0,
    soulTrack: {}, soulPath: [],
  })

  it('returns null for malformed JSON', () => {
    localStorage.setItem('a-maze-ing-progress-v1', '{not json')
    expect(loadProgress(10, 10)).toBeNull()
  })

  it('returns null when field dimensions do not match', () => {
    setRaw(valid())
    expect(loadProgress(20, 20)).toBeNull()
  })

  it('returns null when field is missing', () => {
    setRaw({ ...valid(), field: undefined })
    expect(loadProgress(10, 10)).toBeNull()
  })

  it('returns null when field has wrong inner shape', () => {
    setRaw({ ...valid(), field: [['empty'], 'wat'] })
    expect(loadProgress(10, 10)).toBeNull()
  })

  it('returns null when hero is out of bounds', () => {
    setRaw({ ...valid(), heroX: -1 })
    expect(loadProgress(10, 10)).toBeNull()
    setRaw({ ...valid(), heroX: 10 })
    expect(loadProgress(10, 10)).toBeNull()
    setRaw({ ...valid(), heroY: 99 })
    expect(loadProgress(10, 10)).toBeNull()
  })

  it('returns null when heroSight is not a finite number', () => {
    setRaw({ ...valid(), heroSight: 'a lot' })
    expect(loadProgress(10, 10)).toBeNull()
  })

  it('returns null when stepCtr is negative', () => {
    setRaw({ ...valid(), stepCtr: -3 })
    expect(loadProgress(10, 10)).toBeNull()
  })
})

describe('clearProgress', () => {
  it('removes the saved progress', () => {
    saveProgress({
      field: makeField(10, 10),
      heroX: 0, heroY: 0, heroSight: 5.5, stepCtr: 0,
      soulTrack: {}, soulPath: [],
    })
    expect(loadProgress(10, 10)).not.toBeNull()
    clearProgress()
    expect(loadProgress(10, 10)).toBeNull()
  })
})
