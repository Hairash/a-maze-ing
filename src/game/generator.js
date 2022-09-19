const CELL_WEIGHTS = {
    'wall': 70,
    'empty': 69.5,
    'lamp': 0.5,
}

function makeCellChooser() {
    let sumValue = 0;
    for (const [key, value] of Object.entries(CELL_WEIGHTS)) sumValue += value;
    // console.log(sumValue);

    const cellChooserArray = [];
    let offset = 0;
    for (let [cell, value] of Object.entries(CELL_WEIGHTS)) {
        const rValue = value / sumValue;
        offset += rValue;
        cellChooserArray.push({value: offset, cell: cell})
    }
    return cellChooserArray;
}

function chooseCellValue(r, cellChooser) {
    for (let el of cellChooser) {
        if (r < el.value) {
            return el.cell;
        }
    }
}

function findNeighbours(x, y, width, height) {
    const neighbours = [];
    if (x > 0) neighbours.push([x - 1, y]);
    if (x < width - 1) neighbours.push([x + 1, y]);
    if (y > 0) neighbours.push([x, y - 1]);
    if (y < height - 1) neighbours.push([x, y + 1]);
    return neighbours;
}

function differentCells(x1, y1, x2, y2, field) {
    return field[x1][y1] === 'wall' && field[x2][y2] !== 'wall' || field[x1][y1] !== 'wall' && field[x2][y2] === 'wall'
}

function wave(field, width, height) {
    const wField = [];
    for (let x = 0; x < width; x++) {
        const line = [];
        for (let y = 0; y < height; y++) {
            // TODO: Push MAX_INT value
            line.push(999);
        }
        wField.push(line);
    }
    console.log('Start wave field:');
    outputField(wField);
    const [startX, startY] = selectEmptyRandomCell(field, width, height);

    wField[startX][startY] = 0;
    const queue = [[startX, startY]];
    while (queue.length > 0) {
        // console.log(JSON.stringify(queue));
        const [curX, curY] = queue.shift();
        const neighbours = findNeighbours(curX, curY, width, height);
        for (let neighbour of neighbours) {
            const [x, y] = neighbour;
            const prevValue = wField[x][y];
            // if (differentCells(x, y, curX, curY, field)) wField[x][y] = Math.min(wField[x][y], wField[curX][curY] + 1);
            if (field[x][y] === 'wall') wField[x][y] = Math.min(wField[x][y], wField[curX][curY] + 1);
            else wField[x][y] = Math.min(wField[x][y], wField[curX][curY]);
            if (wField[x][y] < prevValue) queue.push([x, y]);
        }
    }
    console.log('Wave field:');
    outputField(wField);
    return wField;
}

function getMaxNumCell(wField, field) {
    let max = 0;
    let maxCell = [];
    for (let x = 0; x < wField.length; x++) {
        for (let y = 0; y < wField[x].length; y++) {
            const cell = wField[x][y];
            // if (!(cell % 2)) max = Math.max(cell, max);
            if (field[x][y] !== 'wall') {
                if (cell > max) {
                    maxCell = [x, y];
                    max = cell;
                }
            }
        }
    }
    // console.log('maxCell:', maxCell);
    return {num: max, cell: maxCell};
}

function fixWall(wField, field, width, height, maxNum, wallX, wallY) {
    console.log('fixWall', wallX, wallY);
    const neighbours = findNeighbours(wallX, wallY, width, height);
    console.log('Wall neighbours:', neighbours);
    for (let neighbour of neighbours) {
        const [x, y] = neighbour;
        if (wField[x][y] === maxNum - 1) {
            // outputField(field);
            // console.log('Before:', field[wallX][wallY]);
            field[wallX][wallY] = 'empty';
            console.log('Wall', wallX, wallY, 'fixed');
            // console.log('After:', field[wallX][wallY]);
            // outputField(field);
            return true;
        }
    }
    return false;
}

function outputField(field) {
    const fieldT = field[0].map((_, colIndex) => field.map(row => row[colIndex]));
    console.log(fieldT);
}

function fixWave(wField, field, width, height, maxNum, startX, startY) {
    console.log('Fix wave');
    const queue = [[startX, startY]];
    const visitedNeighbours = [];
    while(queue.length > 0) {
    // for (let i = 0; i < 10; i++) {
        console.log('Queue:', JSON.stringify(queue));
        const [curX, curY] = queue.shift();
        visitedNeighbours.push(`${curX}, ${curY}`);
        console.log('Current cell:', curX, curY, width, height);
        const neighbours = findNeighbours(curX, curY, width, height);
        console.log('Neighbours:', neighbours);
        for (let neighbour of neighbours) {
            const [x, y] = neighbour;
            if (wField[x][y] !== maxNum) continue;
            if (field[x][y] === 'wall') {
                if (fixWall(wField, field, width, height, maxNum, x, y))
                {
                    // outputField(field);
                    return;
                }
            }
            else if (!visitedNeighbours.includes(`${x}, ${y}`)) queue.push([x, y]);
        }
    }
}

function makeFieldLinked(field, width, height) {
    let wField = wave(field, width, height);
    let maxNumCell = getMaxNumCell(wField, field);
    console.log('MaxNumCell:', maxNumCell);
    let maxNum = maxNumCell.num;
    let [startX, startY] = maxNumCell.cell;
    while (maxNum > 0) {
        fixWave(wField, field, width, height, maxNum, startX, startY);
        wField = wave(field, width, height);
        maxNumCell = getMaxNumCell(wField, field);
        maxNum = maxNumCell.num;
        [startX, startY] = maxNumCell.cell;
    }
}

function generateField(width, height) {
    console.log('Start generate field');
    const cellChooser = makeCellChooser();
    const field = [];
    for (let x = 0; x < width; x++) {
        const col = [];
        for (let y = 0; y < height; y++) {
            const r = Math.random();
            col.push(chooseCellValue(r, cellChooser));
            // console.log(makeCellChooser(r));
        }
        field.push(col);
    }
    const [finishX, finishY] = generateItem(width, height, field);
    field[finishX][finishY] = 'finish';
    console.log('Output field');
    outputField(field);
    makeFieldLinked(field, width, height);
    return field;
}

function generateItem(width, height, field) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    return [x, y];
}

function selectEmptyRandomCell(field, width, height) {
    while (true) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        if (field[x][y] !== 'wall') {
            return [x, y];
        }
    }
}

export {
    generateField,
    selectEmptyRandomCell,
    makeFieldLinked,
}
