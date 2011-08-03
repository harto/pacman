/*
 * A flashing dot that bestows ghost-eating powers.
 */

/*global Dot, TILE_SIZE, enqueueInitialiser, toTicks */

function Energiser() {}

Energiser.SIZE = TILE_SIZE * 0.75;
Energiser.COLOUR = '#FFB6AD';
Energiser.BLINK_DURATION = toTicks(0.15);

Energiser.prototype = new Dot({

    value: 50,
    delay: 3,
    w: Energiser.SIZE,
    h: Energiser.SIZE,
    eatenEvent: 'energiserEaten',

    start: function () {
        lookup('events').repeat(Energiser.BLINK_DURATION, bind(this, function () {
            this.setVisible(!this.isVisible());
        }));
    }
});

enqueueInitialiser(function () {
    Energiser.prototype.sprite = Dot.createSprite(Energiser.SIZE, Energiser.COLOUR);
});
