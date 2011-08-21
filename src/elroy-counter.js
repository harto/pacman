/*
 * Counter that triggers 'Cruise Elroy' mode
 */

/*global Ghost, debug, level, lookup */

function ElroyCounter(level, dots) {
    var threshold = this.threshold(level);
    if (dots <= threshold) {
        this.trigger(2);
    } else if (dots <= threshold * 2) {
        this.trigger(1);
    }
}

ElroyCounter.prototype = {

    threshold: function (level) {
        return level === 1 ? 10 :
               level === 2 ? 15 :
               3 <= level && level <= 5 ? 20 :
               6 <= level && level <= 8 ? 25 :
               9 <= level && level <= 11 ? 30 :
               12 <= level && level <= 14 ? 40 :
               15 <= level && level <= 18 ? 50 :
               60;
    },

    trigger: function (n) {
        debug('elroy %n', n);
        lookup('blinky').set(n === 1 ? Ghost.STATE_ELROY_1 : Ghost.STATE_ELROY_2);
    },

    onDotEaten: function () {
        var dots = lookup('dots').dotsRemaining();
        var threshold = this.threshold(level);
        if (dots === threshold) {
            this.trigger(2);
        } else if (dots === threshold * 2) {
            this.trigger(1);
        }
    }
};
