/*
 * Maze.
 */

/*jslint bitwise: false */
/*global COLS, DEBUG, EAST, NORTH, ROWS, SCREEN_H, SCREEN_W, SOUTH,
  GraphicsBuffer, TILE_CENTRE, TILE_SIZE, WEST, debug, enqueueInitialiser,
  resources */

function Maze() {
    this.invalidatedRegions = [];
    this.img = Maze.BG;
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

    // always draw first
    z: -Infinity,

    invalidateRegion: function (x, y, w, h) {
        this.invalidatedRegions.push({ x: x, y: y, w: w, h: h });
    },

    draw: function (g) {
        this.invalidatedRegions.forEach(function (r) {
            var x = r.x, y = r.y, w = r.w, h = r.h;
            g.drawImage(this.img, x, y, w, h, x, y, w, h);
        }, this);
        this.invalidatedRegions = [];
    },

    isFlashing: function (g) {
        return this.img === Maze.BG_FLASH;
    },

    setFlashing: function (flashing) {
        this.img = flashing ? Maze.BG_FLASH : Maze.BG;
        this.invalidateRegion(0, 0, SCREEN_W, SCREEN_H);
    }
};

enqueueInitialiser(function () {
    function createBuffer(imgName) {
        var img = resources.getImage(imgName);
        var buf = new GraphicsBuffer(SCREEN_W, SCREEN_H);
        buf.getContext('2d').drawImage(img, 0, 0, SCREEN_W, SCREEN_H);
        return buf;
    }

    Maze.BG = createBuffer('bg', SCREEN_W, SCREEN_H);
    var g = Maze.BG.getContext('2d');

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

    Maze.BG_FLASH = createBuffer('bg-flash');
});
