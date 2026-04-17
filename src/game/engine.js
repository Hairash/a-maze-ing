import * as consts from './const.js'
import { generateField, selectEmptyRandomCell } from './generator.js'
import { saveProgress, loadProgress } from './progressStorage.js'

function isCellEmpty(field, width, height, x, y) {
  if (x > width - 1 || x < 0 || y > height - 1 || y < 0) return false
  const cell = field?.[x]?.[y]
  if (typeof cell !== 'string') return false
  return cell !== 'wall'
}

function isFinish(x, y, field) {
  return field[x][y] === 'finish'
}

function decreaseSight(data) {
  if (data.stepCtr % 20 === 0 && data.heroSight >= 2) data.heroSight--
}

function processCell(data) {
  switch (data.field[data.heroX][data.heroY]) {
    case 'lamp':
      data.heroSight = consts.INIT_SIGHT
      data.stepCtr = 0
      break
  }
}

function incrementSoulTrack(data, x, y) {
  if (!data.soulTrack) {
    data.soulTrack = {}
  }

  const key = `${x},${y}`
  data.soulTrack[key] = (data.soulTrack[key] ?? 0) + 1
}

function appendSoulPath(data, x, y) {
  if (!Array.isArray(data.soulPath)) {
    data.soulPath = []
  }
  data.soulPath.push([x, y])
}

function processKey(key, data) {
  let isMoved = false
  switch (key) {
    case 'ArrowRight':
      if (isCellEmpty(data.field, data.width, data.height, data.heroX + 1, data.heroY)) {
        data.heroX += 1
        isMoved = true
      }
      break
    case 'ArrowLeft':
      if (isCellEmpty(data.field, data.width, data.height, data.heroX - 1, data.heroY)) {
        data.heroX -= 1
        isMoved = true
      }
      break
    case 'ArrowUp':
      if (isCellEmpty(data.field, data.width, data.height, data.heroX, data.heroY - 1)) {
        data.heroY -= 1
        isMoved = true
      }
      break
    case 'ArrowDown':
      if (isCellEmpty(data.field, data.width, data.height, data.heroX, data.heroY + 1)) {
        data.heroY += 1
        isMoved = true
      }
      break
  }

  if (isMoved) {
    incrementSoulTrack(data, data.heroX, data.heroY)
    appendSoulPath(data, data.heroX, data.heroY)
    scrollToPoint(data.heroX, data.heroY, data.cellSize)
  }

  data.stepCtr++
  decreaseSight(data)
  processCell(data)

  const reachedFinish = isFinish(data.heroX, data.heroY, data.field)
  saveProgress(data)

  return {
    isMoved,
    reachedFinish,
  }
}

function isHidden(x, y, heroX, heroY, heroSight) {
  return Math.sqrt((heroX - x) * (heroX - x) + (heroY - y) * (heroY - y)) > heroSight
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getScrollContainer() {
  return document.body
}

function getViewportSize() {
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  }
}

function getBoardScrollLimits() {
  const container = getScrollContainer()
  const board = document.querySelector('.board')
  const { width: viewportWidth, height: viewportHeight } = getViewportSize()

  if (!board) {
    return {
      viewportWidth,
      viewportHeight,
      maxScrollX: Math.max(0, container.scrollWidth - viewportWidth),
      maxScrollY: Math.max(0, container.scrollHeight - viewportHeight),
    }
  }

  const boardRect = board.getBoundingClientRect()
  const boardLeft = boardRect.left + container.scrollLeft
  const boardTop = boardRect.top + container.scrollTop

  return {
    viewportWidth,
    viewportHeight,
    maxScrollX: Math.max(0, boardLeft + board.scrollWidth - viewportWidth),
    maxScrollY: Math.max(0, boardTop + board.scrollHeight - viewportHeight),
  }
}

function clampScrollToBoardBounds() {
  const container = getScrollContainer()
  const { maxScrollX, maxScrollY } = getBoardScrollLimits()
  const targetX = clamp(container.scrollLeft, 0, maxScrollX)
  const targetY = clamp(container.scrollTop, 0, maxScrollY)

  if (targetX === container.scrollLeft && targetY === container.scrollTop) {
    return
  }

  container.scrollTo(targetX, targetY)
}

function scrollToPoint(x, y, cellSize) {
  const container = getScrollContainer()
  const { viewportWidth, viewportHeight, maxScrollX, maxScrollY } = getBoardScrollLimits()
  const cellCenterX = x * cellSize + cellSize / 2
  const cellCenterY = y * cellSize + cellSize / 2
  const targetX = clamp(cellCenterX - viewportWidth / 2, 0, maxScrollX)
  const targetY = clamp(cellCenterY - viewportHeight / 2, 0, maxScrollY)

  container.scrollTo(targetX, targetY)
}

function initLevel(data, forceNewLevel = false) {
  const saved = forceNewLevel ? null : loadProgress(data.width, data.height)

  if (saved) {
    data.field = saved.field
    data.heroX = saved.heroX
    data.heroY = saved.heroY
    data.heroSight = saved.heroSight
    data.stepCtr = saved.stepCtr
    data.soulTrack = saved.soulTrack
    data.soulPath = saved.soulPath
    return
  }

  data.field = generateField(data.width, data.height)
  ;[data.heroX, data.heroY] = selectEmptyRandomCell(data.field, data.width, data.height)
  data.heroSight = consts.INIT_SIGHT
  data.stepCtr = 0
  data.soulTrack = {}
  data.soulPath = []
  incrementSoulTrack(data, data.heroX, data.heroY)
  appendSoulPath(data, data.heroX, data.heroY)
  saveProgress(data)
}

export {
  processKey,
  isHidden,
  scrollToPoint,
  clampScrollToBoardBounds,
  initLevel,
}
