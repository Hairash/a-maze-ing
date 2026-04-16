// Thought bubble logic.
//
// Thoughts are organised into GROUPS. Active groups fire when a matching
// event is detected (e.g. sight just dropped, lamp came into sight). The
// passive group fires on an idle timer. Each group has its own cooldown so
// thoughts from the same group don't stack up. Multiple groups can be on
// screen at once, each in its own corner slot.
//
// Conditions are always evaluated against information the player can see —
// cells outside the current sight radius are ignored.

import { THOUGHTS } from './thoughts.js'
import { isHidden } from './engine.js'

// ============================================================
// TUNING CONSTANTS
// ============================================================

// Minimum moves between two thoughts from the same group.
const GROUP_COOLDOWN_MOVES = 100

// Passive idle timer: every N seconds we try to fire a passive thought
// (subject to the passive cooldown).
const PASSIVE_IDLE_SECONDS_MIN = 20
const PASSIVE_IDLE_SECONDS_MAX = 40

// How long a bubble stays on screen (whichever of the two limits hits first).
const BUBBLE_VISIBLE_SECONDS_MIN = 10
const BUBBLE_VISIBLE_SECONDS_MAX = 20
const BUBBLE_VISIBLE_MOVES_MIN = 20
const BUBBLE_VISIBLE_MOVES_MAX = 40

// Condition thresholds.
const REPEATED_VISIT_COUNT = 2
const DEAD_END_MAX_OPEN_NEIGHBOURS = 1
const MANY_WALLS_MIN_VISIBLE = 9
const STEP_MILESTONE_INTERVAL = 12
const LOW_SIGHT_THRESHOLD = 3
const VERY_LOW_SIGHT_THRESHOLD = 1.5

// Sight decreases every SIGHT_DROP_PERIOD steps. The "sight drop soon" hint
// becomes eligible in the last SIGHT_DROP_WARNING_WINDOW steps of the period.
const SIGHT_DROP_PERIOD = 20
const SIGHT_DROP_WARNING_WINDOW = 3

// Maximum bubbles on screen at once (one per slot).
const BUBBLE_SLOTS = ['top-right', 'top-left', 'bottom-right', 'bottom-left']

// ============================================================
// GROUPS
// ============================================================

const GROUPS = {
  LEVEL_COMPLETE: 'levelComplete',
  MAP_REVEALED: 'mapRevealed',
  DISCOVERY: 'discovery',
  ON_LAMP: 'onLamp',
  VISIBILITY_DECREASED: 'visibilityDecreased',
  GEOMETRY: 'geometry',
  PASSIVE: 'passive',
}

// ============================================================
// INITIAL STATE
// ============================================================

export function initialThoughtBubbleState() {
  return {
    thoughtBubbles: [],
    thoughtGroupLastMoves: {},
    thoughtMoveCount: 0,
    thoughtPrevHeroSight: null,
    thoughtPrevVisibleLampKeys: [],
    thoughtPrevFinishVisible: false,
    thoughtPassiveIdleTimerId: null,
    thoughtNextBubbleId: 1,
  }
}

// ============================================================
// LIFECYCLE
// ============================================================

export function startThoughtBubbleLoop(data) {
  resetThoughtState(data)
}

export function stopThoughtBubbleLoop(data) {
  cancelPassiveIdleTimer(data)
  clearAllBubbles(data)
}

// Reset cooldowns, prev-state tracking, and clear all bubbles. Called on
// initial mount and on level transition.
export function resetThoughtState(data) {
  cancelPassiveIdleTimer(data)
  clearAllBubbles(data)
  data.thoughtGroupLastMoves = {}
  data.thoughtMoveCount = 0
  data.thoughtPrevHeroSight = data.heroSight
  data.thoughtPrevVisibleLampKeys = computeVisibleLampKeys(data)
  data.thoughtPrevFinishVisible = isFinishVisible(data)
  schedulePassiveIdle(data)
}

// ============================================================
// EVENTS
// ============================================================

// Called after each successful hero move. Detects active events, evaluates
// cooldowns, and advances move counters / expiring bubbles.
export function onMove(data) {
  data.thoughtMoveCount++
  expireBubblesByMoves(data)

  const currentSight = data.heroSight
  const currentVisibleLampKeys = computeVisibleLampKeys(data)
  const currentFinishVisible = isFinishVisible(data)
  const currentCell = getCellAt(data, data.heroX, data.heroY)
  const currentVisits = data.soulTrack?.[`${data.heroX},${data.heroY}`] ?? 1
  const openNeighbours = countOpenNeighbours(data)

  // VISIBILITY_DECREASED: sight just dropped.
  if (
    data.thoughtPrevHeroSight !== null
    && currentSight > 0
    && currentSight < data.thoughtPrevHeroSight
  ) {
    tryFireGroup(data, GROUPS.VISIBILITY_DECREASED)
  }

  // DISCOVERY: a lamp or the finish just came into sight.
  const prevLamps = new Set(data.thoughtPrevVisibleLampKeys)
  const newLamp = currentVisibleLampKeys.some((k) => !prevLamps.has(k))
  const newFinish = currentFinishVisible && !data.thoughtPrevFinishVisible
  if (newLamp || newFinish) {
    tryFireGroup(data, GROUPS.DISCOVERY, { newLamp, newFinish })
  }

  // ON_LAMP: the ghost just stepped onto a lamp cell.
  if (currentCell === 'lamp') {
    tryFireGroup(data, GROUPS.ON_LAMP)
  }

  // GEOMETRY: dead end, or return to a previously-visited cell.
  const deadEnd = openNeighbours <= DEAD_END_MAX_OPEN_NEIGHBOURS
  const revisit = currentVisits >= REPEATED_VISIT_COUNT
  if (deadEnd || revisit) {
    tryFireGroup(data, GROUPS.GEOMETRY, { deadEnd, revisit })
  }

  // Reset the idle timer on activity.
  schedulePassiveIdle(data)

  // Snapshot current state for the next move's diffing.
  data.thoughtPrevHeroSight = currentSight
  data.thoughtPrevVisibleLampKeys = currentVisibleLampKeys
  data.thoughtPrevFinishVisible = currentFinishVisible
}

export function onLevelComplete(data) {
  tryFireGroup(data, GROUPS.LEVEL_COMPLETE)
}

export function onMapRevealed(data) {
  tryFireGroup(data, GROUPS.MAP_REVEALED)
}

export function hideBubble(data, id) {
  return hideBubbleById(data, id)
}

export function hideOldestBubble(data) {
  if (data.thoughtBubbles.length === 0) return false
  const oldestBubble = data.thoughtBubbles.reduce((oldest, bubble) => {
    if (!oldest) return bubble
    if (bubble.moveAtShow !== oldest.moveAtShow) {
      return bubble.moveAtShow < oldest.moveAtShow ? bubble : oldest
    }
    return bubble.id < oldest.id ? bubble : oldest
  }, null)
  if (!oldestBubble) return false
  return hideBubbleById(data, oldestBubble.id)
}

// ============================================================
// GROUP FIRING + COOLDOWN
// ============================================================

function tryFireGroup(data, group, conditions = {}) {
  // During end-of-level states, passive and in-level active thoughts stop.
  if (group === GROUPS.PASSIVE && (data.levelComplete || data.mapRevealed)) return

  const lastMove = data.thoughtGroupLastMoves[group]
  if (lastMove !== undefined && data.thoughtMoveCount - lastMove < GROUP_COOLDOWN_MOVES) {
    return
  }

  const pool = getCandidatesForGroup(data, group, conditions)
  if (pool.length === 0) return

  if (!showBubble(data, pool, group)) return

  data.thoughtGroupLastMoves[group] = data.thoughtMoveCount
}

function getCandidatesForGroup(data, group, conditions) {
  switch (group) {
    case GROUPS.LEVEL_COMPLETE:
      return [...THOUGHTS.levelComplete]
    case GROUPS.MAP_REVEALED:
      return [...THOUGHTS.mapRevealed]
    case GROUPS.ON_LAMP:
      return [...THOUGHTS.onLamp]
    case GROUPS.VISIBILITY_DECREASED: {
      const pool = [...THOUGHTS.sightDropSoon]
      if (data.heroSight <= VERY_LOW_SIGHT_THRESHOLD) pool.push(...THOUGHTS.veryLowSight)
      else if (data.heroSight <= LOW_SIGHT_THRESHOLD) pool.push(...THOUGHTS.lowSight)
      return pool
    }
    case GROUPS.DISCOVERY: {
      const pool = []
      if (conditions.newLamp) pool.push(...THOUGHTS.nearLamp)
      if (conditions.newFinish) pool.push(...THOUGHTS.nearFinish)
      return pool
    }
    case GROUPS.GEOMETRY: {
      const pool = []
      if (conditions.deadEnd) pool.push(...THOUGHTS.deadEnd)
      if (conditions.revisit) pool.push(...THOUGHTS.repeatedVisit)
      return pool
    }
    case GROUPS.PASSIVE:
      return getPassiveCandidates(data)
  }
  return []
}

function getPassiveCandidates(data) {
  const pool = []

  if (data.stepCtr > 0 && data.stepCtr % STEP_MILESTONE_INTERVAL === 0) {
    pool.push(...THOUGHTS.stepMilestone)
  }

  if (countVisibleWalls(data) >= MANY_WALLS_MIN_VISIBLE) {
    pool.push(...THOUGHTS.manyWalls)
  }

  if (
    data.stepCtr > 0
    && data.stepCtr % SIGHT_DROP_PERIOD >= SIGHT_DROP_PERIOD - SIGHT_DROP_WARNING_WINDOW
  ) {
    pool.push(...THOUGHTS.sightDropSoon)
  }

  if (data.heroSight > 0 && data.heroSight <= VERY_LOW_SIGHT_THRESHOLD) {
    pool.push(...THOUGHTS.veryLowSight)
  } else if (data.heroSight > 0 && data.heroSight <= LOW_SIGHT_THRESHOLD) {
    pool.push(...THOUGHTS.lowSight)
  }

  if (pool.length === 0) pool.push(...THOUGHTS.default)

  return pool
}

// ============================================================
// PASSIVE IDLE TIMER
// ============================================================

function schedulePassiveIdle(data) {
  cancelPassiveIdleTimer(data)
  const delayMs = randRange(PASSIVE_IDLE_SECONDS_MIN, PASSIVE_IDLE_SECONDS_MAX) * 1000
  data.thoughtPassiveIdleTimerId = window.setTimeout(() => {
    data.thoughtPassiveIdleTimerId = null
    tryFireGroup(data, GROUPS.PASSIVE)
    schedulePassiveIdle(data)
  }, delayMs)
}

function cancelPassiveIdleTimer(data) {
  if (data.thoughtPassiveIdleTimerId !== null) {
    window.clearTimeout(data.thoughtPassiveIdleTimerId)
    data.thoughtPassiveIdleTimerId = null
  }
}

// ============================================================
// BUBBLE MANAGEMENT
// ============================================================

function showBubble(data, candidates, group) {
  const slot = pickFreeSlot(data)
  if (slot === null) return false

  const id = data.thoughtNextBubbleId++
  const text = candidates[Math.floor(Math.random() * candidates.length)]
  const maxMoves = randIntInclusive(BUBBLE_VISIBLE_MOVES_MIN, BUBBLE_VISIBLE_MOVES_MAX)
  const visibleMs = randRange(BUBBLE_VISIBLE_SECONDS_MIN, BUBBLE_VISIBLE_SECONDS_MAX) * 1000

  const hideTimerId = window.setTimeout(() => {
    hideBubbleById(data, id)
  }, visibleMs)

  data.thoughtBubbles.push({
    id,
    text,
    slot,
    group,
    hideTimerId,
    moveAtShow: data.thoughtMoveCount,
    maxMoves,
  })

  return true
}

function hideBubbleById(data, id) {
  const idx = data.thoughtBubbles.findIndex((b) => b.id === id)
  if (idx === -1) return false
  const bubble = data.thoughtBubbles[idx]
  if (bubble.hideTimerId !== null) window.clearTimeout(bubble.hideTimerId)
  data.thoughtBubbles.splice(idx, 1)
  return true
}

function expireBubblesByMoves(data) {
  for (const bubble of [...data.thoughtBubbles]) {
    if (data.thoughtMoveCount - bubble.moveAtShow >= bubble.maxMoves) {
      hideBubbleById(data, bubble.id)
    }
  }
}

function clearAllBubbles(data) {
  data.thoughtBubbles.forEach((b) => {
    if (b.hideTimerId !== null) window.clearTimeout(b.hideTimerId)
  })
  data.thoughtBubbles = []
}

function pickFreeSlot(data) {
  const used = new Set(data.thoughtBubbles.map((b) => b.slot))
  for (const slot of BUBBLE_SLOTS) {
    if (!used.has(slot)) return slot
  }
  return null
}

// ============================================================
// VISIBILITY-RESPECTING HELPERS
// ============================================================

function isCellVisible(data, x, y) {
  if (data.heroSight <= 0) return false
  return !isHidden(x, y, data.heroX, data.heroY, data.heroSight)
}

function computeVisibleLampKeys(data) {
  const keys = []
  if (!data.field) return keys
  const r = Math.ceil(data.heroSight)
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const x = data.heroX + dx
      const y = data.heroY + dy
      if (!isCellVisible(data, x, y)) continue
      if (getCellAt(data, x, y) === 'lamp') keys.push(`${x},${y}`)
    }
  }
  return keys
}

function isFinishVisible(data) {
  if (!data.field) return false
  const r = Math.ceil(data.heroSight)
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const x = data.heroX + dx
      const y = data.heroY + dy
      if (!isCellVisible(data, x, y)) continue
      if (getCellAt(data, x, y) === 'finish') return true
    }
  }
  return false
}

function countVisibleWalls(data) {
  if (!data.field) return 0
  let count = 0
  const r = Math.ceil(data.heroSight)
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      if (dx === 0 && dy === 0) continue
      const x = data.heroX + dx
      const y = data.heroY + dy
      if (!isCellVisible(data, x, y)) continue
      if (getCellAt(data, x, y) === 'wall') count++
    }
  }
  return count
}

function getCellAt(data, x, y) {
  if (!data.field) return null
  if (x < 0 || y < 0 || x >= data.width || y >= data.height) return null
  return data.field?.[x]?.[y] ?? null
}

function countOpenNeighbours(data) {
  const offsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  return offsets.reduce((acc, [dx, dy]) => {
    const type = getCellAt(data, data.heroX + dx, data.heroY + dy)
    return type && type !== 'wall' ? acc + 1 : acc
  }, 0)
}

// ============================================================
// RANDOM HELPERS
// ============================================================

function randRange(min, max) {
  return min + Math.random() * (max - min)
}

function randIntInclusive(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}
