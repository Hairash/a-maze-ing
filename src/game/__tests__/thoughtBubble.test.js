// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  initialThoughtBubbleState,
  hideBubble,
  hideOldestBubble,
  onMove,
  onLevelComplete,
  onMapRevealed,
} from '../thoughtBubble.js'

// Stub timers so idle scheduling doesn't leak
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function makeField(width, height, fill = 'empty') {
  return Array.from({ length: width }, () =>
    Array.from({ length: height }, () => fill),
  )
}

function makeData(overrides = {}) {
  const width = overrides.width ?? 10
  const height = overrides.height ?? 10
  return {
    width,
    height,
    field: overrides.field ?? makeField(width, height),
    heroX: overrides.heroX ?? 5,
    heroY: overrides.heroY ?? 5,
    heroSight: overrides.heroSight ?? 5.5,
    stepCtr: overrides.stepCtr ?? 1,
    soulTrack: overrides.soulTrack ?? {},
    levelComplete: overrides.levelComplete ?? false,
    mapRevealed: overrides.mapRevealed ?? false,
    ...initialThoughtBubbleState(),
    ...overrides.thoughtOverrides,
  }
}

describe('initialThoughtBubbleState', () => {
  it('returns expected shape', () => {
    const state = initialThoughtBubbleState()
    expect(state.thoughtBubbles).toEqual([])
    expect(state.thoughtGroupLastMoves).toEqual({})
    expect(state.thoughtMoveCount).toBe(0)
    expect(state.thoughtPrevHeroSight).toBeNull()
    expect(state.thoughtNextBubbleId).toBe(1)
  })
})

describe('onLevelComplete', () => {
  it('shows a bubble from the levelComplete group', () => {
    const data = makeData({ levelComplete: true })
    data.thoughtPrevHeroSight = 5.5
    onLevelComplete(data)
    expect(data.thoughtBubbles).toHaveLength(1)
    expect(data.thoughtBubbles[0].group).toBe('levelComplete')
    expect(data.thoughtBubbles[0].text).toBeTruthy()
  })
})

describe('onMapRevealed', () => {
  it('shows a bubble from the mapRevealed group', () => {
    const data = makeData({ mapRevealed: true })
    data.thoughtPrevHeroSight = 5.5
    onMapRevealed(data)
    expect(data.thoughtBubbles).toHaveLength(1)
    expect(data.thoughtBubbles[0].group).toBe('mapRevealed')
  })
})

describe('group cooldown', () => {
  it('does not fire the same group twice within cooldown', () => {
    const data = makeData({ levelComplete: true })
    data.thoughtPrevHeroSight = 5.5
    onLevelComplete(data)
    expect(data.thoughtBubbles).toHaveLength(1)

    // Clear bubble, try again at same move count
    data.thoughtBubbles = []
    onLevelComplete(data)
    expect(data.thoughtBubbles).toHaveLength(0)
  })

  it('fires again after cooldown moves have passed', () => {
    const data = makeData({ levelComplete: true })
    data.thoughtPrevHeroSight = 5.5
    onLevelComplete(data)
    expect(data.thoughtBubbles).toHaveLength(1)

    data.thoughtBubbles = []
    data.thoughtMoveCount = 200 // well past 100-move cooldown
    onLevelComplete(data)
    expect(data.thoughtBubbles).toHaveLength(1)
  })
})

describe('bubble slots', () => {
  it('assigns different slots to concurrent bubbles', () => {
    const data = makeData()
    data.thoughtPrevHeroSight = 5.5

    // Fire multiple groups
    data.levelComplete = true
    onLevelComplete(data)
    data.thoughtMoveCount = 200
    data.mapRevealed = true
    onMapRevealed(data)

    expect(data.thoughtBubbles).toHaveLength(2)
    const slots = data.thoughtBubbles.map((b) => b.slot)
    expect(new Set(slots).size).toBe(2)
  })

  it('rejects a 5th bubble when all 4 slots are occupied', () => {
    const data = makeData()
    data.thoughtPrevHeroSight = 5.5

    // Manually fill 4 slots
    for (let i = 0; i < 4; i++) {
      data.thoughtBubbles.push({
        id: i + 1,
        text: 'test',
        slot: ['top-right', 'top-left', 'bottom-right', 'bottom-left'][i],
        group: `group${i}`,
        hideTimerId: null,
        moveAtShow: 0,
        maxMoves: 999,
      })
    }
    data.thoughtNextBubbleId = 5

    data.levelComplete = true
    onLevelComplete(data)
    // Should still be 4 — no slot was free
    expect(data.thoughtBubbles).toHaveLength(4)
  })
})

describe('onMove — visibility-decreased event', () => {
  it('fires when sight drops', () => {
    const data = makeData({ heroSight: 4.5 })
    data.thoughtPrevHeroSight = 5.5
    data.thoughtPrevVisibleLampKeys = []
    data.thoughtPrevFinishVisible = false

    onMove(data)
    const vdBubble = data.thoughtBubbles.find(
      (b) => b.group === 'visibilityDecreased',
    )
    expect(vdBubble).toBeTruthy()
  })

  it('does not fire when sight stays the same', () => {
    const data = makeData({ heroSight: 5.5 })
    data.thoughtPrevHeroSight = 5.5
    data.thoughtPrevVisibleLampKeys = []
    data.thoughtPrevFinishVisible = false

    onMove(data)
    const vdBubble = data.thoughtBubbles.find(
      (b) => b.group === 'visibilityDecreased',
    )
    expect(vdBubble).toBeUndefined()
  })
})

describe('onMove — discovery event', () => {
  it('fires when a lamp comes into sight', () => {
    const data = makeData({ heroSight: 5.5 })
    // Place a lamp within sight
    data.field[6][5] = 'lamp'
    data.thoughtPrevHeroSight = 5.5
    data.thoughtPrevVisibleLampKeys = [] // lamp was not visible before
    data.thoughtPrevFinishVisible = false

    onMove(data)
    const dBubble = data.thoughtBubbles.find((b) => b.group === 'discovery')
    expect(dBubble).toBeTruthy()
  })

  it('does not fire when lamp was already visible', () => {
    const data = makeData({ heroSight: 5.5 })
    data.field[6][5] = 'lamp'
    data.thoughtPrevHeroSight = 5.5
    data.thoughtPrevVisibleLampKeys = ['6,5'] // already visible
    data.thoughtPrevFinishVisible = false

    onMove(data)
    const dBubble = data.thoughtBubbles.find((b) => b.group === 'discovery')
    expect(dBubble).toBeUndefined()
  })

  it('does not detect lamp outside sight radius', () => {
    const data = makeData({ heroX: 0, heroY: 0, heroSight: 1 })
    data.field[5][5] = 'lamp' // far away
    data.thoughtPrevHeroSight = 1
    data.thoughtPrevVisibleLampKeys = []
    data.thoughtPrevFinishVisible = false

    onMove(data)
    const dBubble = data.thoughtBubbles.find((b) => b.group === 'discovery')
    expect(dBubble).toBeUndefined()
  })
})

describe('onMove — geometry event', () => {
  it('fires on dead end', () => {
    const data = makeData({ heroX: 1, heroY: 0 })
    // Surround hero: wall on right, top, bottom; only left is open
    data.field[2][0] = 'wall'
    data.field[1][1] = 'wall'
    // heroY is 0, so up is out of bounds (counts as blocked)
    data.thoughtPrevHeroSight = 5.5
    data.thoughtPrevVisibleLampKeys = []
    data.thoughtPrevFinishVisible = false

    onMove(data)
    const gBubble = data.thoughtBubbles.find((b) => b.group === 'geometry')
    expect(gBubble).toBeTruthy()
  })

  it('fires on revisited cell', () => {
    const data = makeData()
    data.soulTrack = { '5,5': 2 }
    data.thoughtPrevHeroSight = 5.5
    data.thoughtPrevVisibleLampKeys = []
    data.thoughtPrevFinishVisible = false

    onMove(data)
    const gBubble = data.thoughtBubbles.find((b) => b.group === 'geometry')
    expect(gBubble).toBeTruthy()
  })
})

describe('onMove — on-lamp event', () => {
  it('fires when standing on lamp', () => {
    const data = makeData()
    data.field[5][5] = 'lamp'
    data.thoughtPrevHeroSight = 5.5
    data.thoughtPrevVisibleLampKeys = ['5,5']
    data.thoughtPrevFinishVisible = false

    onMove(data)
    const lBubble = data.thoughtBubbles.find((b) => b.group === 'onLamp')
    expect(lBubble).toBeTruthy()
  })
})

describe('bubble expiry by moves', () => {
  it('removes bubble after maxMoves', () => {
    const data = makeData()
    data.thoughtPrevHeroSight = 5.5
    data.thoughtPrevVisibleLampKeys = []
    data.thoughtPrevFinishVisible = false

    // Manually add a bubble with low maxMoves
    data.thoughtBubbles.push({
      id: 99,
      text: 'test',
      slot: 'top-right',
      group: 'test',
      hideTimerId: null,
      moveAtShow: 0,
      maxMoves: 3,
    })

    data.thoughtMoveCount = 1
    onMove(data) // moveCount becomes 2, 2 - 0 < 3 → still alive
    expect(data.thoughtBubbles.find((b) => b.id === 99)).toBeTruthy()

    onMove(data) // moveCount becomes 3, 3 - 0 >= 3 → expire
    expect(data.thoughtBubbles.find((b) => b.id === 99)).toBeUndefined()
  })
})

describe('manual bubble dismiss', () => {
  it('hides bubble by id and clears its timer', () => {
    const data = makeData()
    const timerId = window.setTimeout(() => {}, 5000)
    data.thoughtBubbles = [{
      id: 5,
      text: 'test',
      slot: 'top-right',
      group: 'test',
      hideTimerId: timerId,
      moveAtShow: 0,
      maxMoves: 20,
    }]

    expect(hideBubble(data, 5)).toBe(true)
    expect(data.thoughtBubbles).toHaveLength(0)
  })

  it('hides oldest displayed bubble', () => {
    const data = makeData()
    data.thoughtBubbles = [
      {
        id: 2,
        text: 'newer',
        slot: 'top-right',
        group: 'test',
        hideTimerId: null,
        moveAtShow: 12,
        maxMoves: 20,
      },
      {
        id: 1,
        text: 'older',
        slot: 'top-left',
        group: 'test',
        hideTimerId: null,
        moveAtShow: 3,
        maxMoves: 20,
      },
    ]

    expect(hideOldestBubble(data)).toBe(true)
    expect(data.thoughtBubbles).toHaveLength(1)
    expect(data.thoughtBubbles[0].id).toBe(2)
  })
})
