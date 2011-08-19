/*
 * A wrapper for a function that is invoked after a predefined number of ticks.
 */

function Delay(ticks, fn) {
    this.ticks = this.remaining = ticks;
    this.fn = fn;
}

Delay.prototype = {

    reset: function () {
        this.remaining = this.ticks;
    },

    update: function () {
        if (this.remaining) {
            --this.remaining;
        } else {
            this.fn();
        }
    }
};
