// Pure logic for thought bubble placement.
//
// The rules:
//   - Up to 4 bubbles on screen at once, each in a distinct (corner, offset)
//     "slot". Mobile excludes bottom-right to leave room for the move pad.
//   - Once a bubble has a placement, it never moves (sticky).
//   - New bubbles pick the first free slot in the current zone's layout.
//   - "Zone" is the hero's viewport position: left/center/right horizontally
//     and top/center/bottom vertically. The hero is considered centered if
//     its post-scroll viewport center is within one cell of the viewport
//     midline.

const MOBILE_VIEWPORT_THRESHOLD = 768
const BUBBLE_ASPECT = 1085 / 768
const MARGIN = 8
const STACK_GAP = 16

const FLIP_BY_CORNER = {
  'top-right': { flipX: false, flipY: false },
  'top-left': { flipX: true, flipY: false },
  'bottom-right': { flipX: false, flipY: true },
  'bottom-left': { flipX: true, flipY: true },
}

export function isMobileViewport(viewportWidth) {
  return viewportWidth <= MOBILE_VIEWPORT_THRESHOLD
}

export function computeBubbleSize(text, viewportWidth) {
  const baseMaxWidth = Math.min(340, Math.max(220, viewportWidth * 0.35))
  const baseMinWidth = Math.min(220, Math.max(170, viewportWidth * 0.24))
  const len = (text ?? '').length
  const width = Math.max(baseMinWidth, Math.min(baseMaxWidth, 170 + len * 2.2))
  const height = width / BUBBLE_ASPECT
  return { width, height }
}

// Hero zone based on post-scroll viewport position. Computed from scroll
// math instead of the live DOM so results are stable even before the
// browser has applied the next `scrollTo`.
export function getHeroViewportZone(ctx) {
  const { heroX, heroY, width, height, cellSize, viewportWidth, viewportHeight } = ctx
  const heroCellCx = (heroX + 0.5) * cellSize
  const heroCellCy = (heroY + 0.5) * cellSize
  const boardWidth = width * cellSize
  const boardHeight = height * cellSize
  const maxScrollX = Math.max(0, boardWidth - viewportWidth)
  const maxScrollY = Math.max(0, boardHeight - viewportHeight)
  const scrollX = Math.max(0, Math.min(heroCellCx - viewportWidth / 2, maxScrollX))
  const scrollY = Math.max(0, Math.min(heroCellCy - viewportHeight / 2, maxScrollY))
  const heroVx = heroCellCx - scrollX
  const heroVy = heroCellCy - scrollY
  const midX = viewportWidth / 2
  const midY = viewportHeight / 2
  const tolerance = cellSize
  return {
    h: heroVx < midX - tolerance ? 'left' : heroVx > midX + tolerance ? 'right' : 'center',
    v: heroVy < midY - tolerance ? 'top' : heroVy > midY + tolerance ? 'bottom' : 'center',
  }
}

// Ordered list of 4 slot descriptors `{ corner, offset }`. `offset = 0`
// sits at the corner; `offset = 1` stacks one bubble inward.
export function getLayoutSlots(zone, { isMobile } = {}) {
  if (isMobile) {
    if (zone.v === 'bottom') {
      return [
        { corner: 'top-right', offset: 0 },
        { corner: 'top-left', offset: 0 },
        { corner: 'top-right', offset: 1 },
        { corner: 'top-left', offset: 1 },
      ]
    }
    if (zone.v === 'top') {
      const base = [
        { corner: 'bottom-left', offset: 0 },
        { corner: 'bottom-left', offset: 1 },
      ]
      if (zone.h === 'left') {
        return [
          ...base,
          { corner: 'top-right', offset: 0 },
          { corner: 'top-right', offset: 1 },
        ]
      }
      if (zone.h === 'right') {
        return [
          ...base,
          { corner: 'top-left', offset: 0 },
          { corner: 'top-left', offset: 1 },
        ]
      }
      return [
        ...base,
        { corner: 'top-right', offset: 0 },
        { corner: 'top-left', offset: 0 },
      ]
    }
    return [
      { corner: 'top-right', offset: 0 },
      { corner: 'top-left', offset: 0 },
      { corner: 'bottom-left', offset: 0 },
      { corner: 'bottom-left', offset: 1 },
    ]
  }

  if (zone.h === 'left') {
    return [
      { corner: 'top-right', offset: 0 },
      { corner: 'bottom-right', offset: 0 },
      { corner: 'top-right', offset: 1 },
      { corner: 'bottom-right', offset: 1 },
    ]
  }
  if (zone.h === 'right') {
    return [
      { corner: 'top-left', offset: 0 },
      { corner: 'bottom-left', offset: 0 },
      { corner: 'top-left', offset: 1 },
      { corner: 'bottom-left', offset: 1 },
    ]
  }
  return [
    { corner: 'top-right', offset: 0 },
    { corner: 'top-left', offset: 0 },
    { corner: 'bottom-right', offset: 0 },
    { corner: 'bottom-left', offset: 0 },
  ]
}

export function slotToRect(slot, size, { viewportWidth, viewportHeight }) {
  const maxX = Math.max(MARGIN, viewportWidth - size.width - MARGIN)
  const maxY = Math.max(MARGIN, viewportHeight - size.height - MARGIN)
  const inward = slot.offset * (size.height + STACK_GAP)
  let left = MARGIN
  let top = MARGIN
  if (slot.corner === 'top-right') {
    left = maxX
    top = Math.min(maxY, MARGIN + inward)
  } else if (slot.corner === 'top-left') {
    left = MARGIN
    top = Math.min(maxY, MARGIN + inward)
  } else if (slot.corner === 'bottom-right') {
    left = maxX
    top = Math.max(MARGIN, maxY - inward)
  } else {
    left = MARGIN
    top = Math.max(MARGIN, maxY - inward)
  }
  return {
    left,
    top,
    right: left + size.width,
    bottom: top + size.height,
  }
}

function slotKey(slot) {
  return `${slot.corner}:${slot.offset}`
}

// Given the current bubble list and previous placements, return a new
// placements map that (a) preserves existing placements and (b) assigns
// new bubbles to the first free slot in the current zone's layout.
export function reconcilePlacements(bubbles, prevPlacements, context) {
  const { viewportWidth, viewportHeight } = context
  const activeIds = new Set(bubbles.map((b) => b.id))

  const nextPlacements = {}
  for (const [id, placement] of Object.entries(prevPlacements)) {
    const numericId = Number(id)
    if (activeIds.has(numericId)) nextPlacements[numericId] = placement
  }

  const occupied = new Set(
    Object.values(nextPlacements).map((p) => `${p.corner}:${p.offset}`),
  )

  const zone = getHeroViewportZone(context)
  const isMobile = isMobileViewport(viewportWidth)
  const slots = getLayoutSlots(zone, { isMobile })

  for (const bubble of bubbles) {
    if (nextPlacements[bubble.id]) continue
    const slot = slots.find((s) => !occupied.has(slotKey(s)))
    if (!slot) continue
    occupied.add(slotKey(slot))
    const size = computeBubbleSize(bubble.text, viewportWidth)
    const rect = slotToRect(slot, size, { viewportWidth, viewportHeight })
    const flip = FLIP_BY_CORNER[slot.corner] ?? FLIP_BY_CORNER['top-right']
    nextPlacements[bubble.id] = {
      rect,
      corner: slot.corner,
      offset: slot.offset,
      flipX: flip.flipX,
      flipY: flip.flipY,
      size,
    }
  }

  return nextPlacements
}
