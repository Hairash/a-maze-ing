import * as consts from './const.js'
import { generateField, selectEmptyRandomCell } from './generator.js'


function isCellEmpty(field, width, height, x, y) {
    if (x > width - 1 || x < 0 || y > height - 1 || y < 0 ) return false;
    if (field[x][y] === 'wall') return false;
    return true;
}

function isFinish(x, y, field) {
    // console.log(x, y, field[x][y]);
    return field[x][y] === 'finish';
}

function decreaseSight(data) {
    // TODO: Make const for number of steps before sight decrease
    if (data.stepCtr % 20 === 0 && data.heroSight >= 2) data.heroSight--;
}

function processCell(data) {
    switch (data.field[data.heroX][data.heroY]) {
        case 'lamp':
            data.heroSight = consts.INIT_SIGHT;
            data.stepCtr = 0;
        break;
    }
}

function processKey(key, data) {
    console.log('processKey', key);
    let isMoved = false;
    switch(key) {
        case 'ArrowRight':
            if (isCellEmpty(data.field, data.width, data.height, data.heroX + 1, data.heroY)) {
                data.heroX += 1;
                isMoved = true;
            }
        break;
        case 'ArrowLeft':
            if (isCellEmpty(data.field, data.width, data.height, data.heroX - 1, data.heroY)) {
                data.heroX -= 1;
                isMoved = true;
            }
        break;
        case 'ArrowUp':
            if (isCellEmpty(data.field, data.width, data.height, data.heroX, data.heroY - 1)) {
                data.heroY -= 1;
                isMoved = true;
            }
        break;
        case 'ArrowDown':
            if (isCellEmpty(data.field, data.width, data.height, data.heroX, data.heroY + 1)) {
                data.heroY += 1;
                isMoved = true;
            }
        break;
    }

    if (isMoved) {
        scrollToPoint(data.heroX, data.heroY, data.cellSize);
    }

    // console.log(data.heroX, data.heroY);
    data.stepCtr++;
    decreaseSight(data);
    // console.log(data.stepCtr, data.heroSight);
    processCell(data);
    if (isFinish(data.heroX, data.heroY, data.field)) {
        data.heroSight = -1;  // to hide previous field
        // TODO: Make field empty to hide previous one
        setTimeout(() => {
            alert('You found way out!');
            initLevel(data);
            scrollToPoint(data.heroX, data.heroY, data.cellSize);
        }, consts.CELL_HIDE_DELAY);
    }
}

function isHidden(x, y, heroX, heroY, heroSight) {
    return Math.sqrt((heroX - x) * (heroX - x) + (heroY - y) * (heroY - y)) > heroSight
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getScrollContainer() {
    return document.body;
}

function getViewportSize() {
    return {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
    };
}

function getBoardScrollLimits() {
    const container = getScrollContainer();
    const board = document.querySelector('.board');
    const { width: viewportWidth, height: viewportHeight } = getViewportSize();

    if (!board) {
        return {
            viewportWidth,
            viewportHeight,
            maxScrollX: Math.max(0, container.scrollWidth - viewportWidth),
            maxScrollY: Math.max(0, container.scrollHeight - viewportHeight),
        };
    }

    const boardRect = board.getBoundingClientRect();
    const boardLeft = boardRect.left + container.scrollLeft;
    const boardTop = boardRect.top + container.scrollTop;

    return {
        viewportWidth,
        viewportHeight,
        maxScrollX: Math.max(0, boardLeft + board.scrollWidth - viewportWidth),
        maxScrollY: Math.max(0, boardTop + board.scrollHeight - viewportHeight),
    };
}

function clampScrollToBoardBounds() {
    const container = getScrollContainer();
    const { maxScrollX, maxScrollY } = getBoardScrollLimits();
    const targetX = clamp(container.scrollLeft, 0, maxScrollX);
    const targetY = clamp(container.scrollTop, 0, maxScrollY);

    if (targetX === container.scrollLeft && targetY === container.scrollTop) {
        return;
    }

    container.scrollTo(targetX, targetY);
}

function scrollToPoint(x, y, cellSize) {
    const container = getScrollContainer();
    const { viewportWidth, viewportHeight, maxScrollX, maxScrollY } = getBoardScrollLimits();
    const cellCenterX = x * cellSize + cellSize / 2;
    const cellCenterY = y * cellSize + cellSize / 2;
    const targetX = clamp(cellCenterX - viewportWidth / 2, 0, maxScrollX);
    const targetY = clamp(cellCenterY - viewportHeight / 2, 0, maxScrollY);

    console.log('Scroll to:', targetX, targetY);
    container.scrollTo(targetX, targetY);
}

function initLevel(data) {
    data.field = generateField(data.width, data.height);
    [data.heroX, data.heroY] = selectEmptyRandomCell(data.field, data.width, data.height);
    console.log('Hero:', data.heroX, data.heroY);
    data.heroSight = consts.INIT_SIGHT;
    data.stepCtr = 0;
}

export {
    processKey,
    isHidden,
    scrollToPoint,
    clampScrollToBoardBounds,
    initLevel,
}
