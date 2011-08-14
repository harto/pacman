/*
 * Ghost class and aggregate utility functions.
 */

/*jslint bitwise:false */
/*global Actor, EAST, MAX_SPEED, Maze, NORTH, SOUTH, SpriteMap, TILE_CENTRE,
  TILE_SIZE, UPDATE_HZ, WEST, bind, copy, debug, distance, enqueueInitialiser,
  format, keys, level, lookup, ordinal, resources, reverse, toDx, toDy, toRow,
  toTicks */

function Ghost(props) {
    copy(props, this);
    // XXX: call this animTicks or something
    this.nTicks = 0;
    this.w = this.h = Ghost.SIZE;
    this.z = 2;
}

Ghost.STATE_ENTERING   = 1 << 0;
Ghost.STATE_INSIDE     = 1 << 1;
Ghost.STATE_EXITING    = 1 << 2;
Ghost.STATE_FRIGHTENED = 1 << 3;
Ghost.STATE_DEAD       = 1 << 4;
Ghost.STATE_CHASING    = 1 << 5;
Ghost.STATE_SCATTERING = 1 << 6;
Ghost.STATE_ELROY_1    = 1 << 7;
Ghost.STATE_ELROY_2    = 1 << 8;

Ghost.STATE_LABELS = (function () {
    var labels = {};
    keys(Ghost).forEach(function (k) {
        var m = /^STATE_(.+)$/.exec(k);
        if (m) {
            labels[Ghost[k]] = m[1];
        }
    });
    return labels;
}());

// Returns ghosts in the given state, in preferred-release-order.
Ghost.all = function (state) {
    return ['blinky', 'pinky', 'inky', 'clyde'].map(function (id) {
        return lookup(id);
    }).filter(function (g) {
        return !state || g.is(state);
    });
};

// Gets the number of points that a ghost is worth. This is determined by the
// number of ghosts killed, which is inferred from the number of currently
// frightened ghosts.
Ghost.calcGhostScore = function (nFrightened) {
    return Math.pow(2, 4 - nFrightened) * 200;
};

// duration of frightened time, indexed by level
Ghost.FRIGHT_TICKS = [null, 6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1].map(toTicks);
// number of times to flash when becoming unfrightened, indexed by level
Ghost.FRIGHT_FLASHES = [null, 5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 5, 3, 3, 5, 3, 3, 0, 3];

Ghost.ANIM_FREQ = UPDATE_HZ / 10;
Ghost.SPRITES = {};
Ghost.SIZE = 28;

enqueueInitialiser(function () {
    var w = Ghost.SIZE,
        h = Ghost.SIZE,
        ids = ['blinky', 'pinky', 'inky', 'clyde', 'frightened', 'flashing', 'dead'];
    ids.forEach(function (id) {
        Ghost.SPRITES[id] = new SpriteMap(resources.getImage(id), w, h);
    });
});

Ghost.prototype = new Actor({

    start: function () {
        this.startCx = this.startCol * TILE_SIZE;
        this.startCy = this.startRow * TILE_SIZE + TILE_CENTRE;
        this.centreAt(this.startCx, this.startCy);

        if (toRow(this.startCy) !== Maze.HOME_ROW) {
            this.set(Ghost.STATE_INSIDE);
        }
        this.set(Ghost.STATE_SCATTERING);

        this.setNextDirection(WEST);
    },

    toString: function () {
        return this.name;
    },

    set: function (state) {
        //debug('%s: entering state %s', this, Ghost.STATE_LABELS[state]);
        this.state |= state;
    },

    unset: function (state) {
        //debug('%s: leaving state %s', this, Ghost.STATE_LABELS[state]);
        this.state &= ~state;
    },

    is: function (state) {
        return this.state & state;
    },

    repaint: function (g) {
        var sprites =
                this.is(Ghost.STATE_DEAD) ? Ghost.SPRITES.dead :
                this.is(Ghost.STATE_FRIGHTENED) ? (this.flashing ?
                                                   Ghost.SPRITES.flashing :
                                                   Ghost.SPRITES.frightened) :
                Ghost.SPRITES[this.name],
            spriteCol = Math.floor(this.nTicks / Ghost.ANIM_FREQ) % sprites.cols,
            spriteRow = ordinal(this.currTileDirection);
        g.save();
        sprites.draw(g, this.x, this.y, spriteCol, spriteRow);
        g.restore();
    },

    release: function () {
        debug('%s: exiting', this);
        this.unset(Ghost.STATE_INSIDE);
        this.set(Ghost.STATE_EXITING);
        this.path = this.calcExitPath();
    },

    calcExitPath: function () {
        var x = Maze.HOME_COL * TILE_SIZE;
        var y = Maze.HOME_ROW * TILE_SIZE + TILE_CENTRE;
        return [{ x: x, y: y + 3 * TILE_SIZE }, { x: x, y: y }];
    },

    calcEntryPath: function () {
        var path = this.calcExitPath();
        path.reverse();
        if (toRow(this.startCy) !== Maze.HOME_ROW) {
            // return ghosts to start column in house
            path.push({ x: this.startCx, y: this.startCy });
        }
        return path;
    },

    calcSpeed: function () {
        // XXX: entry/exit and dead speeds are just estimates
        return (this.is(Ghost.STATE_ENTERING) || this.is(Ghost.STATE_EXITING) ? 0.6 :
                this.is(Ghost.STATE_DEAD) ? 2 :
                Maze.inTunnel(this.col, this.row) ? (level === 1 ? 0.4 :
                                                     level < 5 ? 0.45 :
                                                     0.5) :
                this.is(Ghost.STATE_FRIGHTENED) ? (level === 1 ? 0.5 :
                                                   level < 5 ? 0.55 :
                                                   0.6) :
                this.is(Ghost.STATE_ELROY_2) ? (level === 1 ? 0.85 :
                                                level < 5 ? 0.95 :
                                                1.05) :
                this.is(Ghost.STATE_ELROY_1) ? (level === 1 ? 0.8 :
                                                level < 5 ? 0.9 :
                                                1) :
                (level === 1 ? 0.75 : level < 5 ? 0.85 : 0.95)) * MAX_SPEED;
    },

    update: function () {
        if (this.is(Ghost.STATE_INSIDE)) {
            this.jostle();
        } else if (this.is(Ghost.STATE_ENTERING) || this.is(Ghost.STATE_EXITING)) {
            this.enterExitHouse();
        } else if (this.shouldEnterHouse()) {
            this.startEnteringHouse();
        } else {
            this.move();
        }
        this.nTicks++;
    },

    jostle: function () {
        // FIXME
        this.invalidate();
    },

    // follow path into/out of house
    enterExitHouse: function () {
        var point = this.path.shift(),
            dx = point.x - this.cx,
            dy = point.y - this.cy,
            speed = this.calcSpeed();
        if (point && !(Math.abs(dx) < speed && Math.abs(dy) < speed)) {
            this.moveBy(Math.sign(dx) * speed, Math.sign(dy) * speed);
            this.path.unshift(point);
        }
        if (!this.path.length) {
            if (this.is(Ghost.STATE_ENTERING)) {
                this.unset(Ghost.STATE_ENTERING);
                this.set(Ghost.STATE_INSIDE);
            } else {
                this.unset(Ghost.STATE_EXITING);
            }
        }
    },

    shouldEnterHouse: function () {
        return this.is(Ghost.STATE_DEAD) &&
               this.row === Maze.HOME_ROW &&
               Math.abs(this.cx - Maze.HOME_COL * TILE_SIZE) < this.calcSpeed();
    },

    startEnteringHouse: function () {
        debug('%s: entering house', this);
        this.unset(Ghost.STATE_DEAD);
        this.set(Ghost.STATE_ENTERING);
        this.path = this.calcEntryPath();
    },

    move: function () {
        var speed = this.calcSpeed();
        this.moveBy(toDx(this.direction) * speed, toDy(this.direction) * speed);
        if (this.enteringTile()) {
            this.setNextDirection(this.nextTileDirection);
        } else if (this.direction !== this.currTileDirection) {
            // Change direction if at or beyond tile centre
            var cDx = this.lx - TILE_CENTRE;
            var cDy = this.ly - TILE_CENTRE;
            if (Math.abs(cDx) < speed && Math.abs(cDy) < speed) {
                this.moveTo(this.x - cDx, this.y - cDy);
                this.direction = this.currTileDirection;
            }
        }
    },

    // Sets the direction to be taken when the centre of a tile is next reached.
    // This method is most frequently called when a ghost enters a new tile, but
    // is also invoked on mode switches (scatter->chase and vice-versa,
    // frightened) and on initialisation.
    //
    // The following properties track ghost direction:
    //   direction:         current direction
    //   currTileDirection: direction to take when current tile centre is reached
    //   nextTileDirection: direction to take when next tile centre is reached
    setNextDirection: function (nextDirection) {
        if (this.is(Ghost.STATE_ENTERING) ||
            this.is(Ghost.STATE_EXITING) ||
            this.direction === undefined) {
            // Set the direction to be taken when ghost leaves the house.
            // FIXME: needs work to support in-house jostling
            this.direction = this.currTileDirection = nextDirection;
            this.nextTileDirection = this.calcNextDirection(Maze.HOME_COL,
                                                            Maze.HOME_ROW,
                                                            nextDirection);
        } else if (Actor.exitingTile(this.direction, this.lx, this.ly)) {
            // Too late to change in this tile; wait until next one
            this.nextTileDirection = nextDirection;
        } else {
            // Set direction to leave current tile
            this.currTileDirection = nextDirection;
            this.nextTileDirection = this.calcNextDirection(this.col + toDx(nextDirection),
                                                            this.row + toDy(nextDirection),
                                                            nextDirection);
        }
    },

    // calculates direction to exit a tile
    calcNextDirection: function (col, row, entryDirection) {
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
        if (this.is(Ghost.STATE_FRIGHTENED)) {
            var directions = [NORTH, EAST, SOUTH, WEST];
            var i = Math.floor(Math.random() * directions.length);
            while (!(exitDirection = directions[i] & exits)) {
                i = (i + 1) % directions.length;
            }
        } else {
            var target = this.is(Ghost.STATE_DEAD) ? Maze.HOME_TILE :
                         this.is(Ghost.STATE_SCATTERING) ? this.scatterTile :
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
    },

    colliding: function (pacman) {
        return pacman.col === this.col &&
               pacman.row === this.row &&
               !this.is(Ghost.STATE_DEAD) ? this : null;
    },

    kill: function () {
        this.unfrighten();
        this.set(Ghost.STATE_DEAD);
    },

    energiserEaten: function () {
        if (!this.is(Ghost.STATE_DEAD)) {
            this.reverse();
        }

        var frightTicks = Ghost.FRIGHT_TICKS[level];
        if (!frightTicks) {
            return;
        }

        // cancel any existing timers
        this.unfrighten();
        this.set(Ghost.STATE_FRIGHTENED);
        // ensure stationary ghosts are redrawn
        // FIXME: might be unnecessary
        this.invalidate();

        var events = lookup('events');

        this.unfrightenTimer = events.delay(frightTicks, bind(this, function () {
            this.unfrighten();
        }));

        var flashes = 2 * Ghost.FRIGHT_FLASHES[level],
            // FIXME: won't work for later levels
            flashDuration = toTicks(0.25),
            flashStart = frightTicks - (flashes + 1) * flashDuration;

        this.flashing = false;
        this.startFlashTimer = events.delay(flashStart, bind(this, function () {
            this.flashTimer = events.repeat(flashDuration, bind(this, function () {
                this.flashing = !this.flashing;
            }), flashes);
        }));
    },

    unfrighten: function () {
        var events = lookup('events');
        events.cancel(this.unfrightenTimer);
        events.cancel(this.startFlashTimer);
        events.cancel(this.flashTimer);
        this.unset(Ghost.STATE_FRIGHTENED);
    },

    reverse: function () {
        this.setNextDirection(reverse(this.direction));
    }
});
