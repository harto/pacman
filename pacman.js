/*
 * An HTML5 Pac-Man clone.
 * https://www.github.com/harto/pacman
 *
 * Requires: jQuery 1.4.2
 */

/*global $, window */

var TILE_SIZE = 8,
    COLS = 28,
    ROWS = 36,

    SCREEN_W = COLS * TILE_SIZE,
    SCREEN_H = ROWS * TILE_SIZE,
    TEXT_HEIGHT = TILE_SIZE,

    MAX_SPEED = 1,

    DEBUG = true,

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

function Sprite() {}

Sprite.prototype = {
    intersects: function (o) {
        return intersecting(this.x, this.y, this.w, this.h, o.x, o.y, o.w, o.h);
    },
    invalidate: function () {
        invalidateRegion(this.x, this.y, this.w, this.h);
    },
    draw: function (g) {},
    update: function () {}
};

/// dots

function Dot(col, row) {
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


function Energiser(col, row) {
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

    initDots: function () {
        var layout = this.layout;
        var dots = [];
        for (var row = 0; row < layout.length; row++) {
            for (var col = 0; col < layout[row].length; col++) {
                var c = layout[row][col];
                if (c === '.') {
                    dots.push(new Dot(col, row));
                } else if (c === 'o') {
                    dots.push(new Energiser(col, row));
                }
            }
        }
        return dots;
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
    }
};

/// actors

var pacman = new Sprite();

pacman.w = pacman.h = 1.5 * TILE_SIZE;
pacman.speed = 0.8 * MAX_SPEED;

pacman.reset = function () {
    this.x = 14 * TILE_SIZE - this.w / 2;
    this.y = 26 * TILE_SIZE - (this.h - TILE_SIZE) / 2;
    this.updateAdjacentTiles();
    this.direction = EAST;
};

pacman.calcCol = function () {
    return Math.floor((this.x + this.w / 2) / TILE_SIZE);
};
pacman.calcRow = function () {
    return Math.floor((this.y + this.h / 2) / TILE_SIZE);
};

pacman.updateAdjacentTiles = function () {
    this.adjacentTiles = maze.adjacentTiles(this.calcCol(), this.calcRow());
};

pacman.draw = function (g) {
    g.save();
    // FIXME
    g.fillStyle = 'yellow';
    g.fillRect(this.x, this.y, this.w, this.h);
    g.restore();
};

pacman.update = function () {
    var dx = 0;
    var dy = 0;
    var exiting;
    var centre = TILE_SIZE / 2;

    if (this.direction === EAST) {
        dx = 1;
        exiting = (this.x + this.w + dx) % TILE_SIZE > centre;
    } // else if (this.direction === WEST) {
    //     dx = -1;
    // } else if (this.direction === SOUTH) {
    //     dy = 1;
    // } else if (this.direction === NORTH) {
    //     dy = -1;
    // }

    if (exiting && !this.adjacentTiles[this.direction]) {
        return;
    }

    this.invalidate();

    if (dx) {
        var prevCol = this.calcCol();
        this.x += dx;
        var col = this.calcCol();
        if (col !== prevCol) {
            this.updateAdjacentTiles();
        }
    } else if (dy) {
        var prevRow = this.calcRow();
        this.y += dy;
        var row = this.calcRow();
        if (row !== prevRow) {
            this.updateAdjacentTiles();
        }
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

var entities = [],
    bg,

    // game states
    State = {
        RUNNING: 1,
        FINISHED: 2
    },

    state,
    paused;

function draw(g) {
    // repaint background over invalidated regions
    invalidated.forEach(function (r) {
        var x = r.x, y = r.y, w = r.w, h = r.h;
        g.drawImage(bg, x, y, w, h, x, y, w, h);
    });
    // repaint affected entities
    entities.filter(function (e) {
        return e.invalidated || invalidated.some(function (r) {
            return e.intersects(r);
        });
    }).forEach(function (e) {
        e.draw(g);
    });
    // clear invalidated regions
    invalidated = [];

    if (paused || state === State.FINISHED) {
        var text = paused ? '<Paused>' : 'Press <N> to restart';
        var padding = TEXT_HEIGHT / 2;
        var w = g.measureText(text).width + 2 * padding;
        var h = TEXT_HEIGHT + 2 * padding;
        var x = (SCREEN_W - w) / 2;
        var y = (SCREEN_H - h) / 1.5;

        g.fillStyle = 'white';
        g.fillRect(x, y, w, h);

        g.fillStyle = 'black';
        g.textAlign = 'left';
        g.verticalAlign = 'top';
        g.fillText(text, x + padding, y + padding);
    }
}

var // movingLeft,
    // movingRight,
    timeOfDeath;

function update() {
//    pacman.move();

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
    timer,
    nextLoopTime,
    ctx;

function loop() {
    // TODO: if another loop has already been scheduled
    // (nextLoopTime > now?), drop this frame

    if (!paused) {
        update();
    }
    draw(ctx);

    if (state !== State.FINISHED) {
        nextLoopTime += UPDATE_DELAY;
        var delay = nextLoopTime - new Date();
        timer = window.setTimeout(loop, Math.max(0, delay));
    }
}

function levelUp() {
    pacman.reset();
    invalidateScreen();
    entities.push.apply(entities, maze.initDots());
}

/// initialisation

function newGame() {
    window.clearTimeout(timer);

    score = 0;
    level = 0;
    lives = 2;
    state = State.RUNNING;
    paused = false;

    entities = [pacman];
    levelUp();

    nextLoopTime = +new Date();
    timer = window.setTimeout(loop, UPDATE_DELAY);
}

function togglePause() {
    paused = !paused;
    if (!paused) {
        invalidateScreen();
    }
}

function createOffscreenBuffer(w, h) {
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
        moveLeft:    37, // left arrow
        moveRight:   39, // right arrow
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

    $(window).keydown(function (e) {
        var k = getKeyCode(e);
        if (!k) {
            return;
        }

        switch (k) {
        case keys.moveLeft:
            //movingLeft = true;
            break;
        case keys.moveRight:
            //movingRight = true;
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

        switch (k) {
        case keys.moveLeft:
            //movingLeft = false;
            break;
        case keys.moveRight:
            //movingRight = false;
            break;
        default:
            // ignore
        }
    });

    // FIXME: include error handling, progress bar
    bg = createOffscreenBuffer(canvas.width, canvas.height);
    var bgImg = new Image();
    bgImg.onload = function () {
        var g = bg.getContext('2d');
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

