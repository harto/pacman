/*
 * The orange ghost.
 */

/*global Ghost, Maze, ROWS, distance, getObject */

function Clyde() {
    this.name = 'clyde';
    this.startCol = Maze.HOME_COL + 2;
    this.startRow = Maze.HOME_ROW + 3;
    this.scatterTile = { col: 0, row: ROWS - 2 };
}

Clyde.prototype = new Ghost({

    calcTarget: function () {
        // target pacman directly when further than 8 tiles from him, otherwise
        // target scatter mode tile
        var pacman = getObject('pacman'),
            pCol = pacman.col,
            pRow = pacman.row;
        return distance(pCol, pRow, this.col, this.row) > 8 ?
                   { col: pCol, row: pRow } :
                   this.scatterTile;
    }
});
