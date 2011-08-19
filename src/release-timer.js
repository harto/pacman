/*
 * A timer that tracks the time since Pac-Man last ate a dot. If no dot is eaten
 * for some level-specific amount of time, the first waiting ghost is released.
 */

/*global Ghost, debug, lookup, toTicks */

function ReleaseTimer(level) {
    this.frequency = toTicks(level < 5 ? 4 : 3);
}

ReleaseTimer.prototype = {

    start: function () {
        var events = lookup('events');
        this.timer = events.repeat(this, this.frequency, function () {
            var ghost = Ghost.all(Ghost.STATE_INSIDE)[0];
            if (ghost) {
                debug('dot-eaten timeout');
                ghost.release();
            }
        });
    },

    dotEaten: function () {
        lookup('events').reset(this.timer);
    }
};
