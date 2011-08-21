/*
 * The pink ghost.
 */

/*global Ghost, Maze, getObject, toDx, toDy */

function Pinky() {
    this.name = 'pinky';
    this.startCol = Maze.HOME_COL;
    this.startRow = Maze.HOME_ROW + 3;
    this.scatterTile = { col: 2, row: 0 };
}

Pinky.prototype = new Ghost({

    calcTarget: function () {
        // target 4 tiles ahead of pacman's current direction
        var pacman = getObject('pacman');
        return { col: pacman.col + toDx(pacman.direction) * 4,
                 row: pacman.row + toDy(pacman.direction) * 4 };
    }
});
