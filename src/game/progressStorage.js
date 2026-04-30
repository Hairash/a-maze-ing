// Persistence of in-progress game state to localStorage.
//
// Only validated payloads are returned from `loadProgress` — anything
// missing required fields, with the wrong dimensions, or malformed JSON
// is treated as "no save" (returns null) so callers can fall back to a
// fresh level without crashing on stale or corrupt data.

const STORAGE_KEY = 'a-maze-ing-progress-v1'
const HINTS_SHOWN_KEY = 'a-maze-ing-hints-shown-v1'

export function hasShownControlHints() {
  try {
    return localStorage.getItem(HINTS_SHOWN_KEY) === 'true'
  } catch {
    return false
  }
}

export function markControlHintsShown() {
  try {
    localStorage.setItem(HINTS_SHOWN_KEY, 'true')
  } catch {}
}

export function saveProgress(data) {
  const payload = {
    field: data.field,
    wallVariants: data.wallVariants ?? null,
    heroX: data.heroX,
    heroY: data.heroY,
    heroSight: data.heroSight,
    stepCtr: data.stepCtr,
    soulTrack: data.soulTrack ?? {},
    soulPath: Array.isArray(data.soulPath) ? data.soulPath : [],
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function loadProgress(width, height) {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    const hasValidField = Array.isArray(parsed.field)
      && parsed.field.length === width
      && parsed.field.every((column) => Array.isArray(column) && column.length === height)

    const hasValidHeroPosition = Number.isInteger(parsed.heroX)
      && Number.isInteger(parsed.heroY)
      && parsed.heroX >= 0
      && parsed.heroX < width
      && parsed.heroY >= 0
      && parsed.heroY < height

    const hasValidHeroSight = Number.isFinite(parsed.heroSight)
    const hasValidStepCounter = Number.isInteger(parsed.stepCtr) && parsed.stepCtr >= 0

    if (!hasValidField || !hasValidHeroPosition || !hasValidHeroSight || !hasValidStepCounter) {
      return null
    }

    const hasValidWallVariants = Array.isArray(parsed.wallVariants)
      && parsed.wallVariants.length === width
      && parsed.wallVariants.every((column) => Array.isArray(column) && column.length === height)

    return {
      field: parsed.field,
      wallVariants: hasValidWallVariants ? parsed.wallVariants : null,
      heroX: parsed.heroX,
      heroY: parsed.heroY,
      heroSight: parsed.heroSight,
      stepCtr: parsed.stepCtr,
      soulTrack: parsed.soulTrack ?? {},
      soulPath: Array.isArray(parsed.soulPath) ? parsed.soulPath : [],
    }
  } catch {
    return null
  }
}

export function clearProgress() {
  localStorage.removeItem(STORAGE_KEY)
}
