import * as consts from './const.js'
import { makeFieldLinked } from './generator.js'


function isCellEmpty(field, width, height, x, y) {
    if (x > width - 1 || x < 0 || y > height - 1 || y < 0 ) return false;
    if (field[x][y] === 'wall') return false;
    return true;
}

function isFinish(x, y, field) {
    console.log(x, y, field[x][y]);
    // console.log()
    return field[x][y] === 'finish';
}

function decreaseSight(data) {
    if (data.stepCtr % 20 === 0 && data.heroSight >= 2) data.heroSight--;
}

function processCell(data) {
    switch (data.field[data.heroX][data.heroY]) {
        case 'lamp':
            data.heroSight = consts.INIT_SIGHT;
            data.stepCtr = 0;
    }
}

function processKey(key, data) {
    console.log(key);
    switch(key) {
    case 'ArrowRight':
        if (isCellEmpty(data.field, data.width, data.height, data.heroX + 1, data.heroY)) {
            data.heroX += 1;
        }
        break;
    case 'ArrowLeft':
        if (isCellEmpty(data.field, data.width, data.height, data.heroX - 1, data.heroY)) {
            data.heroX -= 1;
        }
        break;
    case 'ArrowUp':
        if (isCellEmpty(data.field, data.width, data.height, data.heroX, data.heroY - 1)) {
            data.heroY -= 1;
        }
        break;
    case 'ArrowDown':
        if (isCellEmpty(data.field, data.width, data.height, data.heroX, data.heroY + 1)) {
            data.heroY += 1;
        }
        break;
    // case ' ':
    //     makeFieldLinked(data.field, data.width, data.height);
    //     break;
    }
    // console.log(data.heroX, data.heroY);
    data.stepCtr++;
    decreaseSight(data);
    // console.log(data.stepCtr, data.heroSight);
    processCell(data);
    if (isFinish(data.heroX, data.heroY, data.field)) {
        setTimeout(() => {
            alert('You found way out!');
            window.location.reload();
        }, 100);
    }
}

function isHidden(x, y, heroX, heroY, heroSight) {
    return Math.sqrt((heroX - x) * (heroX - x) + (heroY - y) * (heroY - y)) > heroSight
}

export {
    processKey,
    isHidden,
}