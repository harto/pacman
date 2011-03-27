/*
 * Pac-Man and ghosts
 */

/*jslint bitwise: false */
/*global TILE_SIZE, TILE_CENTRE, ROWS, COLS, DEBUG, NORTH, SOUTH, EAST, WEST,
         debug, distance, format, reverse, toCol, toDx, toDy, toFrames, toRow
         Sprite, Energiser, Maze, level, score: true, dotCounter: true */

function Actor() {}

Actor.prototype = new Sprite();

Actor.prototype.centreAt = function (x, y) {
    this.moveTo(x - this.w / 2, y - this.h / 2);
};

Actor.prototype.place = function (col, row) {
    this.moveTo(col * TILE_SIZE + (this.w - TILE_SIZE) / 2,
                row * TILE_SIZE - (this.h - TILE_SIZE) / 2);
};

Actor.prototype.moveTo = function (x, y) {
    this.x = x;
    this.y = y;
    // centre x, y
    this.cx = x + this.w / 2;
    this.cy = y + this.h / 2;
    // local x, y
    this.lx = Math.abs(this.cx % TILE_SIZE);
    this.ly = Math.abs(this.cy % TILE_SIZE);

    this.prevCol = this.col;
    this.prevRow = this.row;
    this.col = toCol(this.cx);
    this.row = toRow(this.cy);
};

Actor.prototype.moveBy = function (dx, dy) {
    this.invalidate();

    // Actors can only move in whole-pixel offsets. This avoids dealing with
    // sub-pixel values when rendering and calculating in-tile locations. To
    // allow for variable speeds, any fractional amount of movement is
    // accumulated and added to the actor's next move.

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
};

Actor.prototype.enteringTile = function () {
    return this.col !== this.prevCol || this.row !== this.prevRow;
};

Actor.prototype.draw = function (g) {
    g.save();
    // FIXME
    g.fillStyle = this.colour;
    g.fillRect(this.x, this.y, this.w, this.h);
    g.restore();
};

Actor.exitingTile = function (direction, lx, ly) {
    return (direction === WEST && lx <= TILE_CENTRE) ||
           (direction === EAST && lx >= TILE_CENTRE) ||
           (direction === NORTH && ly <= TILE_CENTRE) ||
           (direction === SOUTH && ly >= TILE_CENTRE);
};

/// pacman

var pacman = new Actor();
pacman.w = pacman.h = 1.5 * TILE_SIZE;
// FIXME
pacman.colour = 'yellow';

pacman.reset = function () {
    this.centreAt(Maze.HOME_COL * TILE_SIZE, 26 * TILE_SIZE + TILE_CENTRE);
    this.direction = WEST;
    this.resetDotTimer();
};

// reset timer that releases ghost when a dot hasn't been eaten for a while
pacman.resetDotTimer = function () {
    this.dotTimer = toFrames(level < 5 ? 4 : 3);
};

pacman.update = function () {
    --this.dotTimer;

    if (this.wait) {
        --this.wait;
        return;
    }

    var newDirection = this.turning || this.direction;
    if (this.move(newDirection)) {
        this.direction = newDirection;
    } else if (this.direction !== newDirection) {
        this.move(this.direction);
    }

    if (!this.enteringTile()) {
        return;
    }

    // FIXME: most of this should live outside this method

    var reentryCol = Maze.reentryCol(this.col);
    if (reentryCol) {
        this.x = TILE_SIZE * reentryCol;
        return;
    }

    var dot = Maze.dotAt(this.col, this.row);
    if (dot) {
        score += dot.value;
        this.wait = dot.delay;
        this.resetDotTimer();
        if (dot instanceof Energiser) {
            Ghost.frightenAll();
        }
        Maze.remove(dot);
        Ghost.decrementDotCounter();
    }
};

pacman.move = function (direction) {
    var dx = 0,
        dy = 0,
        lx = this.lx,
        ly = this.ly,
        speed = this.speed;

    // Move in the given direction iff before tile centrepoint or
    // an adjacent tile lies beyond.
    //
    // FIXME: consider accumulated sub-pixel movement

    dx = toDx(direction) * speed;
    dy = toDy(direction) * speed;

    if (Actor.exitingTile(direction, lx + dx, ly + dy) &&
        !(direction & Maze.exitsFrom(this.col, this.row))) {
        return false;
    }

    // cornering
    if (dx) {
        dy = (ly > TILE_CENTRE ? -1 : ly < TILE_CENTRE ? 1 : 0) * speed;
    } else if (dy) {
        dx = (lx > TILE_CENTRE ? -1 : lx < TILE_CENTRE ? 1 : 0) * speed;
    }

    this.moveBy(dx, dy);
    return true;
};

pacman.toString = function () {
    return 'pacman';
};

/// ghosts

function Ghost(name, startCol, startRow, scatterCol, scatterRow) {
    this.name = name;

    this.w = this.h = Ghost.SIZE;
    this.startCx = startCol * TILE_SIZE;
    this.startCy = startRow * TILE_SIZE + TILE_CENTRE;

    this.scatterTile = { col: scatterCol, row: scatterRow };
}

Ghost.SIZE = TILE_SIZE * 1.5;

Ghost.STATE_ENTERING   = 1 << 0;
Ghost.STATE_INSIDE     = 1 << 1;
Ghost.STATE_EXITING    = 1 << 2;
Ghost.STATE_OUTSIDE    = 1 << 3;
Ghost.STATE_FRIGHTENED = 1 << 4;
Ghost.STATE_DEAD       = 1 << 5;
Ghost.STATE_CHASING    = 1 << 6;
Ghost.STATE_SCATTERING = 1 << 7;

Ghost.STATE_LABELS = (function () {
    var labels = {},
        k, m;
    for (k in Ghost) {
        if (Ghost.hasOwnProperty(k) && (m = /^STATE_(.+)$/.exec(k))) {
            labels[Ghost[k]] = m[1];
        }
    }
    return labels;
}());

Ghost.prototype = new Actor();

Ghost.prototype.toString = function () {
    return this.name;
};

Ghost.prototype.draw = function (g) {
    g.save();
    if (this.state & Ghost.STATE_DEAD) {
        // FIXME
        g.strokeStyle = 'blue';
        g.strokeRect(this.x, this.y, this.w, this.h);
    } else if (this.state & Ghost.STATE_FRIGHTENED) {
        // FIXME
        g.fillStyle = 'blue';
        g.fillRect(this.x, this.y, this.w, this.h);
    } else {
        Actor.prototype.draw.call(this, g);
    }
    g.restore();
};

Ghost.prototype.calcExitPath = function () {
    var x = Maze.HOME_COL * TILE_SIZE;
    var y = Maze.HOME_ROW * TILE_SIZE + TILE_CENTRE;
    return [{ x: x, y: y + 3 * TILE_SIZE }, { x: x, y: y }];
};

Ghost.prototype.update = function () {
    var speed = this.speed || Ghost.speed;
    var dx, dy;
    if (this.state & Ghost.STATE_INSIDE) {
        // FIXME: jostle
    } else if (this.state & (Ghost.STATE_ENTERING | Ghost.STATE_EXITING)) {
        // follow path into/out of house
        var point = this.path.shift();
        dx = point.x - this.cx;
        dy = point.y - this.cy;
        if (point && !(Math.abs(dx) < speed && Math.abs(dy) < speed)) {
            this.moveBy(Math.sign(dx) * speed, Math.sign(dy) * speed);
            this.path.unshift(point);
        }
        if (!this.path.length) {
            if (this.state & Ghost.STATE_ENTERING) {
                this.state &= ~Ghost.STATE_ENTERING;
                this.state |= Ghost.STATE_INSIDE;
                this.resetDotCounter();
                this.speed = null;
            } else {
                this.state &= ~Ghost.STATE_EXITING;
                this.state |= Ghost.STATE_OUTSIDE;
            }
        }
        return;
    } else if (this.state & Ghost.STATE_DEAD &&
               this.row === Maze.HOME_ROW &&
               Math.abs(this.cx - Maze.HOME_COL * TILE_SIZE) < speed) {
        debug('%s: entering house', this);
        this.state &= ~(Ghost.STATE_DEAD | Ghost.STATE_OUTSIDE);
        this.state |= Ghost.STATE_ENTERING;
        var entryPath = this.calcExitPath();
        entryPath.reverse();
        entryPath.push({ x: this.startCx, y: this.startCy });
        this.path = entryPath;
        return;
    } else {
        this.moveBy(toDx(this.direction) * speed, toDy(this.direction) * speed);
        if (this.enteringTile()) {
            this.setNextDirection(this.nextTileDirection);
            // entering/exiting tunnel?
            if (Maze.inTunnel(this.col, this.row)) {
                // TODO: reduce speed
                // FIXME: pull into main update routine
                var reentryCol = Maze.reentryCol(this.col);
                if (reentryCol) {
                    this.x = TILE_SIZE * reentryCol;
                }
            }
        } else {
            // turn at tile centre, ensuring no overshoot at >1 speed
            dx = this.lx - TILE_CENTRE;
            dy = this.ly - TILE_CENTRE;
            if (Math.abs(dx) < speed && Math.abs(dy) < speed) {
                this.moveTo(this.x - dx, this.y - dy);
                this.direction = this.currTileDirection;
            }
        }
    }
};

Ghost.prototype.setNextDirection = function (nextDirection) {
    // Direction is computed on tile entry, but not enacted until the tile
    // centre is reached. If a ghost has not yet reached the tile centre,
    // update the direction it leaves this tile. Otherwise, wait until the
    // next tile is reached.
    if (this.state & (Ghost.STATE_ENTERING | Ghost.STATE_INSIDE | Ghost.STATE_EXITING)) {
        // Set the direction to be taken when ghost gets outside the house.
        this.direction = this.currTileDirection = nextDirection;
        this.nextTileDirection = this.calcNextDirection(Maze.HOME_COL,
                                                        Maze.HOME_ROW,
                                                        nextDirection);
    }
    else if (Actor.exitingTile(this.direction, this.lx, this.ly)) {
        // wait until next tile
        this.nextTileDirection = nextDirection;
    } else {
        this.currTileDirection = nextDirection;
        this.nextTileDirection = this.calcNextDirection(this.col + toDx(nextDirection),
                                                        this.row + toDy(nextDirection),
                                                        nextDirection);
    }
};

// calculates direction to exit a tile
Ghost.prototype.calcNextDirection = function (col, row, entryDirection) {
    var exits = Maze.exitsFrom(col, row);
    // exclude illegal moves
    exits &= ~reverse(entryDirection);
    if (Maze.northDisallowed(col, row)) {
        exits &= ~NORTH;
    }
    if (!exits) {
        throw new Error(format('%s: no exits from [%s, %s]', this, col, row));
    }
    // check for single available exit
    if (exits === NORTH || exits === SOUTH || exits === WEST || exits === EAST) {
        return exits;
    }

    // When a ghost is frightened, it selects a random direction and cycles
    // clockwise until a valid exit is found. In any other mode, an exit is
    // selected according to the Euclidean distance between the exit tile and
    // some current target tile.
    var exitDirection;
    if (this.state & Ghost.STATE_FRIGHTENED) {
        var directions = [NORTH, EAST, SOUTH, WEST];
        var i = Math.floor(Math.random() * directions.length);
        while (!(exitDirection = directions[i] & exits)) {
            i = (i + 1) % directions.length;
        }
    } else {
        var target = this.state & Ghost.STATE_DEAD ? Maze.HOME_TILE :
                     this.state & Ghost.STATE_SCATTERING ? this.scatterTile :
                     this.calcTarget();

        var candidates = [];
        // Add candidates in tie-break order
        [NORTH, WEST, SOUTH, EAST].filter(function (d) {
            return exits & d;
        }).forEach(function (d) {
            candidates.push({ direction: d,
                              dist: distance(col + toDx(d),
                                             row + toDy(d),
                                             target.col,
                                             target.row) });
        });
        candidates.sort(function (a, b) {
            return a.dist - b.dist;
        });
        exitDirection = candidates[0].direction;
    }
    return exitDirection;
};

Ghost.prototype.resetDotCounter = function () {
    this.dotCounter = 0;
};

/// blinky

var blinky = new Ghost('blinky',
                       Maze.HOME_COL, Maze.HOME_ROW,
                       COLS - 3, 0);
// FIXME
blinky.colour = 'red';
blinky.calcTarget = function () {
    // target pacman directly
    return { col: pacman.col, row: pacman.row };
};

/// pinky

var pinky = new Ghost('pinky',
                      Maze.HOME_COL, Maze.HOME_ROW + 3,
                      2, 0);
// FIXME
pinky.colour = 'pink';
pinky.calcTarget = function () {
    // target 4 tiles ahead of pacman's current direction
    return { col: pacman.col + toDx(pacman.direction) * 4,
             row: pacman.row + toDy(pacman.direction) * 4 };
};

/// inky

var inky = new Ghost('inky',
                     Maze.HOME_COL - 2, Maze.HOME_ROW + 3,
                     COLS - 1, ROWS - 2);
// FIXME
inky.colour = 'cyan';
inky.calcTarget = function () {
    // target tile at vector extending from blinky with midpoint 2 tiles
    // ahead of pacman
    var cx = pacman.col + toDx(pacman.direction) * 2;
    var cy = pacman.row + toDy(pacman.direction) * 2;
    return { col: cx + cx - blinky.col,
             row: cy + cy - blinky.row };
};
inky.resetDotCounter = function () {
    this.dotCounter = level === 1 ? 30 : 0;
};

/// clyde

var clyde = new Ghost('clyde',
                      Maze.HOME_COL + 2, Maze.HOME_ROW + 3,
                      0, ROWS - 2);
// FIXME
clyde.colour = 'orange';
clyde.calcTarget = function () {
    // target pacman directly when further than 8 tiles from him, otherwise
    // target scatter mode tile
    var pCol = pacman.col;
    var pRow = pacman.row;
    return distance(pCol, pRow, this.col, this.row) > 8 ?
              { col: pCol, row: pRow } :
              this.scatterTile;
};
clyde.resetDotCounter = function () {
    this.dotCounter = level === 1 ? 60 : level === 2 ? 50 : 0;
};

/// aggregate functions

Ghost.all = [blinky, inky, pinky, clyde];

Ghost.resetAll = function () {
    Ghost.all.forEach(function (g) {
        g.state = Ghost.STATE_INSIDE | Ghost.STATE_SCATTERING;
        g.resetDotCounter();
        g.centreAt(g.startCx, g.startCy);
        g.setNextDirection(WEST);
    });

    blinky.state &= ~Ghost.STATE_INSIDE;

    Ghost.modeSwitches = 0;
    Ghost.scatterChaseTimer = toFrames(level < 5 ? 7 : 5);
    Ghost.speed = Ghost.calcSpeed(level);
    Ghost.useGlobalCounter = false;
    Ghost.dotCounter = 0;
};

// Ghosts are individually released from the house according to the number of
// dots eaten by Pac-Man and the time since a dot was last eaten.
//
// At the start of each level, each ghost is initialised with a personal dot
// counter that tracks the number of dots eaten by Pac-Man. Each time a dot is
// eaten, the counter of the most preferred ghost within the house (in order:
// Pinky, Inky and Clyde) is decremented. When a ghost's counter is zero, it is
// released.
//
// Whenever a life is lost, a global dot counter is used in place of the
// individual counters. Ghosts are released according to the value of this
// counter: Pinky at 7, Inky at 17 and Clyde at 32. If Clyde is inside the house
// when the counter reaches 32, the individual dot counters are used henceforth
// as previously described. Otherwise, the global counter remains in effect.
//
// Additionally, a timer tracks the time since Pac-Man last ate a dot. If no dot
// is eaten for some level-specific amount of time, the preferred ghost is
// released.

// get the ghosts currently inside the house
Ghost.insiders = function () {
    return [blinky, pinky, inky, clyde].filter(function (g) {
        return g.state & Ghost.STATE_INSIDE;
    });
};

Ghost.decrementDotCounter = function () {
    if (Ghost.useGlobalCounter) {
        if (++Ghost.dotCounter === 32 && clyde.state & Ghost.STATE_INSIDE) {
            Ghost.useGlobalCounter = false;
        }
    } else {
        var insiders = Ghost.insiders();
        if (insiders.length) {
            --insiders[0].dotCounter;
        }
    }
};

// maybe release a ghost from the house
Ghost.maybeRelease = function () {
    var insiders = Ghost.insiders();
    if (!insiders.length) {
        // nobody home
        return;
    }

    var ghost;
    if (pacman.dotTimer <= 0) {
        pacman.resetDotTimer();
        ghost = insiders[0];
    } else {
        ghost = insiders.first(function (g) {
            return g.dotCounter <= 0;
        });
        ghost = ghost ||
            // check global counter
            (Ghost.dotCounter === 7 && pinky.state & Ghost.STATE_INSIDE ? pinky :
             Ghost.dotCounter === 17 && inky.state & Ghost.STATE_INSIDE ? inky :
             Ghost.dotCounter === 32 && clyde.state & Ghost.STATE_INSIDE ? clyde :
             null);
    }
    if (ghost) {
        ghost.state &= ~Ghost.STATE_INSIDE;
        ghost.state |= Ghost.STATE_EXITING;
        ghost.path = ghost.calcExitPath();
    }
};

// maybe switch between modes
Ghost.maybeUpdateMode = function () {
    if (Ghost.frightened && --Ghost.frightenedTimer <= 0) {
        Ghost.frightened = false;
        Ghost.all.forEach(function (g) {
            g.state &= ~Ghost.STATE_FRIGHTENED;
        });
        // debug('resuming %s mode for %t',
        //       Ghost.mode,
        //       Ghost.scatterChaseTimer);
        Ghost.speed = Ghost.calcSpeed(level);
    } else if (Ghost.modeSwitches < 7 && --Ghost.scatterChaseTimer <= 0) {
        var newState, oldState;
        if (++Ghost.modeSwitches % 2) {
            newState = Ghost.STATE_CHASING;
            oldState = Ghost.STATE_SCATTERING;
        } else {
            newState = Ghost.STATE_SCATTERING;
            oldState = Ghost.STATE_CHASING;
        }
        Ghost.all.forEach(function (g) {
            g.state &= ~oldState;
            g.state |= newState;
        });
        Ghost.scatterChaseTimer =
            Ghost.modeSwitches === 1 ? toFrames(20) :
            Ghost.modeSwitches === 2 ? toFrames(level < 5 ? 7 : 5) :
            Ghost.modeSwitches === 3 ? toFrames(20) :
            Ghost.modeSwitches === 4 ? toFrames(5) :
            Ghost.modeSwitches === 5 ? toFrames(level === 1 ? 20 :
                                                level < 5 ? 1033 :
                                                1037) :
            Ghost.modeSwitches === 6 ? (level === 1 ? toFrames(5) : 1) :
            null;
        debug('mode switch (%s): %s for %t',
              Ghost.modeSwitches,
              Ghost.STATE_LABELS[newState],
              Ghost.scatterChaseTimer);
        Ghost.reverseAll();
    }
};

// duration of frightened time in seconds, indexed by level
Ghost.FRIGHT_SEC =     [null, 6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1];
// number of times to flash when becoming unfrightened, indexed by level
Ghost.FRIGHT_FLASHES = [null, 5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 5, 3, 3, 5, 3, 3, 0, 3];

Ghost.reverseAll = function () {
    Ghost.all.filter(function (g) {
        return !(g.state & Ghost.STATE_DEAD);
    }).forEach(function (g) {
        g.setNextDirection(reverse(g.direction));
    });
};

Ghost.frightenAll = function () {
    Ghost.reverseAll();

    var time = Ghost.FRIGHT_SEC[level];
    //var flashes = Ghost.FRIGHT_FLASHES[level];
    if (!time) {
        return;
    }

    debug('%s for %ss',
          Ghost.STATE_LABELS[Ghost.STATE_FRIGHTENED],
          time);
    Ghost.frightened = true;
    Ghost.frightenedTimer = toFrames(time);
    // TODO: flashing
    Ghost.speed = Ghost.calcFrightenedSpeed(level);
    Ghost.all.forEach(function (g) {
        g.state |= Ghost.STATE_FRIGHTENED;
        // ensure stationary ghosts are redrawn
        // FIXME: might be unnecessary
        g.invalidate();
    });
};

Ghost.calcSpeed = function (level) {
    return level === 1 ? 0.75 :
           2 <= level && level <= 4 ? 0.85 :
           0.95;
};

Ghost.calcFrightenedSpeed = function (level) {
    return level === 1 ? 0.5 :
           2 <= level && level <= 4 ? 0.55 :
           0.6;
};

Ghost.calcTunnelSpeed = function (level) {
    return level === 1 ? 0.4 :
           2 <= level && level <= 4 ? 0.45 :
           0.5;
};

Ghost.processCollisions = function () {
    Ghost.all.filter(function (g) {
        return !(g.state & Ghost.STATE_DEAD) &&
               pacman.col === g.col &&
               pacman.row === g.row;
    }).forEach(function (g) {
        if (g.state & Ghost.STATE_FRIGHTENED) {
            debug('killing %s', g);
            g.state &= ~Ghost.STATE_FRIGHTENED;
            g.state |= Ghost.STATE_DEAD;
            g.speed = 2;
        } else {
            pacman.dead = true;
        }
    });
};

