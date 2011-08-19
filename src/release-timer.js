/*
 * A timer that tracks the time since Pac-Man last ate a dot. If no dot is eaten
 * for some level-specific amount of time, the first waiting ghost is released.
 */

/*global Ghost, debug, events, toTicks */

function ReleaseTimer(level) {
    this.frequency = toTicks(level < 5 ? 4 : 3);
}

ReleaseTimer.prototype = {

    start: function () {
        this.timer = events.repeat(this, this.frequency, function () {
            var ghost = Ghost.all(Ghost.STATE_INSIDE)[0];
            if (ghost) {
                debug('dot-eaten timeout');
                ghost.release();
            }
        });
    },

    dotEaten: function () {
        events.reset(this.timer);
    }
};
