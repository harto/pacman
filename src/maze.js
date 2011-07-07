/*
 * Maze, dots and energisers
 */

/*jslint bitwise: false */
/*global COLS, DEBUG, EAST, Entity, EntityGroup, Mode, NORTH, ROWS, SCREEN_H,
  SCREEN_W, SOUTH, ScreenBuffer, TILE_CENTRE, TILE_SIZE, WEST, all, bind,
  debug, enqueueInitialiser, enterMode, level, lookup, resources, toCol, toRow,
  toTicks */

/// edibles

function Dot() {}

Dot.prototype = new Entity({

    value: 10,
    delay: 1,
    w: 3,
    h: 3,
    eatenEvent: 'dotEaten',

    place: function (col, row) {
        this.col = col;
        this.row = row;
        this.centreAt(col * TILE_SIZE + TILE_SIZE / 2,
                      row * TILE_SIZE + TILE_SIZE / 2);
    },

    repaint: function (g) {
        g.save();
        // FIXME
        g.fillStyle = 'white';
        g.fillRect(this.x, this.y, this.w, this.h);
        g.restore();
    }
});

function Energiser() {
    //this.setVisible(true);
    lookup('events').repeat(Energiser.BLINK_DURATION, bind(this, function () {
        this.setVisible(!this.visible);
    }));
}

Energiser.BLINK_DURATION = toTicks(0.25);

Energiser.prototype = new Dot();
Energiser.prototype.value = 50;
Energiser.prototype.delay = 3;
Energiser.prototype.w = Energiser.prototype.h = TILE_SIZE - 2;
Energiser.prototype.eatenEvent = 'energiserEaten';

function Bonus(symbol, value) {
    // FIXME: do something with symbol
    this.symbol = symbol;
    this.w = this.h = TILE_SIZE;
    this.value = value;
}
Bonus.prototype = new Entity({
    eatenEvent: 'bonusEaten',
    repaint: function (g) {
        // FIXME
        g.save();
        g.fillStyle = 'white';
        g.fillRect(this.x, this.y, this.w, this.h);
        g.restore();
    }
});

Bonus.forLevel = function (level) {
    return level === 1 ? new Bonus('cherry', 100) :
           level === 2 ? new Bonus('strawberry', 300) :
           level <= 4 ? new Bonus('peach', 500) :
           level <= 6 ? new Bonus('apple', 700) :
           level <= 8 ? new Bonus('grape', 700) :
           level <= 10 ? new Bonus('galaxian', 2000) :
           level <= 12 ? new Bonus('bell', 3000) :
           new Bonus('key', 5000);
};

function BonusDisplay(level) {
    // display bonus for current and previous 5 levels, drawing right-to-left
    var cx = SCREEN_W - 3 * TILE_SIZE;
    var cy = SCREEN_H - TILE_SIZE;
    var minLevel = Math.max(1, level - BonusDisplay.MAX_DISPLAY + 1);
    for (var L = level; L >= minLevel; L--) {
        var b = Bonus.forLevel(L);
        b.centreAt(cx - (level - L) * 2 * TILE_SIZE, cy);
        this.add(b);
    }
}

BonusDisplay.MAX_DISPLAY = 6;
BonusDisplay.prototype = new EntityGroup();

/// maze

function Maze() {
    this.dots = [];
    this.nDots = 0;
    this.energisers = [];
    var layout = Maze.LAYOUT;
    for (var row = 0; row < layout.length; row++) {
        this.dots[row] = [];
        for (var col = 0; col < layout[row].length; col++) {
            var c = layout[row][col];
            if (c !== '.' && c !== 'o') {
                continue;
            }
            var dot;
            if (c === '.') {
                dot = new Dot();
            } else if (c === 'o') {
                dot = new Energiser();
                this.energisers.push(dot);
            }
            this.dots[row][col] = dot;
            dot.place(col, row);
            ++this.nDots;
        }
    }
}

// house entry/exit tile
Maze.HOME_COL = 14;
Maze.HOME_ROW = 14;
Maze.HOME_TILE = { col: Maze.HOME_COL, row: Maze.HOME_ROW };

// no-north-turn zones
Maze.NNTZ_COL_MIN = 12;
Maze.NNTZ_COL_MAX = 15;
Maze.NNTZ_ROW_1 = 14;
Maze.NNTZ_ROW_2 = 26;

Maze.TUNNEL_WEST_EXIT_COL = -2;
Maze.TUNNEL_EAST_EXIT_COL = COLS + 1;

Maze.PACMAN_X = Maze.BONUS_X = Maze.HOME_COL * TILE_SIZE;
Maze.PACMAN_Y = Maze.BONUS_Y = 26 * TILE_SIZE + TILE_CENTRE;

// collision map including dots and energisers
Maze.LAYOUT = ['############################',
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
               '############################'];

Maze.enterable = function (col, row) {
    return Maze.LAYOUT[row][col] !== '#';
};

Maze.inTunnel = function (col, row) {
    return row === 17 && (col <= 4 || 23 <= col);
};

// Return a number that is the bitwise-OR of directions in which an actor
// may exit a given tile.
Maze.exitsFrom = function (col, row) {
    if (this.inTunnel(col, row)) {
        return EAST | WEST;
    } else {
        return (this.enterable(col, row - 1) ? NORTH : 0) |
               (this.enterable(col, row + 1) ? SOUTH : 0) |
               (this.enterable(col - 1, row) ? WEST : 0) |
               (this.enterable(col + 1, row) ? EAST : 0);
    }
};

// check if tile falls within one of two zones in which ghosts are
// prohibited from turning north
Maze.northDisallowed = function (col, row) {
    return (Maze.NNTZ_COL_MIN <= col && col <= Maze.NNTZ_COL_MAX) &&
           (row === Maze.NNTZ_ROW_1 || row === Maze.NNTZ_ROW_2);
};

Maze.prototype = {

    itemAt: function (col, row) {
        var b = this.bonus;
        return (b && row === toRow(b.y) && col === toCol(b.x)) ? b :
            this.dotAt(col, row);
    },

    dotAt: function (col, row) {
        var dots = this.dots[row];
        return dots ? dots[col] : null;
    },

    energiserEaten: function (e) {
        this.energisers.remove(e);
        this.dotEaten(e);
    },

    dotEaten: function (d) {
        this.dots[d.row][d.col] = null;
        --this.nDots;
        if (this.nDots === 74 || this.nDots === 174) {
            this.bonus = Bonus.forLevel(level);
            this.bonus.centreAt(Maze.BONUS_X, Maze.BONUS_Y);
            var secs = 9 + Math.random();
            debug('displaying bonus for %.3ns', secs);
            this.bonusTimeout = lookup('events').delay(toTicks(secs), bind(this, function () {
                debug('bonus timeout');
                this.removeBonus();
            }));
        } else if (this.nDots === 0) {
            enterMode(Mode.LEVELUP);
        }
    },

    removeBonus: function () {
        this.bonus.invalidate();
        delete this.bonus;
    },

    bonusEaten: function () {
        debug('bonus eaten');
        lookup('events').cancel(this.bonusTimeout);
        this.removeBonus();
    },

    invalidatedRegions: [],
    invalidatedDots: [],

    invalidateRegion: function (x, y, w, h) {
        this.invalidatedRegions.push({ x: x, y: y, w: w, h: h });
        // Track distinct invalidated dots using a sparse array. This is faster
        // than doing an overlap check on all the dots, particularly near the
        // start of a level. (An average of 9 invalidated regions and ~200 dots
        // equates to nearly 2000 calls to intersecting() per frame. This
        // solution computes the tiles in each invalidated region, which is a
        // maximum of about 50 per frame, then does a constant-time lookup on
        // the 2D array of dots for each tile.)
        // TODO: profile sparse/dense array
        var c1 = toCol(x),
            r1 = toRow(y),
            c2 = toCol(x + w),
            r2 = toRow(y + h);
        for (var r = r1; r <= r2; r++) {
            for (var c = c1; c <= c2; c++) {
                var d = this.dotAt(c, r);
                if (d && d.visible) {
                    this.invalidatedDots[r * COLS + c] = d;
                }
            }
        }

        if (this.bonus) {
            this.bonus.invalidateRegion(x, y, w, h);
        }
    },

    draw: function (g) {
        this.invalidatedRegions.forEach(function (r) {
            var x = r.x, y = r.y, w = r.w, h = r.h;
            g.drawImage(Maze.bg, x, y, w, h, x, y, w, h);
        }, this);
        this.invalidatedRegions = [];

        this.invalidatedDots.forEach(function (d) {
            d.repaint(g);
        });
        this.invalidatedDots = [];

        if (this.bonus) {
            this.bonus.draw(g);
        }
    }
};

enqueueInitialiser(function () {
    var img = resources.getImage('bg');
    Maze.bg = new ScreenBuffer(SCREEN_W, SCREEN_H);
    var g = Maze.bg.getContext('2d');
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
        var nntzX = Maze.NNTZ_COL_MIN * TILE_SIZE;
        var nntzW = (Maze.NNTZ_COL_MAX - Maze.NNTZ_COL_MIN + 1) * TILE_SIZE;
        g.fillRect(nntzX, Maze.NNTZ_ROW_1 * TILE_SIZE,
                   nntzW, TILE_SIZE);
        g.fillRect(nntzX, Maze.NNTZ_ROW_2 * TILE_SIZE,
                   nntzW, TILE_SIZE);

        // ghost home tile
        g.fillStyle = 'green';
        g.fillRect(Maze.HOME_COL * TILE_SIZE, Maze.HOME_ROW * TILE_SIZE,
                   TILE_SIZE, TILE_SIZE);
    }
});
