/*
 * Base class of entities that move through the maze.
 */

/*global EAST, Entity, Maze, NORTH, SOUTH, TILE_CENTRE, TILE_SIZE, WEST, copy,
  toCol, toDx, toDy, toRow */

function Actor(props) {
    copy(props, this);
}

// Actors can only move in whole-pixel offsets, but speeds (and hence movements)
// may be provided as non-integral amounts. When such values are given, the
// fractional amount of movement is accumulated and added to the actor's next
// move.

Actor._calcMove = function (dx, dy, accDx, accDy) {
    function addAccumulated(v, acc) {
        // Discard accumulated value when changing direction
        return v + (v && Math.sign(v) === Math.sign(acc) ? acc : 0);
    }

    var realDx = addAccumulated(dx, accDx);
    var realDy = addAccumulated(dy, accDy);

    var integralDx = Math.trunc(realDx);
    var integralDy = Math.trunc(realDy);

    return { dx: integralDx,
             dy: integralDy,
             accDx: realDx - integralDx,
             accDy: realDy - integralDy };
};

Actor._pastTileCentre = function (lx, ly, direction) {
    return (direction === WEST && lx <= TILE_CENTRE) ||
           (direction === EAST && lx >= TILE_CENTRE) ||
           (direction === NORTH && ly <= TILE_CENTRE) ||
           (direction === SOUTH && ly >= TILE_CENTRE);
};

Actor.prototype = new Entity({

    pastTileCentre: function () {
        return Actor._pastTileCentre(this.lx, this.ly, this.direction);
    },

    moveBy: function (dx, dy) {
        this.applyMove(Actor._calcMove(dx, dy, this.accDx, this.accDy));
    },

    calcMove: function (dx, dy) {
        return Actor._calcMove(dx, dy, this.accDx, this.accDy);
    },

    applyMove: function (move) {
        this.moveTo(this.x + move.dx, this.y + move.dy);
        this.accDx = move.accDx;
        this.accDy = move.accDy;
    },

    moveSwitchesTile: function (x, y, move) {
        return toCol(x) !== toCol(x + move.dx) ||
               toRow(y) !== toRow(y + move.dy);
    },

    // check if planned move goes past tile centre in given direction
    movesPastTileCentre: function (move, direction) {
        return Actor._pastTileCentre(this.lx + move.dx, this.ly + move.dy, direction);
    },

    // Raw placement function - doesn't account for accumulated dx, dy
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
    }
});
