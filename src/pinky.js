/*
 * The pink ghost.
 */

/*global Ghost, Maze, lookup, toDx, toDy */

function Pinky() {
    this.init();
}

Pinky.prototype = new Ghost({
    name: 'pinky',
    startCol: Maze.HOME_COL,
    startRow: Maze.HOME_ROW + 3,
    scatterCol: 2,
    scatterRow: 0,

    calcTarget: function () {
        // target 4 tiles ahead of pacman's current direction
        var pacman = lookup('pacman');
        return { col: pacman.col + toDx(pacman.direction) * 4,
                 row: pacman.row + toDy(pacman.direction) * 4 };
    }
});
