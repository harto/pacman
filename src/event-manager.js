/*
 * A way to manage one-off and repeating events.
 */

/*global Delay, values */

function EventManager() {
    this.delays = {};
    this.nextDelayId = 0;
}

EventManager.prototype = {

    delay: function (ticks, fn, repeats) {
        var manager = this;
        var delay = new Delay(ticks, function () {
            fn.call(this);
            if (this.repeats === undefined || --this.repeats === 0) {
                manager.cancel(this);
            } else {
                this.reset();
            }
        });
        var id = this.nextDelayId++;
        delay.id = id;
        delay.repeats = repeats;
        this.delays[id] = delay;
        return delay;
    },

    repeat: function (ticks, fn, repeats) {
        return this.delay(ticks, fn, repeats || Infinity);
    },

    cancel: function (delay) {
        if (delay) {
            delete this.delays[delay.id];
        }
    },

    update: function () {
        values(this.delays).filter(function (d) {
            return d.running;
        }).forEach(function (d) {
            d.update();
        });
    }
};
