/*
 * Drawable text
 */

/*global Entity, copy, format */

function Text(props) {
    copy(props, this);
}

Text.STYLE_NORMAL = '"Helvetica Neue", Helvetica, sans-serif';
Text.STYLE_FIXED_WIDTH = '"Press Start 2P"';

Text.prototype = new Entity({

    repaint: function (g) {
        g.save();

        this.recomputeBoundary(g);

        g.textAlign = this.align || 'left';
        g.textBaseline = this.valign || 'top';
        g.fillStyle = this.colour || 'white';
        g.fillText(this.txt, this._x, this._y);

        g.restore();
    },

    recomputeBoundary: function (g) {
        g.font = format('%spx %s', this.size, this.style);

        this.w = g.measureText(this.txt).width;
        this.h = this.size;

        // We initially allow the `x' and `y' properties to be interpreted
        // according to the `align' and `valign' properties. However, an Entity
        // must describe the top-left of the bounding rectangle with these
        // properties. We therefore keep the original x- and y-coords in
        // anticipation of overwriting them.
        if (this._x === undefined) {
            this._x = this.x;
            this._y = this.y;
        }

        this.x = this.align === 'center' ? this._x - this.w / 2 :
                 this.align === 'right' ? this._x - this.w :
                 this._x;

        this.y = this.valign === 'middle' ? this._y - this.h / 2 :
                 this.valign === 'bottom' ? this._y - this.h :
                 this._y;
    },

    setText: function (txt) {
        this.txt = txt;
        this.invalidate();
    },

    toString: function () {
        return format('Text [%s]', this.txt);
    }
});
