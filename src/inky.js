/*
 * The blue ghost.
 */

/*global COLS, Ghost, Maze, ROWS, lookup, toDx, toDy */

function Inky() {
    this.init();
}

Inky.prototype = new Ghost({
    name: 'inky',
    startCol: Maze.HOME_COL - 2,
    startRow: Maze.HOME_ROW + 3,
    scatterCol: COLS - 1,
    scatterRow: ROWS - 2,

    calcTarget: function () {
        // target tile at vector extending from blinky with midpoint 2 tiles
        // ahead of pacman
        var pacman = lookup('pacman'),
            blinky = lookup('blinky');
        var cx = pacman.col + toDx(pacman.direction) * 2;
        var cy = pacman.row + toDy(pacman.direction) * 2;
        return { col: cx + cx - blinky.col,
                 row: cy + cy - blinky.row };
    }
});
