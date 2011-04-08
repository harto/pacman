/*
 * Maze, dots and energisers
 */

/*jslint bitwise: false */
/*global TILE_SIZE, ROWS, COLS, SCREEN_W, SCREEN_H, DEBUG,
         NORTH, SOUTH, EAST, WEST,
         ScreenBuffer, Sprite, toCol, toRow,
         blinky, inky, pinky, clyde */

/// dots

function Dot(col, row) {
    this.init(col, row, 3);
}

Dot.prototype = new Sprite();
Dot.prototype.init = function (col, row, size) {
    this.col = col;
    this.row = row;
    this.x = col * TILE_SIZE + (TILE_SIZE - size) / 2;
    this.y = row * TILE_SIZE + (TILE_SIZE - size) / 2;
    this.w = this.h = size;
};
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
    this.init(col, row, TILE_SIZE - 2);
    this.blinkFrames = Energiser.BLINK_FRAMES;
    this.visible = true;
}

Energiser.BLINK_FRAMES = 30;

Energiser.prototype = new Dot();
Energiser.prototype.draw = function (g) {
    if (this.visible) {
        Dot.prototype.draw.apply(this, arguments);
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

var Maze = {
    // house entry/exit tile
    HOME_COL: 14,
    HOME_ROW: 14,

    // no NORTH-turn zones
    NNTZ_COL_MIN: 12,
    NNTZ_COL_MAX: 15,
    NNTZ_ROW_1: 14,
    NNTZ_ROW_2: 26,

    TUNNEL_WEST_EXIT_COL: -2,
    TUNNEL_EAST_EXIT_COL: COLS + 1,

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
        this.nDots = 0;
        this.energisers = [];
        for (var row = 0; row < this.layout.length; row++) {
            this.dots[row] = [];
            for (var col = 0; col < this.layout[row].length; col++) {
                var c = this.layout[row][col];
                if (c !== '.' && c !== 'o') {
                    continue;
                }
                var dot;
                if (c === '.') {
                    dot = new Dot(col, row);
                } else if (c === 'o') {
                    dot = new Energiser(col, row);
                    this.energisers.push(dot);
                }
                this.dots[row][col] = dot;
                ++this.nDots;
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

    dotAt: function (col, row) {
        var dots = this.dots[row];
        return dots ? dots[col] : null;
    },

    remove: function (dot) {
        this.dots[dot.row][dot.col] = null;
        if (dot instanceof Energiser) {
            this.energisers.remove(dot);
        }
        --this.nDots;
        if (this.nDots === 174 || this.nDots === 74) {
            // TODO: add fruit
        }
    },

    isEmpty: function () {
        return this.nDots === 0;
    },

    repaint: function (g, invalidated) {
        // Track distinct invalidated dots using a sparse array. This is faster
        // than doing an overlap check on all the dots, particularly near the
        // start of a level. (An average of 9 invalidated regions and ~200 dots
        // equates to nearly 2000 calls to intersecting() per frame. This
        // solution computes the tiles in each invalidated region, which is a
        // maximum of about 50 per frame, then does a constant-time lookup on
        // the 2D array of dots for each tile.)
        // TODO: profile sparse/dense array
        var dots = [];
        var self = this;
        function addInvalidatedDots(c1, r1, c2, r2) {
            for (var r = r1; r <= r2; r++) {
                for (var c = c1; c <= c2; c++) {
                    var d = self.dotAt(c, r);
                    if (d) {
                        dots[r * COLS + c] = d;
                    }
                }
            }
        }

        invalidated.forEach(function (r) {
            // clip regions extending into negative coordinates
            var x = Math.max(0, r.x),
                y = Math.max(0, r.y),
                w = r.w - (x - r.x),
                h = r.h - (y - r.y);
            // clip regions extending into positive coordinates
            w -= Math.max(0, x + w - COLS * TILE_SIZE);
            h -= Math.max(0, y + h - ROWS * TILE_SIZE);
            if (w <= 0 || h <= 0) {
                return;
            }
            g.drawImage(this.bg, x, y, w, h, x, y, w, h);

            var c1 = toCol(x),
                r1 = toRow(y),
                c2 = toCol(x + w),
                r2 = toRow(y + h);
            addInvalidatedDots(c1, r1, c2, r2);
        }, this);

        dots.forEach(function (d) {
            d.draw(g);
        });
    },

    update: function () {
        this.energisers.forEach(function (e) {
            e.update();
        });
    }
};

Maze.HOME_TILE = { col: Maze.HOME_COL, row: Maze.HOME_ROW };

