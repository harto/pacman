/*
 * An HTML5 Pac-Man clone.
 * https://www.github.com/harto/pacman
 *
 * Based on the game as described by The Pac-Man Dossier
 * (http://home.comcast.net/~jpittman2/pacman/pacmandossier.html)
 *
 * Requires: jQuery 1.4.2
 */

/*global $, window, Image */

var TILE_SIZE = 8,
    COLS = 28,
    ROWS = 36,

    SCREEN_W = COLS * TILE_SIZE,
    SCREEN_H = ROWS * TILE_SIZE,
    TEXT_HEIGHT = TILE_SIZE,

    MAX_SPEED = 1,

    DEBUG = false,

    NORTH = 1,
    SOUTH = 2,
    EAST = 4,
    WEST = 16,

    lives,
    score,
    level;

/// miscellany

function toTileCoord(coord) {
    var x = coord % TILE_SIZE;
    // handle negative x-coord for tunnel
    return x < 0 ? x + TILE_SIZE : x;
}

function toDx(direction) {
    return direction === WEST ? -1 : direction === EAST ? 1 : 0;
}
function toDy(direction) {
    return direction === NORTH ? -1 : direction === SOUTH ? 1 : 0;
}

function intersecting(ax, ay, aw, ah, bx, by, bw, bh) {
    var ax2 = ax + aw, ay2 = ay + ah,
        bx2 = bx + bw, by2 = by + bh;
    return (// x-overlap
            (((bx <= ax && ax <= bx2) || (bx <= ax2 && ax2 <= bx2)) ||
             ((ax <= bx && bx <= ax2) || (ax <= bx2 && bx2 <= ax2))) &&
           (// y-overlap
            (((by <= ay && ay <= by2) || (by <= ay2 && ay2 <= by2))) ||
             ((ay <= by && by <= ay2) || (ay <= by2 && by2 <= ay2))));
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function reverse(direction) {
    return direction === NORTH ? SOUTH :
           direction === SOUTH ? NORTH :
           direction === EAST ? WEST :
           EAST;
}

Array.prototype.remove = function (o) {
    var i = this.indexOf(o);
    if (i !== -1) {
        this.splice(i, 1);
    }
};

/// partial re-rendering

var invalidated = [];

// mark some area of the screen as requiring a redraw
function invalidateRegion(x, y, w, h) {
    invalidated.push({ x: x, y: y, w: w, h: h });
}

// force redraw of entire screen
function invalidateScreen() {
    invalidateRegion(0, 0, SCREEN_W, SCREEN_H);
}

/// base class of most entities

function Sprite() {}

Sprite.prototype = {
    intersects: function (x, y, w, h) {
        return intersecting(this.x, this.y, this.w, this.h, x, y, w, h);
    },
    invalidate: function () {
        invalidateRegion(this.x, this.y, this.w, this.h);
    },
    repaint: function (g, invalidated) {
        var invalid = invalidated.some(function (r) {
            return this.intersects(r.x, r.y, r.w, r.h);
        }, this);
        if (invalid) {
            this.draw(g);
        }
    },
    draw: function (g) {
        // implemented by subclasses
    },
    update: function () {
        // implemented by subclasses
    }
};

/// dots

function Dot(col, row) {
    this.col = col;
    this.row = row;
    this.x = col * TILE_SIZE + (TILE_SIZE - Dot.SIZE) / 2;
    this.y = row * TILE_SIZE + (TILE_SIZE - Dot.SIZE) / 2;
    this.w = this.h = Dot.SIZE;
}

Dot.SIZE = 3;

Dot.prototype = new Sprite();
Dot.prototype.draw = function (g) {
    g.save();
    // FIXME
    g.fillStyle = 'white';
    g.fillRect(this.x, this.y, this.w, this.h);
    g.restore();
};
Dot.prototype.value = 10;
Dot.prototype.delay = 1;

function Energiser(col, row) {
    this.col = col;
    this.row = row;
    this.x = col * TILE_SIZE + (TILE_SIZE - Energiser.SIZE) / 2;
    this.y = row * TILE_SIZE + (TILE_SIZE - Energiser.SIZE) / 2;
    this.w = this.h = Energiser.SIZE;

    this.blinkFrames = Energiser.BLINK_FRAMES;
    this.visible = true;
}

Energiser.SIZE = TILE_SIZE;
Energiser.BLINK_FRAMES = 30;

Energiser.prototype = new Sprite();
Energiser.prototype.draw = function (g) {
    if (this.visible) {
        // FIXME
        g.save();
        g.fillStyle = 'white';
        g.fillRect(this.x, this.y, this.w, this.h);
        g.restore();
    }
};
Energiser.prototype.update = function () {
    if (--this.blinkFrames === 0) {
        this.visible = !this.visible;
        this.invalidate();
        this.blinkFrames = Energiser.BLINK_FRAMES;
    }
};
Energiser.prototype.value = 50;
Energiser.prototype.delay = 3;

/// maze

var maze = {
    // collision map including dots and energisers
    layout: ['############################',
             '############################',
             '############################',
             '############################',
             '#............##............#',
             '#.####.#####.##.#####.####.#',
             '#o####.#####.##.#####.####o#',
             '#.####.#####.##.#####.####.#',
             '#..........................#',
             '#.####.##.########.##.####.#',
             '#.####.##.########.##.####.#',
             '#......##....##....##......#',
             '######.##### ## #####.######',
             '######.##### ## #####.######',
             '######.##          ##.######',
             '######.## ######## ##.######',
             '######.## ######## ##.######',
             '      .   ########   .      ',
             '######.## ######## ##.######',
             '######.## ######## ##.######',
             '######.##          ##.######',
             '######.## ######## ##.######',
             '######.## ######## ##.######',
             '#............##............#',
             '#.####.#####.##.#####.####.#',
             '#.####.#####.##.#####.####.#',
             '#o..##.......  .......##..o#',
             '###.##.##.########.##.##.###',
             '###.##.##.########.##.##.###',
             '#......##....##....##......#',
             '#.##########.##.##########.#',
             '#.##########.##.##########.#',
             '#..........................#',
             '############################',
             '############################',
             '############################'],

    reset: function () {
        this.dots = [];
        this.energisers = [];
        for (var row = 0; row < this.layout.length; row++) {
            for (var col = 0; col < this.layout[row].length; col++) {
                var c = this.layout[row][col];
                if (c === '.') {
                    this.dots.push(new Dot(col, row));
                } else if (c === 'o') {
                    var e = new Energiser(col, row);
                    this.dots.push(e);
                    this.energisers.push(e);
                }
            }
        }
    },

    enterable: function (col, row) {
        return this.layout[row][col] !== '#';
    },

    // Return a number that is the bitwise-OR of directions in which an actor
    // may exit a given tile.
    exitsFrom: function (col, row) {
        if (col < 0 || COLS <= col) {
            // in tunnel
            return EAST | WEST;
        } else {
            return (this.enterable(col, row - 1) ? NORTH : 0) |
                   (this.enterable(col, row + 1) ? SOUTH : 0) |
                   (this.enterable(col - 1, row) ? WEST : 0) |
                   (this.enterable(col + 1, row) ? EAST : 0);
        }
    },

    // check if tile falls within one of two zones in which ghosts are
    // prohibited from turning north
    northDisallowed: function (col, row) {
        return (12 <= col && col <= 15) && (row === 14 || row === 26);
    },

    inTunnel: function (col, row) {
        return row === 17 && (col <= 4 || 23 <= col);
    },

    // return the tunnel reentry column corresponding to a given column (if any)
    reentryCol: function (col) {
        return col === -3 ? COLS + 1 :
               col === COLS + 2 ? -2 :
               null;
    },

    dotAt: function (col, row) {
        for (var i = 0; i < this.dots.length; i++) {
            var dot = this.dots[i];
            if (dot.col === col && dot.row === row) {
                return dot;
            }
        }
    },

    remove: function (dot) {
        dot.invalidate();
        this.dots.remove(dot);
        if (dot instanceof Energiser) {
            this.energisers.remove(dot);
        }

        if (this.dots.length === 174 || this.dots.length === 74) {
            // TODO: add fruit
        }
    },

    isEmpty: function () {
        return this.dots.length === 0;
    },

    repaint: function (g, invalidated) {
        invalidated.forEach(function (r) {
            // handle out-of-bounds indexes
            var x = Math.max(0, r.x), y = r.y,
                w = r.w - (x - r.x), h = r.h;
            if (w > 0) {
                g.drawImage(this.bg, x, y, w, h, x, y, w, h);
            }
        }, this);
        this.dots.forEach(function (d) {
            d.repaint(g, invalidated);
        });
    },

    update: function () {
        this.energisers.forEach(function (e) {
            e.update();
        });
    }
};

/// actors

function Actor() {}

Actor.prototype = new Sprite();

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
pacman.startX = 14 * TILE_SIZE - pacman.w / 2;
pacman.startY = 26 * TILE_SIZE - (pacman.h - TILE_SIZE) / 2;
// FIXME
pacman.colour = 'yellow';

//pacman.speed = 0.8 * MAX_SPEED;

pacman.reset = function () {
    this.x = this.startX;
    this.y = this.startY;
    this.direction = WEST;
};

pacman.update = function () {
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
        if (dot instanceof Energiser) {
            // TODO: energise
        }
        maze.remove(dot);
    }

    // TODO: ghost collision check
};

pacman.move = function (direction) {
    var dx = 0;
    var dy = 0;
    var exiting;
    var cx = this.calcCentreX();
    var cy = this.calcCentreY();
    var centre = TILE_SIZE / 2;

    // Move in the given direction iff before tile centrepoint or
    // an adjacent tile lies beyond.

    if (direction === EAST) {
        dx = 1;
        exiting = toTileCoord(cx + dx) > centre;
    } else if (direction === WEST) {
        dx = -1;
        exiting = toTileCoord(cx + dx) < centre;
    } else if (direction === SOUTH) {
        dy = 1;
        exiting = toTileCoord(cy + dy) > centre;
    } else if (direction === NORTH) {
        dy = -1;
        exiting = toTileCoord(cy + dy) < centre;
    }

    if (exiting && !(direction & maze.exitsFrom(this.calcCol(), this.calcRow()))) {
        return false;
    }

    this.invalidate();

    // cornering
    if (dx) {
        var localY = toTileCoord(cy);
        dy = localY > centre ? -1 : localY < centre ? 1 : 0;
    } else if (dy) {
        var localX = toTileCoord(cx);
        dx = localX > centre ? -1 : localX < centre ? 1 : 0;
    }

    this.x += dx;
    this.y += dy;
    return true;
};

/// ghosts

function Ghost(name, startX, startY, scatterCol, scatterRow) {
    this.name = name;

    this.w = this.h = Ghost.SIZE;
    this.startX = startX;
    this.startY = startY;

    this.scatterCol = scatterCol;
    this.scatterRow = scatterRow;
}

Ghost.SIZE = TILE_SIZE * 1.5;

Ghost.CHASE = 1;
Ghost.SCATTER = 2;
Ghost.FRIGHTENED = 3;
//Ghost.MODE =

Ghost.prototype = new Actor();

Ghost.prototype.toString = function () {
    return this.name;
};

Ghost.prototype.reset = function () {
    this.x = this.startX;
    this.y = this.startY;
    // FIXME
    this.direction = WEST;
    this.nextDirection = this.calcNextDirection();
};

Ghost.prototype.update = function () {
    this.invalidate();
    this.x += toDx(this.direction);
    this.y += toDy(this.direction);

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

    var centre = TILE_SIZE / 2;
    if (this.calcTileX() !== centre || this.calcTileY() !== centre) {
        return;
    }

    this.direction = this.nextDirection;
    this.nextDirection = this.calcNextDirection();
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

    var target = this.calcTarget();

    function distanceFrom(col, row) {
        return distance(col, row, target.col, target.row);
    }

    var directions = [];

    // Add candidates in tie-break order
    if (exits & NORTH) {
        directions.push({ direction: NORTH,
                          dist: distanceFrom(nextCol, nextRow - 1) });
    }
    if (exits & WEST) {
        directions.push({ direction: WEST,
                          dist: distanceFrom(nextCol - 1, nextRow) });
    }
    if (exits & SOUTH) {
        directions.push({ direction: SOUTH,
                          dist: distanceFrom(nextCol, nextRow + 1) });
    }
    if (exits & EAST) {
        directions.push({ direction: EAST,
                          dist: distanceFrom(nextCol + 1, nextRow) });
    }

    directions.sort(function (a, b) {
        return a.dist - b.dist;
    });

    return directions[0].direction;
};

/// blinky

var blinky = new Ghost('Blinky',
                       14 * TILE_SIZE - Ghost.SIZE / 2,
                       15 * TILE_SIZE - (Ghost.SIZE + TILE_SIZE) / 2,
                       25, 0);
// FIXME
blinky.colour = 'red';

blinky.calcTarget = function () {
    return { col: pacman.calcCol(), row: pacman.calcRow() };
};

// /// pinky

// var pinky = new Ghost();

// /// inky

// var inky = new Ghost();

// /// clyde

// var clyde = new Ghost();

/// scoreboard

// var scoreboard = new Rectangle(0, SCREEN_H - Wall.VSPACE, SCREEN_W, Wall.VSPACE);

// scoreboard.draw = function (g) {
//     g.save();
//     g.fillStyle = 'white';
//     g.textAlign = 'left';
//     g.textBaseline = 'top';

//     var scoreLine = 'Score: ' + score;
//     var livesLine = 'Lives: ' + lives;

//     g.fillText(scoreLine, this.x + 5, this.y + 9);
//     g.fillText(livesLine, this.x + 5, this.y + 23);

//     this.w = 10 + Math.max(g.measureText(scoreLine).width,
//                            g.measureText(livesLine).width);
// };

// Paddle.prototype.move = function (direction) {
//     this.invalidate();
//     var x = this.x + direction * Paddle.SPEED;
//     this.x = Math.min(Math.max(x, Wall.W), SCREEN_W - Wall.W - this.w);
// };

/// engine

var entities = [maze, pacman, blinky/*, pinky, inky, clyde*/],
    ctx,

    // game states
    State = {
        RUNNING: 1,
        FINISHED: 2
    },

    state,
    paused;

function draw() {
    entities.forEach(function (e) {
        e.repaint(ctx, invalidated);
    });
    invalidated = [];

    if (paused || state === State.FINISHED) {
        var text = paused ? '<Paused>' : 'Press <N> to restart';
        var padding = TEXT_HEIGHT / 2;
        var w = ctx.measureText(text).width + 2 * padding;
        var h = TEXT_HEIGHT + 2 * padding;
        var x = (SCREEN_W - w) / 2;
        var y = (SCREEN_H - h) / 1.5;

        ctx.fillStyle = 'white';
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';
        ctx.verticalAlign = 'top';
        ctx.fillText(text, x + padding, y + padding);
    }
}

function update() {
    if (state === State.RUNNING) {
        entities.forEach(function (a) {
            a.update();
        });
        if (maze.isEmpty()) {
            // FIXME: delay this
            levelUp();
        }
    // } else if (state === State.REINSERT) {
    //     if (new Date() - timeOfDeath >= Ball.REINSERT_DELAY) {
    //         ball.reset();
    //         state = State.RUNNING;
    //     }
    }
}

var UPDATE_HZ = 60,
    UPDATE_DELAY = 1000 / UPDATE_HZ,
    timer;

function loop() {
    if (!paused) {
        update();
    }
    draw();

    if (state !== State.FINISHED) {
        timer = window.setTimeout(loop, UPDATE_DELAY);
    }
}

function levelUp() {
    ++level;
    entities.forEach(function (e) {
        e.reset();
    });
    invalidateScreen();
}

/// initialisation

function newGame() {
    window.clearTimeout(timer);

    score = 0;
    level = 0;
    lives = 2;
    state = State.RUNNING;
    paused = false;

    levelUp();

    timer = window.setTimeout(loop, UPDATE_DELAY);
}

function togglePause() {
    paused = !paused;
    if (!paused) {
        invalidateScreen();
    }
}

function ScreenBuffer(w, h) {
    var canvas = $('<canvas></canvas>').attr({ width: w, height: h }).hide();
    $('body').append(canvas);
    return canvas.get(0);
}

$(function () {
    var canvas = $('canvas').get(0);

    ctx = canvas.getContext('2d');

    ctx.scale(canvas.width / SCREEN_W, canvas.height / SCREEN_H);
    ctx.font = 'bold ' + TEXT_HEIGHT + 'px Helvetica, Arial, sans-serif';

    function charCode(c) {
        return c.charCodeAt(0);
    }

    var keys = {
        left:        37, // left arrow
        right:       39, // right arrow
        up:          38, // up arrow
        down:        40, // down arrow

        togglePause: charCode('P'),
        newGame:     charCode('N'),
        kill:        charCode('K')
    };

    // reverse-lookup
    var keycodes = {};
    for (var k in keys) {
        if (keys.hasOwnProperty(k)) {
            keycodes[keys[k]] = k;
        }
    }

    function getKeyCode(e) {
        var k = e.which;
        if (!keycodes[k] || e.ctrlKey || e.metaKey) {
            return null;
        }
        e.preventDefault();
        return k;
    }

    var directions = {};
    directions[keys.up] = NORTH;
    directions[keys.down] = SOUTH;
    directions[keys.right] = EAST;
    directions[keys.left] = WEST;

    $(window).keydown(function (e) {
        var k = getKeyCode(e);
        if (!k) {
            return;
        }

        switch (k) {
        case keys.left:
        case keys.right:
        case keys.up:
        case keys.down:
            pacman.turning = directions[k];
            break;
        case keys.togglePause:
            togglePause();
            break;
        case keys.newGame:
            newGame();
            break;
        case keys.kill:
            window.clearTimeout(timer);
            break;
        default:
            throw new Error('unhandled: ' + keycodes[k]);
        }
    });

    $(window).keyup(function (e) {
        var k = getKeyCode(e);
        if (pacman.turning === directions[k]) {
            pacman.turning = null;
        }
    });

    // FIXME: include error handling, progress bar
    maze.bg = new ScreenBuffer(canvas.width, canvas.height);
    var bgImg = new Image();
    bgImg.onload = function () {
        var g = maze.bg.getContext('2d');
        g.drawImage(bgImg, 0, 0, SCREEN_W, SCREEN_H);
        if (DEBUG) {
            g.strokeStyle = 'white';
            g.lineWidth = 0.5;
            for (var row = 0; row < ROWS; row++) {
                g.beginPath();
                g.moveTo(0, row * TILE_SIZE);
                g.lineTo(SCREEN_W, row * TILE_SIZE);
                g.stroke();
            }
            for (var col = 0; col < COLS; col++) {
                g.beginPath();
                g.moveTo(col * TILE_SIZE, 0);
                g.lineTo(col * TILE_SIZE, SCREEN_H);
                g.stroke();
            }
        }

        newGame();
    };
    bgImg.src = 'bg.png';
});

