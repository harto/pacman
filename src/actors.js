/*
 * Pac-Man and ghosts
 */

/*jslint bitwise: false */
/*global COLS, Dot, EAST, Entity, InlineScore, MAX_SPEED, Maze, Mode, NORTH,
  ROWS, SOUTH, ScreenBuffer, SpriteMap, TILE_CENTRE, TILE_SIZE, UPDATE_HZ,
  WEST, all, bind, broadcast, copy, debug, distance, enqueueInitialiser,
  enterMode, format, keys, level, lookup, noop, ordinal, resources, reverse,
  toDx, toDy, toRow, toSeconds, toTicks, wait */

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

/// pacman

function drawPacman(g, x, y, radius, fraction, startAngle) {
    g.save();
    g.beginPath();
    g.moveTo(x, y);
    var start = startAngle || 0;
    var angle = Math.PI - fraction * Math.PI;
    g.arc(x, y, radius, start + angle, start + (angle === 0 ? 2 * Math.PI : -angle));
    g.moveTo(x, y);
    g.closePath();
    g.fillStyle = 'yellow';
    g.fill();
    g.restore();
}

function Pacman() {
    this.centreAt(Maze.PACMAN_X, Maze.PACMAN_Y);
    this.direction = WEST;
    this.frameIndex = 0;
    this.animStepInc = 1;
    this.speed = (level === 1 ? 0.8 :
                  level < 5 || level > 20 ? 0.9 :
                  1) * MAX_SPEED;
}

Pacman.WIDTH = Pacman.HEIGHT = 1.5 * TILE_SIZE;
Pacman.ANIM_STEPS = 12;
Pacman.MAX_ANIM_STEP = Math.floor(Pacman.ANIM_STEPS * 1 / 3);

// programmatically pre-render frames
enqueueInitialiser(function () {
    var w = Pacman.WIDTH,
        h = Pacman.HEIGHT,
        // iterate through directions in increasing-degrees order
        directions = [EAST, SOUTH, WEST, NORTH],
        steps = Pacman.ANIM_STEPS,
        buf = new ScreenBuffer(w * steps, h * directions.length),
        g = buf.getContext('2d'),
        radius = w / 2,
        direction, angle, startAngle, x, y, col, row;
    for (row = 0; row < directions.length; row++) {
        direction = directions[row];
        startAngle = row * Math.PI / 2;
        y = ordinal(direction) * h + radius;
        for (col = 0; col < steps; col++) {
            drawPacman(g, col * w + radius, y, radius,
                       (steps - col) / steps, startAngle);
        }
    }
    Pacman.SPRITES = new SpriteMap(buf, w, h);
});

Pacman.prototype = new Actor({

    w: Pacman.WIDTH,
    h: Pacman.HEIGHT,
    z: 1,

    dotEaten: function (d) {
        // stub update() for duration of dot delay
        this.update = noop;
        lookup('events').delay(d.delay, bind(this, function () {
            delete this.update;
        }));
    },

    energiserEaten: function (e) {
        this.dotEaten(e);
    },

    repaint: function (g) {
        Pacman.SPRITES.draw(g, this.x, this.y, this.frameIndex, ordinal(this.direction));
    },

    update: function () {
        if (this.dying) {
            // TODO: death sequence
            this.dead = true;
            return;
        }

        var newDirection = this.turning || this.direction;
        if (this.move(newDirection)) {
            this.direction = newDirection;
        } else if (this.direction !== newDirection) {
            this.move(this.direction);
        }
    },

    move: function (direction) {
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
        // update animation cycle
        this.frameIndex += this.animStepInc;
        if (this.frameIndex === 0 || this.frameIndex === Pacman.MAX_ANIM_STEP) {
            this.animStepInc *= -1;
        }
        return true;
    },

    toString: function () {
        return 'pacman';
    }
});

/// ghosts

function Ghost(props) {
    copy(props, this);
    // XXX: call this animTicks or something
    this.nTicks = 0;
    this.state = 0;
    this.startCx = this.startCol * TILE_SIZE;
    this.startCy = this.startRow * TILE_SIZE + TILE_CENTRE;
    this.scatterTile = { col: this.scatterCol, row: this.scatterRow };
}

Ghost.STATE_ENTERING   = 1 << 0;
Ghost.STATE_INSIDE     = 1 << 1;
Ghost.STATE_EXITING    = 1 << 2;
Ghost.STATE_FRIGHTENED = 1 << 3;
Ghost.STATE_DEAD       = 1 << 4;
Ghost.STATE_CHASING    = 1 << 5;
Ghost.STATE_SCATTERING = 1 << 6;

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
        return g.is(state);
    });
};

// duration of frightened time, indexed by level
Ghost.FRIGHT_TICKS = [null, 6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1].map(toTicks);
// number of times to flash when becoming unfrightened, indexed by level
Ghost.FRIGHT_FLASHES = [null, 5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 5, 3, 3, 5, 3, 3, 0, 3];

Ghost.ANIM_FREQ = UPDATE_HZ / 6;
Ghost.SPRITES = {};

enqueueInitialiser(function () {
    var w = Ghost.prototype.w,
        h = Ghost.prototype.h,
        ids = ['blinky', 'pinky', 'inky', 'clyde', 'frightened', 'flashing', 'dead'];
    ids.forEach(function (id) {
        Ghost.SPRITES[id] = new SpriteMap(resources.getImage(id), w, h);
    });
});

Ghost.prototype = new Actor({

    w: 28,
    h: 28,

    z: 2,

    init: function () {
        this.set(Ghost.STATE_INSIDE);
        this.set(Ghost.STATE_SCATTERING);
        this.centreAt(this.startCx, this.startCy);
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
            spriteRow = ordinal(this.direction);
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
        return (this.is(Ghost.STATE_DEAD) || this.is(Ghost.STATE_ENTERING) ? 2 :
                Maze.inTunnel(this.col, this.row) ?
                    (level === 1 ? 0.4 :
                     2 <= level && level <= 4 ? 0.45 :
                     0.5) :
                this.is(Ghost.STATE_FRIGHTENED) ?
                    (level === 1 ? 0.5 :
                     2 <= level && level <= 4 ? 0.55 :
                     0.6) :
                (level === 1 ? 0.75 :
                 2 <= level && level <= 4 ? 0.85 :
                 0.95)) * MAX_SPEED;
    },

    update: function () {
        var speed = this.calcSpeed();
        var dx, dy;
        this.nTicks++;
        if (this.is(Ghost.STATE_INSIDE)) {
            // FIXME: jostle
            this.invalidate();
        } else if (this.is(Ghost.STATE_ENTERING) || this.is(Ghost.STATE_EXITING)) {
            // follow path into/out of house
            var point = this.path.shift();
            dx = point.x - this.cx;
            dy = point.y - this.cy;
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
            return;
        } else if (this.is(Ghost.STATE_DEAD) &&
                   this.row === Maze.HOME_ROW &&
                   Math.abs(this.cx - Maze.HOME_COL * TILE_SIZE) < speed) {
            debug('%s: entering house', this);
            this.unset(Ghost.STATE_DEAD);
            this.set(Ghost.STATE_ENTERING);
            this.path = this.calcEntryPath();
            return;
        } else {
            this.moveBy(toDx(this.direction) * speed, toDy(this.direction) * speed);
            if (this.enteringTile()) {
                this.setNextDirection(this.nextTileDirection);
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
    },

    setNextDirection: function (nextDirection) {
        // Direction is computed on tile entry, but not enacted until the tile
        // centre is reached. If a ghost has not yet reached the tile centre,
        // update the direction it leaves this tile. Otherwise, wait until the
        // next tile is reached.
        if (this.is(Ghost.STATE_ENTERING) ||
            this.is(Ghost.STATE_INSIDE) ||
            this.is(Ghost.STATE_EXITING)) {
            // Set the direction to be taken when ghost gets outside the house.
            this.direction = this.currTileDirection = nextDirection;
            this.nextTileDirection = this.calcNextDirection(Maze.HOME_COL,
                                                            Maze.HOME_ROW,
                                                            nextDirection);
        } else if (Actor.exitingTile(this.direction, this.lx, this.ly)) {
            // wait until next tile
            this.nextTileDirection = nextDirection;
        } else {
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

    checkCollision: function (pacman) {
        if (pacman.col !== this.col || pacman.row !== this.row || this.is(Ghost.STATE_DEAD)) {
            return;
        }

        if (this.is(Ghost.STATE_FRIGHTENED)) {
            debug('%s: dying', this);
            pacman.setVisible(false);
            this.setVisible(false);
            this.set(Ghost.STATE_DEAD);
            // FIXME: add to actual score
            var score = new InlineScore(200, this.cx, this.cy);
            score.insert();
            wait(toTicks(0.5), bind(this, function () {
                score.remove();
                pacman.setVisible(true);
                this.setVisible(true);
                this.unfrighten();
            }));
        } else {
            broadcast('pacmanKilled');
            enterMode(Mode.DYING);
        }
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

function Inky() {
    this.init();
}

Inky.prototype = new Ghost({
    name: 'inky',
    startCol: Maze.HOME_COL - 2,
    startRow: Maze.HOME_ROW + 3,
    scatterCol: COLS - 1,
    scatterRow: ROWS - 2,

    calcTarget: function () {
        // target tile at vector extending from blinky with midpoint 2 tiles
        // ahead of pacman
        var pacman = lookup('pacman'),
            blinky = lookup('blinky');
        var cx = pacman.col + toDx(pacman.direction) * 2;
        var cy = pacman.row + toDy(pacman.direction) * 2;
        return { col: cx + cx - blinky.col,
                 row: cy + cy - blinky.row };
    }
});

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

function ReleaseTimer(level) {
    this.frequency = toTicks(level < 5 ? 4 : 3);
}

ReleaseTimer.prototype = {

    start: function () {
        var events = lookup('events');
        this.timer = events.repeat(this.frequency, function () {
            var ghost = Ghost.all(Ghost.STATE_INSIDE)[0];
            if (ghost) {
                debug('dot-eaten timeout');
                ghost.release();
            }
        });
    },

    dotEaten: function () {
        this.timer.reset();
    }
};

function DotCounter(level) {
    this.counters = {
        blinky: 0,
        pinky: 0,
        inky: level === 1 ? 30 : 0,
        clyde: level === 1 ? 60 : level === 2 ? 50 : 0
    };
}

DotCounter.prototype = {

    dotEaten: function () {
        if (this.useGlobalCounter && ++this.globalCounter === 32 && lookup('clyde').is(Ghost.STATE_INSIDE)) {
            this.useGlobalCounter = false;
        } else {
            var first = Ghost.all(Ghost.STATE_INSIDE)[0];
            if (first) {
                --this.counters[first.name];
            }
        }
    },

    // Check counters and maybe release. This happens every frame, not just when
    // a dot is eaten, to ensure that ghosts with a zero dot count are instantly
    // released.
    update: function () {
        var ghost,
            blinky = lookup('blinky');
        // The Pac-Man Dossier suggests that Blinky isn't affected by the global
        // dot counter, so just instantly release him whenever he comes inside.
        if (blinky.is(Ghost.STATE_INSIDE)) {
            ghost = blinky;
        } else if (this.useGlobalCounter) {
            var pinky = lookup('pinky'),
                inky = lookup('inky'),
                clyde = lookup('clyde');
            ghost = this.dotCounter === 7 && pinky.is(Ghost.STATE_INSIDE) ? pinky :
                    this.dotCounter === 17 && inky.is(Ghost.STATE_INSIDE) ? inky :
                    this.dotCounter === 32 && clyde.is(Ghost.STATE_INSIDE) ? clyde :
                    null;
        } else {
            var counters = this.counters;
            ghost = Ghost.all(Ghost.STATE_INSIDE).first(function (g) {
                return counters[g.name] <= 0;
            });
        }

        if (ghost) {
            ghost.release();
        }
    },

    pacmanKilled: function () {
        this.useGlobalCounter = true;
        this.globalCounter = 0;
    }
};

DotCounter.prototype.energiserEaten = DotCounter.prototype.dotEaten;

function ModeSwitcher(level) {
    this.switchDelays = [
        toTicks(level < 5 ? 7 : 5),
        toTicks(20),
        toTicks(level < 5 ? 7 : 5),
        toTicks(20),
        toTicks(5),
        toTicks(level === 1 ? 20 : level < 5 ? 1033 : 1037),
        (level === 1 ? toTicks(5) : 1)
    ];
}

ModeSwitcher.prototype = {

    start: function () {
        this.enqueueSwitch(0);
    },

    enqueueSwitch: function (n) {
        var delay = this.switchDelays[n++];
        if (!delay) {
            // finished switching
            return;
        }

        debug('next mode switch in %ns', toSeconds(delay));
        this.scatterChaseTimer = lookup('events').delay(delay, bind(this, function () {
            var newState, oldState;
            if (n % 2) {
                oldState = Ghost.STATE_SCATTERING;
                newState = Ghost.STATE_CHASING;
            } else {
                oldState = Ghost.STATE_CHASING;
                newState = Ghost.STATE_SCATTERING;
            }

            debug('mode switch (%n): %s', n, Ghost.STATE_LABELS[newState]);

            ['blinky', 'pinky', 'inky', 'clyde'].map(function (name) {
                return lookup(name);
            }).forEach(function (g) {
                g.unset(oldState);
                g.set(newState);
                g.reverse();
            });
            this.enqueueSwitch(n);
        }));
    },

    energiserEaten: function () {
        // suspend scatter/chase timer for duration of fright
        var frightTicks = Ghost.FRIGHT_TICKS[level];
        if (frightTicks) {
            debug('%s for %ss',
                  Ghost.STATE_LABELS[Ghost.STATE_FRIGHTENED],
                  toSeconds(frightTicks));
            var events = lookup('events');
            events.cancel(this.resumeTimer);
            this.scatterChaseTimer.suspend();
            this.resumeTimer = events.delay(frightTicks, bind(this, function () {
                this.scatterChaseTimer.resume();
            }));
        }
    },

    pacmanKilled: function () {
        // cleanup
        var events = lookup('events');
        events.cancel(this.resumeTimer);
        events.cancel(this.scatterChaseTimer);
    }
};

