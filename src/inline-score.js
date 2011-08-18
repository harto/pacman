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

    stop: function () {
        all.remove(this.id);
    },

    showFor: function (ticks) {
        this.id = all.add(this);
        all.get('events').delay(ticks, bind(this, function () {
            all.remove(this.id);
        }));
    },

    toString: function () {
        return format('InlineScore [%s]', this.txt);
    }
});
