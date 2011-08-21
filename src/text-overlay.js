/*
 * Text overlay for pause etc.
 */

/*global SCREEN_H, SCREEN_W, Sprite, TILE_SIZE, Text */

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

InfoText.prototype = new Sprite({

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
