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
    console.log(key);
    switch(key) {
        case 'ArrowRight':
            if (isCellEmpty(data.field, data.width, data.height, data.heroX + 1, data.heroY)) {
                data.heroX += 1;
                if (data.heroX > consts.INIT_SIGHT + 1) {
                    window.scrollBy(data.cellSize, 0);
                }
            }
        break;
        case 'ArrowLeft':
            if (isCellEmpty(data.field, data.width, data.height, data.heroX - 1, data.heroY)) {
                data.heroX -= 1;
                if (data.heroX < (data.width - consts.INIT_SIGHT - 2)) {
                    window.scrollBy(-data.cellSize, 0);
                }
            }
        break;
        case 'ArrowUp':
            if (isCellEmpty(data.field, data.width, data.height, data.heroX, data.heroY - 1)) {
                data.heroY -= 1;
                if (data.heroY < (data.height - consts.INIT_SIGHT - 2)) {
                    window.scrollBy(0, -data.cellSize);
                }
            }
        break;
        case 'ArrowDown':
            if (isCellEmpty(data.field, data.width, data.height, data.heroX, data.heroY + 1)) {
                data.heroY += 1;
                if (data.heroY > consts.INIT_SIGHT + 1) {
                    window.scrollBy(0, data.cellSize);
                }
            }
        break;
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

function scrollToPoint(x, y, cellSize) {
    const scrollY = y * cellSize;
    const scrollX = x * cellSize;
    const indentX = (window.innerWidth - cellSize) / 2;
    const indentY = (window.innerHeight - cellSize) / 2;
    console.log('Scroll to:', scrollX - indentX, scrollY - indentY);
    window.scroll(scrollX - indentX, scrollY - indentY);
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
    initLevel,
}