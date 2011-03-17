/*
 * Maze, dots and energisers
 */

/*jslint bitwise: false */
/*global TILE_SIZE, ROWS, COLS, SCREEN_W, SCREEN_H, DEBUG,
         NORTH, SOUTH, EAST, WEST,
         ScreenBuffer, Sprite,
         blinky, inky, pinky, clyde */

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
    // house entry/exit tile
    HOME_COL: 13,
    HOME_ROW: 14,
    HOME_TILE: { col: this.HOME_COL, row: this.HOME_ROW },

    // no NORTH-turn zones
    NNTZ_COL_MIN: 12,
    NNTZ_COL_MAX: 15,
    NNTZ_ROW_1: 14,
    NNTZ_ROW_2: 26,

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

    // FIXME: load remaining images

    img: 'bg.png',

    loaded: function (img) {
        this.bg = new ScreenBuffer(SCREEN_W, SCREEN_H);
        var g = this.bg.getContext('2d');
        g.drawImage(img, 0, 0, SCREEN_W, SCREEN_H);

        // FIXME: should this be toggleable?
        if (DEBUG) {
            // gridlines
            g.strokeStyle = 'white';
            g.lineWidth = 0.25;
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

            g.globalAlpha = 0.5;

            // no-NORTH-turn zones
            g.fillStyle = 'grey';
            var nntzX = this.NNTZ_COL_MIN * TILE_SIZE;
            var nntzW = (this.NNTZ_COL_MAX - this.NNTZ_COL_MIN + 1) * TILE_SIZE;
            g.fillRect(nntzX, this.NNTZ_ROW_1 * TILE_SIZE,
                       nntzW, TILE_SIZE);
            g.fillRect(nntzX, this.NNTZ_ROW_2 * TILE_SIZE,
                       nntzW, TILE_SIZE);

            // ghost home tile
            g.fillStyle = 'green';
            g.fillRect(this.HOME_COL * TILE_SIZE, this.HOME_ROW * TILE_SIZE,
                       TILE_SIZE, TILE_SIZE);
        }
    },

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
        return (this.NNTZ_COL_MIN <= col && col <= this.NNTZ_COL_MAX) &&
               (row === this.NNTZ_ROW_1 || row === this.NNTZ_ROW_2);
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
        return null;
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
