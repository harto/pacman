/*
 * An HTML5 Pac-Man clone.
 * https://www.github.com/harto/pacman
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

    DEBUG = false,//true,

    NORTH = 1,
    SOUTH = 2,
    EAST = 3,
    WEST = 4,

    lives,
    score,
    level;

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

/// miscellany

function toLocal(coord) {
    return coord % TILE_SIZE;
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

Array.prototype.remove = function (o) {
    var i = this.indexOf(o);
    if (i !== -1) {
        this.splice(i, 1);
    }
};

function Sprite() {}

Sprite.prototype = {
    intersects: function (x, y, w, h) {
        return intersecting(this.x, this.y, this.w, this.h, x, y, w, h);
    },
    invalidate: function () {
        invalidateRegion(this.x, this.y, this.w, this.h);
    },
    repaint: function (g, invalidated) {
        var s = this;
        var invalid = invalidated.some(function (r) {
            return s.intersects(r.x, r.y, r.w, r.h);
        });
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

    adjacentTiles: function (col, row) {
        var adjacent = {};
        adjacent[NORTH] = this.canEnter(col, row - 1);
        adjacent[SOUTH] = this.canEnter(col, row + 1);
        adjacent[WEST] = this.canEnter(col - 1, row);
        adjacent[EAST] = this.canEnter(col + 1, row);
        return adjacent;
    },

    canEnter: function (col, row) {
        return this.layout[row][col] !== '#';
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
    },

    repaint: function (g, invalidated) {
        var bg = this.bg;
        invalidated.forEach(function (r) {
            var x = r.x, y = r.y, w = r.w, h = r.h;
            g.drawImage(bg, x, y, w, h, x, y, w, h);
        });
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

var pacman = new Sprite();

pacman.w = pacman.h = 1.5 * TILE_SIZE;
pacman.speed = 0.8 * MAX_SPEED;

pacman.reset = function () {
    this.x = 14 * TILE_SIZE - this.w / 2;
    this.y = 26 * TILE_SIZE - (this.h - TILE_SIZE) / 2;
    this.updateCentrepoint();
    this.updateTileLocation();
    this.direction = EAST;
};

pacman.updateCentrepoint = function () {
    this.cx = this.x + this.w / 2;
    this.cy = this.y + this.h / 2;
};

pacman.updateTileLocation = function () {
    this.col = Math.floor((this.x + this.w / 2) / TILE_SIZE);
    this.row = Math.floor((this.y + this.h / 2) / TILE_SIZE);
    this.adjacentTiles = maze.adjacentTiles(this.col, this.row);
};

pacman.draw = function (g) {
    g.save();
    // FIXME
    g.fillStyle = 'yellow';
    g.fillRect(this.x, this.y, this.w, this.h);
    g.restore();
};

pacman.enteringTile = function () {
    return (this.direction === EAST && toLocal(this.cx) === 0) ||
           (this.direction === WEST && toLocal(this.cx) === TILE_SIZE - 1) ||
           (this.direction === SOUTH && toLocal(this.cy) === 0) ||
           (this.direction === NORTH && toLocal(this.cy) === TILE_SIZE - 1);
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

    if (this.enteringTile()) {
        this.updateTileLocation();
        var dot = maze.dotAt(this.col, this.row);
        if (dot) {
            score += dot.value;
            maze.remove(dot);
            this.wait = dot.delay;
            if (dot instanceof Energiser) {
                // TODO: energise
            }
        }
    }
};

pacman.move = function (direction) {
    var dx = 0;
    var dy = 0;
    var exiting;
    var centre = TILE_SIZE / 2;

    // Move in the given direction iff before tile centrepoint or
    // an adjacent tile lies beyond.

    if (direction === EAST) {
        dx = 1;
        exiting = toLocal(this.cx + dx) > centre;
    } else if (direction === WEST) {
        dx = -1;
        exiting = toLocal(this.cx + dx) < centre;
    } else if (direction === SOUTH) {
        dy = 1;
        exiting = toLocal(this.cy + dy) > centre;
    } else if (direction === NORTH) {
        dy = -1;
        exiting = toLocal(this.cy + dy) < centre;
    }

    if (!exiting || this.adjacentTiles[direction]) {
        this.invalidate();

        // pre/post-turning
        if (dx) {
            var localY = toLocal(this.cy);
            dy = localY > centre ? -1 : localY < centre ? 1 : 0;
        } else if (dy) {
            var localX = toLocal(this.cx);
            dx = localX > centre ? -1 : localX < centre ? 1 : 0;
        }

        this.x += dx;
        this.y += dy;
        this.updateCentrepoint();
        return true;
    }
};

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

var entities = [maze, pacman],
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

