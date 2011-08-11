/*
 * Base class of entities that move through the maze.
 */

/*global EAST, Entity, Maze, NORTH, SOUTH, TILE_CENTRE, TILE_SIZE, WEST, copy */
function Actor(props) {
    copy(props, this);
}

Actor.prototype = new Entity({

    moveTo: function (x, y) {
        var min = Maze.TUNNEL_WEST_EXIT_COL * TILE_SIZE;
        var max = Maze.TUNNEL_EAST_EXIT_COL * TILE_SIZE;
        x = x < min ? max : max < x ? min : x;

        this.prevCol = this.col;
        this.prevRow = this.row;

        Entity.prototype.moveTo.call(this, x, y);

        // local x, y
        this.lx = Math.abs(this.cx % TILE_SIZE);
        this.ly = Math.abs(this.cy % TILE_SIZE);
    },

    moveBy: function (dx, dy) {
        // Actors can only move in whole-pixel offsets, but speeds (and hence
        // movements) may be provided as non-integral amounts. When such values
        // are given, the fractional amount of movement is accumulated and added
        // to the actor's next move.

        // reset accumulated value when changing direction
        if (!dx || Math.sign(dx) !== Math.sign(this.accX)) {
            this.accX = 0;
        }
        if (!dy || Math.sign(dy) !== Math.sign(this.accY)) {
            this.accY = 0;
        }

        var x = dx + (this.accX || 0);
        var y = dy + (this.accY || 0);
        var actualX = Math.trunc(x);
        var actualY = Math.trunc(y);

        this.moveTo(this.x + actualX, this.y + actualY);
        this.accX = x - actualX;
        this.accY = y - actualY;
    },

    enteringTile: function () {
        return this.col !== this.prevCol || this.row !== this.prevRow;
    }
});

Actor.exitingTile = function (direction, lx, ly) {
    return (direction === WEST && lx <= TILE_CENTRE) ||
           (direction === EAST && lx >= TILE_CENTRE) ||
           (direction === NORTH && ly <= TILE_CENTRE) ||
           (direction === SOUTH && ly >= TILE_CENTRE);
};
