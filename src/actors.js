/*
 * Pac-Man and ghosts
 */

/*jslint bitwise: false */
/*global TILE_SIZE, TILE_CENTRE, ROWS, COLS, UPDATE_HZ, DEBUG
         NORTH, SOUTH, EAST, WEST,
         Sprite, Energiser, toTileCoord, toDx, toDy, reverse, distance
         level, score: true, maze */

function Actor() {}

Actor.prototype = new Sprite();

Actor.prototype.place = function (col, row) {
    this.x = col * TILE_SIZE + (this.w - TILE_SIZE) / 2;
    this.y = row * TILE_SIZE - (this.h - TILE_SIZE) / 2;
};
Actor.prototype.calcCentreX = function () {
    return this.x + this.w / 2;
};
Actor.prototype.calcCentreY = function () {
    return this.y + this.h / 2;
};
Actor.prototype.calcCol = function () {
    return Math.floor(this.calcCentreX() / TILE_SIZE);
};
Actor.prototype.calcRow = function () {
    return Math.floor(this.calcCentreY() / TILE_SIZE);
};
Actor.prototype.calcTileX = function () {
    return toTileCoord(this.calcCentreX());
};
Actor.prototype.calcTileY = function () {
    return toTileCoord(this.calcCentreY());
};

Actor.prototype.enteringTile = function () {
    var x = this.calcTileX(), y = this.calcTileY();
    return (this.direction === EAST && x === 0) ||
           (this.direction === WEST && x === TILE_SIZE - 1) ||
           (this.direction === SOUTH && y === 0) ||
           (this.direction === NORTH && y === TILE_SIZE - 1);
};

Actor.prototype.draw = function (g) {
    g.save();
    // FIXME
    g.fillStyle = this.colour;
    g.fillRect(this.x, this.y, this.w, this.h);
    g.restore();
};

/// pacman

var pacman = new Actor();
pacman.w = pacman.h = 1.5 * TILE_SIZE;
// FIXME
pacman.colour = 'yellow';
//pacman.speed = 0.8 * MAX_SPEED;

pacman.reset = function () {
    this.place(maze.HOME_COL, 26);
    this.direction = WEST;
    this.resetDotTimer();
};

pacman.resetDotTimer = function () {
    this.dotTimer = (level < 5 ? 4 : 3) * UPDATE_HZ;
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

    var col = this.calcCol();
    var reentryCol = maze.reentryCol(col);
    if (reentryCol) {
        this.x = TILE_SIZE * reentryCol;
        return;
    }

    var dot = maze.dotAt(col, this.calcRow());
    if (dot) {
        score += dot.value;
        this.wait = dot.delay;
        this.resetDotTimer();
        if (dot instanceof Energiser) {
            Ghost.frighten();
        }
        maze.remove(dot);
        // FIXME: use global counter, move this to Ghost method
        var ghost = [inky, pinky, clyde].first(function (g) {
            return g.state === Ghost.STATE_INSIDE;
        });
        if (ghost) {
            --ghost.dotCounter;
        }
    }

    // TODO: ghost collision check
};

pacman.move = function (direction) {
    var dx = 0;
    var dy = 0;
    var exiting;
    var cx = this.calcCentreX();
    var cy = this.calcCentreY();

    // Move in the given direction iff before tile centrepoint or
    // an adjacent tile lies beyond.

    if (direction === EAST) {
        dx = 1;
        exiting = toTileCoord(cx + dx) > TILE_CENTRE;
    } else if (direction === WEST) {
        dx = -1;
        exiting = toTileCoord(cx + dx) < TILE_CENTRE;
    } else if (direction === SOUTH) {
        dy = 1;
        exiting = toTileCoord(cy + dy) > TILE_CENTRE;
    } else if (direction === NORTH) {
        dy = -1;
        exiting = toTileCoord(cy + dy) < TILE_CENTRE;
    }

    if (exiting && !(direction & maze.exitsFrom(this.calcCol(), this.calcRow()))) {
        return false;
    }

    // cornering
    if (dx) {
        var localY = toTileCoord(cy);
        dy = localY > TILE_CENTRE ? -1 : localY < TILE_CENTRE ? 1 : 0;
    } else if (dy) {
        var localX = toTileCoord(cx);
        dx = localX > TILE_CENTRE ? -1 : localX < TILE_CENTRE ? 1 : 0;
    }

    this.invalidate();
    this.x += dx;
    this.y += dy;
    return true;
};

pacman.toString = function () {
    return 'pacman';
};

/// ghosts

function Ghost(name, startCol, startRow, scatterCol, scatterRow) {
    this.name = name;

    this.w = this.h = Ghost.SIZE;
    this.startCol = startCol;
    this.startRow = startRow;

    this.scatterTile = { col: scatterCol, row: scatterRow };
}

Ghost.SIZE = TILE_SIZE * 1.5;

Ghost.STATE_WAITING = 'WAITING';
Ghost.STATE_INSIDE = 'INSIDE';
Ghost.STATE_OUTSIDE = 'OUTSIDE';
Ghost.STATE_EXITING = 'EXITING';

// global modes
Ghost.MODE_CHASE = 'CHASE';
Ghost.MODE_SCATTER = 'SCATTER';
Ghost.MODE_FRIGHTENED = 'FRIGHTENED';

Ghost.prototype = new Actor();

Ghost.prototype.toString = function () {
    return this.name;
};

Ghost.prototype.reset = function () {
    this.place(this.startCol, this.startRow);
    // FIXME
    if (this.name === 'blinky') {
        this.state = Ghost.STATE_OUTSIDE;
        this.direction = WEST;
        this.nextDirection = this.calcNextDirection();
    } else {
        this.state = Ghost.STATE_INSIDE;
    }
};

Ghost.prototype.draw = function (g) {
    if (Ghost.mode === Ghost.MODE_FRIGHTENED) {
        // FIXME
        g.save();
        g.fillStyle = 'blue';
        g.fillRect(this.x, this.y, this.w, this.h);
        g.restore();
    } else {
        Actor.prototype.draw.call(this, g);
    }
};

Ghost.prototype.move = function (direction) {
    this.invalidate();
    this.x += toDx(direction);
    this.y += toDy(direction);
};

Ghost.prototype.update = function () {
    if (this.state === Ghost.STATE_WAITING || this.state === Ghost.STATE_INSIDE) {
        return;
    }

    if (this.state === Ghost.STATE_EXITING) {
        // TODO: horizontally align with exit
        this.move(NORTH);
        if (this.calcRow() === maze.HOME_ROW && this.calcTileY() === TILE_CENTRE) {
            this.state = Ghost.STATE_OUTSIDE;
            // FIXME
            this.direction = WEST;
            this.nextDirection = this.calcNextDirection();
            return;
        }
    } else if (this.state !== Ghost.STATE_OUTSIDE) {
        return;
    }

    this.move(this.direction);

    var col = this.calcCol();
    if (maze.inTunnel(col, this.calcRow())) {
        // TODO: reduce speed

        var reentryCol = maze.reentryCol(col);
        if (reentryCol) {
            this.x = TILE_SIZE * reentryCol;
        }
    }

    // Moves are computed one tile in advance - when a ghost reaches a tile, it
    // inspects the next tile in its current direction and determines which way
    // to go when it arrives at that tile.
    //
    // According to the Pac-Man Dossier, "arriving" at a tile occurs at the
    // moment an actor's centrepoint crosses the tile boundary. For the purposes
    // of this pathfinding algorithm, it is defined as the moment a ghost reaches
    // the centre of the tile. This simplifies the lookahead logic. Hopefully it
    // doesn't significantly affect gameplay.

    if (this.calcTileX() === TILE_CENTRE && this.calcTileY() === TILE_CENTRE) {
        this.direction = this.nextDirection;
        this.nextDirection = this.calcNextDirection();
    }
};

// calculate direction to be taken when next tile is reached
Ghost.prototype.calcNextDirection = function () {
    var nextCol = this.calcCol() + toDx(this.direction);
    var nextRow = this.calcRow() + toDy(this.direction);

    var exits = maze.exitsFrom(nextCol, nextRow);
    // exclude illegal moves
    exits &= ~reverse(this.direction);
    if (maze.northDisallowed(nextCol, nextRow)) {
        exits &= ~NORTH;
    }
    // check for single available exit
    if (exits === NORTH || exits === SOUTH || exits === WEST || exits === EAST) {
        return exits;
    }

    if (Ghost.mode === Ghost.MODE_FRIGHTENED) {
        // pick a random direction then cycle clockwise until a valid one is found
        var directions = [NORTH, EAST, SOUTH, WEST];
        var i = Math.floor(Math.random() * directions.length);
        var d;
        while (!(d = directions[i] & exits)) {
            i = (i + 1) % directions.length;
        }
        return d;
    }

    var target = Ghost.mode === Ghost.MODE_SCATTER ? this.scatterTile : this.calcTarget();
    var candidates = [];
    // Add candidates in tie-break order
    [NORTH, WEST, SOUTH, EAST].forEach(function (d) {
        if (exits & d) {
            candidates.push({ direction: d,
                              dist: distance(nextCol + toDx(d),
                                             nextRow + toDy(d),
                                             target.col,
                                             target.row) });
        }
    });
    candidates.sort(function (a, b) {
        return a.dist - b.dist;
    });
    if (!candidates.length) {
        throw new Error(this + ' can\'t calculate direction at [' +
                        nextCol + ', ' + nextRow + ']');
    }
    return candidates[0].direction;
};

/// blinky

var blinky = new Ghost('blinky',
                       maze.HOME_COL, maze.HOME_ROW,
                       COLS - 3, 0);
// FIXME
blinky.colour = 'red';
blinky.calcTarget = function () {
    // target pacman directly
    return { col: pacman.calcCol(), row: pacman.calcRow() };
};

/// pinky

var pinky = new Ghost('pinky',
                      maze.HOME_COL, maze.HOME_ROW + 3,
                      2, 0);
// FIXME
pinky.colour = 'pink';
pinky.calcTarget = function () {
    // target 4 tiles ahead of pacman's current direction
    return { col: pacman.calcCol() + toDx(pacman.direction) * 4,
             row: pacman.calcRow() + toDy(pacman.direction) * 4 };
};

/// inky

var inky = new Ghost('inky',
                     maze.HOME_COL - 2, maze.HOME_ROW + 3,
                     COLS - 1, ROWS - 2);
// FIXME
inky.colour = 'cyan';
inky.calcTarget = function () {
    // target tile at vector extending from blinky with midpoint 2 tiles
    // ahead of pacman
    var cx = pacman.calcCol() + toDx(pacman.direction) * 2;
    var cy = pacman.calcRow() + toDy(pacman.direction) * 2;
    return { col: cx + cx - blinky.calcCol(),
             row: cy + cy - blinky.calcRow() };
};

/// clyde

var clyde = new Ghost('clyde',
                      maze.HOME_COL + 2, maze.HOME_ROW + 3,
                      0, ROWS - 2);
// FIXME
clyde.colour = 'orange';
clyde.calcTarget = function () {
    // target pacman directly when further than 8 tiles from him, otherwise
    // target scatter mode tile
    var px = pacman.calcCol();
    var py = pacman.calcRow();
    return distance(px, py, this.calcCol(), this.calcRow()) > 8 ?
              { col: px, row: py } :
              { col: this.scatterCol, row: this.scatterRow };
};

/// aggregate functions

Ghost.all = [blinky, inky, pinky, clyde];

Ghost.resetAll = function () {
    Ghost.all.forEach(function (g) {
        g.reset();
    });

    pinky.dotCounter = 0;
    inky.dotCounter = level === 1 ? 30 : 0;
    clyde.dotCounter = level === 1 ? 60 : level === 2 ? 50 : 0;

    Ghost.modeSwitches = 0;
    Ghost.scatterChaseTimer = (level < 5 ? 7 : 5) * UPDATE_HZ;
    Ghost.mode = Ghost.MODE_SCATTER;
};

Ghost.insiders = [pinky, inky, clyde];

// maybe release a ghost from the house
Ghost.release = function() {
    var candidates = Ghost.insiders.filter(function (g) {
        return g.state === Ghost.STATE_INSIDE;
    });

    if (!candidates.length) {
        return;
    }

    if (pacman.dotTimer <= 0) {
        candidates[0].state = Ghost.STATE_EXITING;
        pacman.resetDotTimer();
    // } else if (globalCounterEnabled) {
    //     // TODO
    } else {
        var ghost = candidates.first(function (g) {
            return g.dotCounter === 0;
        });
        if (ghost) {
            ghost.state = Ghost.STATE_EXITING;
        }
    }
}

// maybe switch between modes
Ghost.updateMode = function () {
    if (Ghost.mode === Ghost.MODE_FRIGHTENED) {
        if (--Ghost.frightenedTimer <= 0) {
            Ghost.mode = Ghost.prevMode;
        }
    } else if (Ghost.modeSwitches < 7 && --Ghost.scatterChaseTimer <= 0) {
        var time;
        switch (++Ghost.modeSwitches) {
        // case 0 handled by levelUp()
        case 1:
            time = 20 * UPDATE_HZ;
            break;
        case 2:
            time = (level < 5 ? 7 : 5) * UPDATE_HZ;
            break;
        case 3:
            time = 20 * UPDATE_HZ;
            break;
        case 4:
            time = 5 * UPDATE_HZ;
            break;
        case 5:
            time = (level === 1 ? 20 :
                     level < 5 ? 1033 :
                     1037) * UPDATE_HZ;
            break;
        case 6:
            time = level === 1 ? 5 * UPDATE_HZ : 1;
            break;
        case 7:
            //
            break;
        default:
            throw new Error('unexpected number of mode changes: ' +
                            Ghost.modeSwitches);
        }
        Ghost.mode = (Ghost.modeSwitches % 2) ? Ghost.MODE_CHASE : Ghost.MODE_SCATTER;
        Ghost.scatterChaseTimer = time;
        debug('mode switch ({}): entering {} mode for {}s',
              Ghost.modeSwitches, Ghost.mode, time / UPDATE_HZ);
        Ghost.all.forEach(function (g) {
            g.nextDirection = reverse(g.direction);
        });
    }
};

// duration of frightened time in seconds, indexed by level
Ghost.FRIGHT_SEC =     [ 6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1 ];
// number of times to flash when becoming unfrightened, indexed by level
Ghost.FRIGHT_FLASHES = [ 5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 5, 3, 3, 5, 3, 3, 0, 3 ];

Ghost.frighten = function () {
    Ghost.all.forEach(function (g) {
        g.nextDirection = reverse(g.direction);
    });

    if (Ghost.mode !== Ghost.MODE_FRIGHTENED) {
        Ghost.prevMode = Ghost.mode;
    }
    Ghost.mode = Ghost.MODE_FRIGHTENED;

    var time = Ghost.FRIGHT_SEC[level - 1];
    //var flashes = Ghost.FRIGHT_FLASHES[level - 1];
    if (!time) {
        return;
    }

    debug('entering {} mode for {}s', Ghost.mode, time);
    Ghost.frightenedTimer = time * UPDATE_HZ;
    // TODO: flashing, speed
    Ghost.all.forEach(function (g) {
        // ensure stationary ghosts are redrawn
        g.invalidate();
    });
};

