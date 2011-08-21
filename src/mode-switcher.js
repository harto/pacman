/*
 * Timer that periodically changes ghost behaviour between scatter and chase
 * modes.
 */

/*global Entity, Ghost, debug, level, lookup, toSeconds, toTicks */

function ModeSwitcher(level) {
    this.switchDelays = [
        toTicks(level < 5 ? 7 : 5),
        toTicks(20),
        toTicks(level < 5 ? 7 : 5),
        toTicks(20),
        toTicks(5),
        toTicks(level === 1 ? 20 : level < 5 ? 1033 : 1037),
        (level === 1 ? toTicks(5) : 1)
    ];
}

ModeSwitcher.prototype = new Entity({

    onRespawn: function () {
        this.enqueueSwitch(0);
    },

    enqueueSwitch: function (n) {
        var delay = this.switchDelays[n++];
        if (!delay) {
            // finished switching
            return;
        }

        debug('next mode switch in %ns', toSeconds(delay));
        this.scatterChaseTimer = this.delayEvent(delay, function () {
            var newState, oldState;
            if (n % 2) {
                oldState = Ghost.STATE_SCATTERING;
                newState = Ghost.STATE_CHASING;
            } else {
                oldState = Ghost.STATE_CHASING;
                newState = Ghost.STATE_SCATTERING;
            }

            debug('mode switch (%n): %s', n, Ghost.STATE_LABELS[newState]);

            ['blinky', 'pinky', 'inky', 'clyde'].map(function (name) {
                return lookup(name);
            }).forEach(function (g) {
                g.unset(oldState);
                g.set(newState);
                g.reverse();
            });
            this.enqueueSwitch(n);
        });
    },

    onEnergiserEaten: function () {
        // suspend scatter/chase timer for duration of fright
        var frightTicks = Ghost.FRIGHT_TICKS[level];
        if (frightTicks) {
            debug('%s for %ss',
                  Ghost.STATE_LABELS[Ghost.STATE_FRIGHTENED],
                  toSeconds(frightTicks));
            this.wait(frightTicks);
        }
    }
});
