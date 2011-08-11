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

    // Actors can only move in whole-pixel offsets, but speeds (and hence
    // movements) may be provided as non-integral amounts. When such values
    // are given, the fractional amount of movement is accumulated and added
    // to the actor's next move.

    moveBy: function (dx, dy) {
        function addAccumulated(v, acc) {
            // Discard accumulated value when changing direction
            return v + (v && Math.sign(v) === Math.sign(acc) ? acc : 0);
        }

        var realDx = addAccumulated(dx, this.accDx);
        var realDy = addAccumulated(dy, this.accDy);
        var integralDx = Math.trunc(realDx);
        var integralDy = Math.trunc(realDy);

        this.moveTo(this.x + integralDx, this.y + integralDy);
        this.accDx = realDx - integralDx;
        this.accDy = realDy - integralDy;
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
