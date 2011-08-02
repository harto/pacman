/*
 * A wrapper for a function that is invoked after a predefined number of ticks.
 */

function Delay(ticks, fn) {
    this.ticks = this.remaining = ticks;
    this.fn = fn;
    this.running = true;
}

Delay.prototype = {

    suspend: function () {
        this.running = false;
    },

    resume: function () {
        this.running = true;
    },

    reset: function (ticks) {
        this.remaining = ticks || this.ticks;
    },

    update: function () {
        if (this.remaining) {
            --this.remaining;
        } else {
            this.fn();
        }
    }
};
