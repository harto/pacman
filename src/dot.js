/*
 * An edible maze dot.
 */

/*global Entity, GraphicsBuffer, TILE_SIZE, copy, enqueueInitialiser */

function Dot(props) {
    copy(props, this);
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

Dot.prototype = new Entity({

    value: 10,
    delay: 1,
    w: Dot.SIZE,
    h: Dot.SIZE,
    eatenEvent: 'dotEaten',

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
