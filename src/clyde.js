/*
 * The orange ghost.
 */

/*global Ghost, Maze, ROWS, distance, lookup */

function Clyde() {
    this.init();
}

Clyde.prototype = new Ghost({
    name: 'clyde',
    startCol: Maze.HOME_COL + 2,
    startRow: Maze.HOME_ROW + 3,
    scatterCol: 0,
    scatterRow: ROWS - 2,

    calcTarget: function () {
        // target pacman directly when further than 8 tiles from him, otherwise
        // target scatter mode tile
        var pacman = lookup('pacman'),
            pCol = pacman.col,
            pRow = pacman.row;
        return distance(pCol, pRow, this.col, this.row) > 8 ?
                   { col: pCol, row: pRow } :
                   this.scatterTile;
    }
});
