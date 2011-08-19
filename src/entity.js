/*
 * Default implementation of objects that can be updated and drawn.
 */

/*global SCREEN_H, SCREEN_W, copy, invalidateRegion, noop, toCol, toRow */

function Entity(props) {
    this._invalidated = true;
    this._visible = true;
    copy(props, this);
}

Entity.prototype = {

    setVisible: function (visible) {
        this._visible = visible;
        this.invalidate();
    },

    isVisible: function () {
        return this._visible;
    },

    invalidate: function () {
        this._invalidated = true;
        if (this.x !== undefined && this.y !== undefined && this.w && this.h) {
            // cover antialiasing and sub-pixel artifacts
            var x = this.x - 1, y = this.y - 1, w = this.w + 2, h = this.h + 2;
            // normalise negative overflow
            var nx = Math.max(0, x),
                ny = Math.max(0, y),
                nw = w - (nx - x),
                nh = h - (ny - y);
            // normalise positive overflow
            nw -= Math.max(0, nx + nw - SCREEN_W);
            nh -= Math.max(0, ny + nh - SCREEN_H);
            if (nw > 0 && nh > 0) {
                invalidateRegion(nx, ny, nw, nh);
            }
        }
    },

    invalidateRegion: function (x, y, w, h) {
        if (this._visible && !this._invalidated && this.intersects(x, y, w, h)) {
            // This default implementation invalidates the whole entity when any
            // part of it is invalidated, and recursively invalidates any other
            // affected entities. This can be overridden for finer control (Maze
            // does this).
            this.invalidate();
        }
    },

    intersects: function (x, y, w, h) {
        return !(this.y > y + h || y > this.y + this.h ||
                 this.x > x + w || x > this.x + this.w);
    },

    draw: function (g) {
        if (this._visible && this._invalidated) {
            this.repaint(g);
            this._invalidated = false;
        }
    },

    // implemented by subclasses
    repaint: noop,

    moveTo: function (x, y) {
        if (x !== this.x || y !== this.y) {
            this.invalidate();
            this.x = x;
            this.y = y;
            // centre x, y
            this.cx = x + this.w / 2;
            this.cy = y + this.h / 2;
            // tile location
            this.col = toCol(this.cx);
            this.row = toRow(this.cy);
        }
    },

    centreAt: function (x, y) {
        this.moveTo(x - this.w / 2, y - this.h / 2);
    }
};
