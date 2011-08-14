/*
 * The group that manages dots and energisers for performance reasons.
 */

/*global Bonus, COLS, Dot, Energiser, Maze, dispatch, level, toCol, toRow */

function DotGroup() {
    this.nDots = 0;
    this.dots = [];

    var layout = Maze.LAYOUT;
    for (var row = 0; row < layout.length; row++) {
        this.dots[row] = [];
        for (var col = 0; col < layout[row].length; col++) {
            var ch = layout[row][col];
            var dot = ch === '.' ? new Dot() :
                      ch === 'o' ? new Energiser() :
                      null;
            if (dot) {
                this.dots[row][col] = dot;
                dot.place(col, row);
                ++this.nDots;
            }
        }
    }

    this.invalidated = [];
}

DotGroup.prototype = {

    start: function () {
        this.dots.forEach(function (row) {
            row.forEach(function (d) {
                dispatch(d, 'start');
            });
        });
    },

    dotsRemaining: function () {
        return this.nDots;
    },

    isEmpty: function () {
        return this.dotsRemaining() === 0;
    },

    dotAt: function (col, row) {
        var dots = this.dots[row];
        return dots ? dots[col] : null;
    },

    colliding: function (pacman) {
        return this.dotAt(pacman.col, pacman.row);
    },

    remove: function (dot) {
        delete this.dots[dot.row][dot.col];
        --this.nDots;
        // FIXME: pull up
        if (this.nDots === 74 || this.nDots === 174) {
            Bonus.forLevel(level).insert();
        }
    },

    invalidateRegion: function (x, y, w, h) {
        // Track distinct invalidated dots using a sparse array. This is faster
        // than doing an overlap check on all the dots, particularly near the
        // start of a level. (An average of 9 invalidated regions and ~200 dots
        // equates to nearly 2000 calls to intersecting() per frame. This
        // solution:
        //   * finds the tiles touching each invalidated region (a maximum of
        //     about 50 per frame),
        //   * does a constant-time lookup on the 2D array of dots to find
        //     possibly affected dots, then
        //   * does a bounds check only on those dots that might be affected.
        var c1 = toCol(x),
            r1 = toRow(y),
            c2 = toCol(x + w),
            r2 = toRow(y + h);
        for (var r = r1; r <= r2; r++) {
            for (var c = c1; c <= c2; c++) {
                var d = this.dotAt(c, r);
                // This dot is in the vicinity of the affected region, so
                // perform a full bounds check
                if (d && d.isVisible() && d.intersects(x, y, w, h)) {
                    this.invalidated[r * COLS + c] = d;
                }
            }
        }
    },

    draw: function (g) {
        this.invalidated.forEach(function (d) {
            d.repaint(g);
        });
        this.invalidated = [];
    }
};
