/*
 * A flashing dot that bestows ghost-eating powers.
 */

/*global Dot, TILE_SIZE, enqueueInitialiser, toTicks */

function Energiser() {
    this.value = 50;
    this.delay = 3;
    this.w = Energiser.SIZE;
    this.h = Energiser.SIZE;
    this.eatenEvent = 'energiserEaten';
}

Energiser.SIZE = TILE_SIZE * 0.75;
Energiser.COLOUR = '#FFB6AD';
Energiser.BLINK_DURATION = toTicks(0.15);

Energiser.prototype = new Dot({

    onRespawn: function () {
        this.setVisible(true);
        this.cancelEvent(this._blinker);
        this._blinker = this.repeatEvent(Energiser.BLINK_DURATION, function () {
            this.setVisible(!this.isVisible());
        });
    }
});

enqueueInitialiser(function () {
    Energiser.prototype.sprite = Dot.createSprite(Energiser.SIZE, Energiser.COLOUR);
});
