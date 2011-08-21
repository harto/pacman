/*
 * Counter that tracks the number of dots eaten by Pac-Man and releases ghosts
 * at the appopriate time.
 *
 * At the start of each level, each ghost is initialised with a personal dot
 * counter. Each time Pac-Man eats a dot, the counter of the most preferred
 * ghost within the house (in order: Pinky, Inky then Clyde) is decremented.
 * When a ghost's counter reaches zero, it is released.
 *
 * When Pac-Man is killed, a global dot counter is used in place of the
 * individual counters. Ghosts are released according to the value of this
 * counter: Pinky at 7, Inky at 17 and Clyde at 32. If Clyde is inside the house
 * when the counter reaches 32, the individual dot counters are henceforth used
 * as previously described. Otherwise, the global counter remains in effect.
 */

/*global Ghost, getObject */

function DotCounter(level) {
    this.counters = {
        blinky: 0,
        pinky: 0,
        inky: level === 1 ? 30 : 0,
        clyde: level === 1 ? 60 : level === 2 ? 50 : 0
    };
}

DotCounter.prototype = {

    onRespawn: function () {
        this.running = true;
    },

    useGlobalCounter: function () {
        this._usingGlobalCounter = true;
        this._globalCounter = 0;
    },

    onDotEaten: function () {
        if (this._usingGlobalCounter && ++this._globalCounter === 32 &&
            getObject('clyde').is(Ghost.STATE_INSIDE)) {
            this._usingGlobalCounter = false;
        } else {
            var first = Ghost.all(Ghost.STATE_INSIDE)[0];
            if (first) {
                --this.counters[first.name];
            }
        }
    },

    // Check counters and return first ghost waiting for release. This happens
    // every frame, not just when a dot is eaten, to ensure that ghosts with a
    // zero dot count are instantly released.
    waitingGhost: function () {
        var blinky = getObject('blinky');
        // The Pac-Man Dossier suggests that Blinky isn't affected by the global
        // dot counter, so just release him as soon as he comes inside.
        if (blinky.is(Ghost.STATE_INSIDE)) {
            return blinky;
        } else if (this._usingGlobalCounter) {
            var pinky = getObject('pinky'),
                inky = getObject('inky'),
                clyde = getObject('clyde');
            return this.dotCounter === 7 && pinky.is(Ghost.STATE_INSIDE) ? pinky :
                   this.dotCounter === 17 && inky.is(Ghost.STATE_INSIDE) ? inky :
                   this.dotCounter === 32 && clyde.is(Ghost.STATE_INSIDE) ? clyde :
                   null;
        } else {
            var counters = this.counters;
            return Ghost.all(Ghost.STATE_INSIDE).first(function (g) {
                return counters[g.name] <= 0;
            });
        }
    }
};
