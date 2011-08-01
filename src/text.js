/*
 * Text bits and pieces
 */

/*global Entity, Group, SCREEN_H, SCREEN_W, TILE_SIZE, all, bind, copy, format,
  highscore, merge, score, toTicks */

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

function Header() {
    var props = {
        style: Text.STYLE_FIXED_WIDTH,
        size: TILE_SIZE
    };
    this.set('1up', new Text(merge(props, {
        txt: '1UP',
        x: 4 * TILE_SIZE,
        y: 0
    })));
    this.add(new Text(merge(props, {
        txt: 'HIGH SCORE',
        x: 9 * TILE_SIZE,
        y: 0
    })));
    this.set('score', new Text(merge(props, {
        txt: score,
        align: 'right',
        x: 7 * TILE_SIZE,
        y: TILE_SIZE
    })));
    this.set('highscore', new Text(merge(props, {
        txt: highscore,
        align: 'right',
        x: 17 * TILE_SIZE,
        y: TILE_SIZE
    })));
}

Header.prototype = new Group({

    start: function () {
        var oneup = this.get('1up');
        all.get('events').repeat(toTicks(0.25), function () {
            oneup.setVisible(!oneup.isVisible());
        });
    },

    scoreChanged: function () {
        this.get('score').setText(score);
        this.get('highscore').setText(highscore);
    }
});

/// overlay for pause, new game

function InfoText(txt) {
    this.txt = new Text({
        txt: txt,
        style: Text.STYLE_NORMAL,
        size: TILE_SIZE,
        colour: 'black',
        align: 'center',
        valign: 'middle',
        x: SCREEN_W / 2,
        y: SCREEN_H / 2
    });

    this.pad = TILE_SIZE / 2;
    this.z = 3;

    this.w = this.h = 0;
}

InfoText.prototype = new Entity({

    repaint: function (g) {
        g.save();

        if (!this.w) {
            this.txt.recomputeBoundary(g);
            this.w = this.txt.w + 2 * this.pad;
            this.h = this.txt.h + 2 * this.pad;
            this.x = this.txt.x - this.pad;
            this.y = this.txt.y - this.pad;
        }

        g.fillStyle = 'white';
        g.fillRect(this.x, this.y, this.w, this.h);
        this.txt.repaint(g);

        g.restore();
    }
});

/// in-maze score indicators

function InlineScore(score, colour, cx, cy) {
    this.txt = score;
    this.colour = colour;
    this.x = cx;
    this.y = cy;
}

InlineScore.prototype = new Text({

    size: TILE_SIZE * 0.9,
    style: Text.STYLE_NORMAL,
    align: 'center',
    valign: 'middle',

    insert: function () {
        this.id = all.add(this);
        this.invalidate();
    },

    remove: function () {
        all.remove(this.id);
        this.invalidate();
    },

    showFor: function (ticks) {
        this.insert();
        all.get('events').delay(ticks, bind(this, function () {
            this.remove();
        }));
    },

    toString: function () {
        return format('InlineScore [%s]', this.txt);
    }
});
