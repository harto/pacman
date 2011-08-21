/*
 * The blue ghost.
 */

/*global COLS, Ghost, Maze, ROWS, getObject, toDx, toDy */

function Inky() {
    this.name = 'inky';
    this.startCol = Maze.HOME_COL - 2;
    this.startRow = Maze.HOME_ROW + 3;
    this.scatterTile = { col: COLS - 1, row: ROWS - 2 };
}

Inky.prototype = new Ghost({

    calcTarget: function () {
        // target tile at vector extending from blinky with midpoint 2 tiles
        // ahead of pacman
        var pacman = getObject('pacman'),
            blinky = getObject('blinky');
        var cx = pacman.col + toDx(pacman.direction) * 2;
        var cy = pacman.row + toDy(pacman.direction) * 2;
        return { col: cx + cx - blinky.col,
                 row: cy + cy - blinky.row };
    }
});
