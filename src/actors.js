/*
 * Pac-Man and ghosts
 */

/*jslint bitwise: false */
/*global COLS, Dot, EAST, Entity, EntityGroup, InlineScore, Maze, Mode, NORTH,
  ROWS, SOUTH, ScreenBuffer, SpriteMap, TILE_CENTRE, TILE_SIZE, UPDATE_HZ,
  WEST, all, broadcast, copy, debug, distance, enqueueInitialiser, enterMode,
  events, format, keys, level, resources, reverse, toCol, toDx, toDy,
  toOrdinal, toRow, toSeconds, toTicks, wait */

function Actor(props) {
    copy(props, this);
}

Actor.prototype = new Entity();

Actor.prototype.moveTo = function (x, y) {
    var min = Maze.TUNNEL_WEST_EXIT_COL * TILE_SIZE;
    var max = Maze.TUNNEL_EAST_EXIT_COL * TILE_SIZE;
    x = x < min ? max : max < x ? min : x;

    Entity.prototype.moveTo.call(this, x, y);

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

Actor.prototype.drawFrame = function (g, frames, col, row) {
    var w = this.w, h = this.h;
    g.drawImage(frames, col * w, row * h, w, h, this.x, this.y, w, h);
};

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
                  1);
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
        y = toOrdinal(direction) * h + radius;
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

    dotEaten: function (d) {
        this.waiting = true;
        var self = this;
        events.delay(d.delay, function () {
            self.waiting = false;
        });
    },

    energiserEaten: function (e) {
        this.dotEaten(e);
    },

    repaint: function (g) {
        Pacman.SPRITES.draw(g, this.x, this.y, this.frameIndex, toOrdinal(this.direction));
    },

    update: function () {
        if (this.dying) {
            // TODO: death sequence
            this.dead = true;
            return;
        } else if (this.waiting) {
            return;
        }

        var newDirection = this.turning || this.direction;
        if (this.move(newDirection)) {
            this.direction = newDirection;
        } else if (this.direction !== newDirection) {
            this.move(this.direction);
        }

        // collision check edibles
        var item = all.get('maze').itemAt(this.col, this.row);
        if (item) {
            broadcast(item.eatenEvent, item);
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

Ghost.ANIM_FREQ = UPDATE_HZ / 4;
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

    w: 12,
    h: 12,

    init: function () {
        this.set(Ghost.STATE_INSIDE);
        this.set(Ghost.STATE_SCATTERING);
        this.centreAt(this.startCx, this.startCy);
        this.resetDotCounter();
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
            spriteRow = toOrdinal(this.direction);
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

    calcSpeed: function () {
        return this.is(Ghost.STATE_DEAD) || this.is(Ghost.STATE_ENTERING) ? 2 :
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
                0.95);
    },

    update: function () {
        var speed = this.calcSpeed();
        var dx, dy;
        this.nTicks++;
        if (this.is(Ghost.STATE_INSIDE)) {
            // FIXME: jostle
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
                    this.resetDotCounter();
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
            var entryPath = this.calcExitPath();
            entryPath.reverse();
            if (toRow(this.startCy) !== Maze.HOME_ROW) {
                // return ghosts to start point within house
                entryPath.push({ x: this.startCx, y: this.startCy });
            }
            this.path = entryPath;
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

    resetDotCounter: function () {
        this.dotCounter = 0;
    },

    kill: function () {
        debug('%s: dying', this);
        this.unset(Ghost.STATE_FRIGHTENED);
        events.cancel(this.flashTimer);
        this.set(Ghost.STATE_DEAD);
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
        var pacman = all.get('pacman');
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
        var pacman = all.get('pacman');
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
        var pacman = all.get('pacman'),
            blinky = all.get('ghosts', 'blinky');
        var cx = pacman.col + toDx(pacman.direction) * 2;
        var cy = pacman.row + toDy(pacman.direction) * 2;
        return { col: cx + cx - blinky.col,
                 row: cy + cy - blinky.row };
    },

    resetDotCounter: function () {
        this.dotCounter = level === 1 ? 30 : 0;
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
        var pacman = all.get('pacman'),
            pCol = pacman.col,
            pRow = pacman.row;
        return distance(pCol, pRow, this.col, this.row) > 8 ?
                   { col: pCol, row: pRow } :
                   this.scatterTile;
    },

    resetDotCounter: function () {
        this.dotCounter = level === 1 ? 60 : level === 2 ? 50 : 0;
    }
});

function GhostGroup() {
    this.useGlobalCounter = false;
    this.dotCounter = 0;
}

GhostGroup.prototype = new EntityGroup({

    reset: function () {
        this.set('blinky', new Blinky(),
                 'inky', new Inky(),
                 'pinky', new Pinky(),
                 'clyde', new Clyde());

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

        // FIXME: all events should be trashed on level-up
        events.cancel(this.releaseTimer);
        var self = this;
        this.releaseTimer = events.repeat(toTicks(level < 5 ? 4 : 3), function () {
            var ghost = self.firstWaiting();
            if (ghost) {
                debug('dot-eaten timeout');
                ghost.release();
            }
        });


        // Initialise recurring mode-switch event

        var modeSwitches = 6;
        events.cancel(this.scatterChaseTimer);
        this.scatterChaseTimer = events.delay(toTicks(level < 5 ? 7 : 5), function () {
            var nSwitches = modeSwitches - this.repeats + 1;
            var newState, oldState;
            if (nSwitches % 2) {
                newState = Ghost.STATE_CHASING;
                oldState = Ghost.STATE_SCATTERING;
            } else {
                newState = Ghost.STATE_SCATTERING;
                oldState = Ghost.STATE_CHASING;
            }
            self.all().forEach(function (g) {
                g.unset(oldState);
                g.set(newState);
            });
            self.reverseAll();
            // XXX: this is ugly - it modifies the event object. It should
            // enqueue a new event.
            this.ticks =
                nSwitches === 1 ? toTicks(20) :
                nSwitches === 2 ? toTicks(level < 5 ? 7 : 5) :
                nSwitches === 3 ? toTicks(20) :
                nSwitches === 4 ? toTicks(5) :
                nSwitches === 5 ? toTicks(level === 1 ? 20 :
                                          level < 5 ? 1033 :
                                          1037) :
                nSwitches === 6 ? (level === 1 ? toTicks(5) : 1) :
                null;
            debug('mode switch (%s): %s %s',
                  nSwitches,
                  Ghost.STATE_LABELS[newState],
                  this.ticks ? format('for %ns', toSeconds(this.ticks)) : 'indefinitely');
        }, modeSwitches);
    },

    // Returns ghosts inside the house in preferred-release-order.
    insiders: function () {
        return ['blinky', 'pinky', 'inky', 'clyde'].map(function (id) {
            return this.get(id);
        }, this).filter(function (g) {
            return g.is(Ghost.STATE_INSIDE);
        });
    },

    firstWaiting: function () {
        var insiders = this.insiders();
        return insiders.length ? insiders[0] : null;
    },

    update: function () {
        this.notify('update');

        // check collisions
        var pacman = all.get('pacman');
        this.all().filter(function (g) {
            return !g.is(Ghost.STATE_DEAD) &&
                   g.col === pacman.col &&
                   g.row === pacman.row;
        }).forEach(function (g) {
            if (g.is(Ghost.STATE_FRIGHTENED)) {
                pacman.setVisible(false);
                g.setVisible(false);
                var score = all.add(new InlineScore(200, g.cx, g.cy));
                wait(toTicks(0.5), function () {
                    all.remove(score);
                    pacman.setVisible(true);
                    g.setVisible(true);
                    g.kill();
                });
            } else {
                broadcast('pacmanKilled');
                this.useGlobalCounter = true;
                enterMode(Mode.DYING);
            }
        });
    },

    dotEaten: function () {
        // reset dot-eaten timer
        this.releaseTimer.reset();

        var pinky = this.get('pinky'),
            inky = this.get('inky'),
            clyde = this.get('clyde');

        // update dot counter(s)
        if (this.useGlobalCounter &&
            ++this.dotCounter === 32 &&
            clyde.is(Ghost.STATE_INSIDE)) {
            this.useGlobalCounter = false;
        } else {
            var firstWaiting = this.firstWaiting();
            if (firstWaiting) {
                --firstWaiting.dotCounter;
            }
        }

        // check counters and maybe release
        var insiders = this.insiders();
        if (!insiders.length) {
            // nobody home
            return;
        }

        var ghost = insiders.first(function (g) {
            return g.dotCounter <= 0;
        }) ||
            // check global counter
            (this.dotCounter === 7 && pinky.is(Ghost.STATE_INSIDE) ? pinky :
             this.dotCounter === 17 && inky.is(Ghost.STATE_INSIDE) ? inky :
             this.dotCounter === 32 && clyde.is(Ghost.STATE_INSIDE) ? clyde :
             null);
        if (ghost) {
            ghost.release();
        }
    },

    // duration of frightened time in seconds, indexed by level
    FRIGHT_SEC:     [null, 6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1],
    // number of times to flash when becoming unfrightened, indexed by level
    FRIGHT_FLASHES: [null, 5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 5, 3, 3, 5, 3, 3, 0, 3],

    reverseAll: function () {
        this.all().filter(function (g) {
            return !g.is(Ghost.STATE_DEAD);
        }).forEach(function (g) {
            g.setNextDirection(reverse(g.direction));
        });
    },

    energiserEaten: function () {
        this.reverseAll();

        var frightSec = this.FRIGHT_SEC[level];
        if (!frightSec) {
            return;
        }

        debug('%s for %ss', Ghost.STATE_LABELS[Ghost.STATE_FRIGHTENED], frightSec);
        this.scatterChaseTimer.suspend();

        var frightTicks = toTicks(frightSec),
            flashes = 2 * this.FRIGHT_FLASHES[level],
            // FIXME: won't work for later levels
            flashDuration = toTicks(0.25),
            flashStart = frightTicks - (flashes + 1) * flashDuration,
            self = this;

        this.all().forEach(function (g) {
            g.set(Ghost.STATE_FRIGHTENED);
            // ensure stationary ghosts are redrawn
            // FIXME: might be unnecessary
            g.invalidate();

            g.flashing = false;
            g.flashTimer = events.repeat(flashStart, function () {
                g.flashing = !g.flashing;
                this.ticks = flashDuration;
            }, flashes);
        });

        events.delay(frightTicks, function () {
            self.scatterChaseTimer.resume();
            self.all().forEach(function (g) {
                g.unset(Ghost.STATE_FRIGHTENED);
            });
        });
    }
});
