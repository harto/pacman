/*
 * In-maze score indicators
 */

/*global TILE_SIZE, Text, format */

function InlineScore(score, colour, cx, cy) {
    this.txt = score;
    this.colour = colour;
    this.x = cx;
    this.y = cy;

    this.size = TILE_SIZE * 0.9;
    this.style = Text.STYLE_NORMAL;
    this.align = 'center';
    this.valign = 'middle';
}

InlineScore.prototype = new Text({

    toString: function () {
        return format('InlineScore [%s]', this.txt);
    }
});
