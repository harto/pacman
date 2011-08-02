/*
 * In-maze score indicators
 */

/*global TILE_SIZE, Text, all, bind, format */

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
