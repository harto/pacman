/*
 * Text bits and pieces
 */

/*global Entity, Group, SCREEN_H, SCREEN_W, TILE_SIZE, all, bind, copy, format,
  highscore, score, toTicks */

function Text(props) {
    copy(props, this);
}

Text.prototype = new Entity({

    init: function () {
        // track original x, y - we'll need these to recalculate
        // graphical boundary if the text isn't left-aligned
        this._x = this.x;
        this._y = this.y;
        // updated when text is first drawn
        this.w = 0;
    },

    repaint: function (g) {
        g.save();

        this.recomputeLayout(g);

        g.textAlign = this.align || 'left';
        g.textBaseline = this.valign || 'top';
        g.fillStyle = this.colour || 'white';
        g.fillText(this.txt, this._x, this._y);

        g.restore();
    },

    recomputeLayout: function (g) {
        g.font = format('%spx %s', this.size, this.style);
        this.w = g.measureText(this.txt).width;
        this.h = this.size;

        switch (this.align) {
        case 'center':
            this.x = this._x - this.w / 2;
            break;
        case 'right':
            this.x = this._x - this.w;
            break;
        default:
            this.x = this._x;
        }

        switch (this.valign) {
        case 'middle':
            this.y = this._y - this.h / 2;
            break;
        case 'bottom':
            this.y = this._y - this.h;
            break;
        default:
            this.y = this._y;
        }
    },

    setText: function (txt) {
        this.txt = txt;
        this.invalidate();
    }
});

function StandardText(props) {
    copy(props, this);
    this.init();
}

StandardText.prototype = new Text({

    style: '"Press Start 2P"',
    size: TILE_SIZE,

    toString: function () {
        return format('StandardText [%s]', this.txt);
    }
});

function Header() {
    this.set('1up', new StandardText({
        txt: '1UP',
        x: 4 * TILE_SIZE,
        y: 0
    }));
    this.add(new StandardText({
        txt: 'HIGH SCORE',
        x: 9 * TILE_SIZE,
        y: 0
    }));
    this.set('score', new StandardText({
        txt: score,
        align: 'right',
        x: 7 * TILE_SIZE,
        y: TILE_SIZE
    }));
    this.set('highscore', new StandardText({
        txt: highscore,
        align: 'right',
        x: 17 * TILE_SIZE,
        y: TILE_SIZE
    }));
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
    this.txt = new StandardText({
        txt: txt,
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
            this.txt.recomputeLayout(g);
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
    this.init();
}

InlineScore.prototype = new Text({

    size: TILE_SIZE * 0.9,
    style: '"Helvetica Neue", Helvetica, sans-serif',
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
