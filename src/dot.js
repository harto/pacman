/*
 * An edible maze dot.
 */

/*global GraphicsBuffer, Sprite, TILE_SIZE, copy, enqueueInitialiser */

function Dot(props) {
    copy(props, this);
    this.value = 10;
    this.delay = 1;
    this.w = Dot.SIZE;
    this.h = Dot.SIZE;
}

Dot.SIZE = TILE_SIZE * 0.25;
Dot.COLOUR = '#FCC';

Dot.createSprite = function (size, colour) {
    var sprite = new GraphicsBuffer(size, size);
    var g = sprite.getContext('2d');
    g.beginPath();
    var r = size / 2;
    g.arc(r, r, r, 0, Math.PI * 2, true);
    g.fillStyle = colour;
    g.fill();

    return sprite;
};

Dot.prototype = new Sprite({

    place: function (col, row) {
        this.centreAt(col * TILE_SIZE + TILE_SIZE / 2,
                      row * TILE_SIZE + TILE_SIZE / 2);
    },

    repaint: function (g) {
        g.save();
        g.drawImage(this.sprite, this.x, this.y);
        g.restore();
    }
});

enqueueInitialiser(function () {
    Dot.prototype.sprite = Dot.createSprite(Dot.SIZE, Dot.COLOUR);
});
