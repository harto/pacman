/*
 * The red ghost.
 */

/*global COLS, Ghost, Maze, lookup */

function Blinky() {
    this.init();
    this.unset(Ghost.STATE_INSIDE);
}

Blinky.prototype = new Ghost({
    name: 'blinky',
    startCol: Maze.HOME_COL,
    startRow: Maze.HOME_ROW,
    scatterCol: COLS - 3,
    scatterRow: 0,

    calcTarget: function () {
        // target pacman directly
        var pacman = lookup('pacman');
        return { col: pacman.col, row: pacman.row };
    }
});
