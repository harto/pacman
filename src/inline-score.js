/*
 * In-maze score indicators
 */

/*global TILE_SIZE, Text, objects, bind, format */

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
        objects.remove(this.id);
    },

    showFor: function (ticks) {
        this.id = objects.add(this);
        objects.get('events').delay(ticks, bind(this, function () {
            objects.remove(this.id);
        }));
    },

    toString: function () {
        return format('InlineScore [%s]', this.txt);
    }
});
