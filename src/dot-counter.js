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

/*global Ghost, lookup */

function DotCounter(level) {
    this.counters = {
        blinky: 0,
        pinky: 0,
        inky: level === 1 ? 30 : 0,
        clyde: level === 1 ? 60 : level === 2 ? 50 : 0
    };
}

DotCounter.prototype = {

    start: function () {
        this.running = true;
    },

    stop: function () {
        this.running = false;
        this.useGlobalCounter = true;
        this.globalCounter = 0;
    },

    dotEaten: function () {
        if (this.useGlobalCounter && ++this.globalCounter === 32 &&
            lookup('clyde').is(Ghost.STATE_INSIDE)) {
            this.useGlobalCounter = false;
        } else {
            var first = Ghost.all(Ghost.STATE_INSIDE)[0];
            if (first) {
                --this.counters[first.name];
            }
        }
    },

    // Check counters and maybe release. This happens every frame, not just when
    // a dot is eaten, to ensure that ghosts with a zero dot count are instantly
    // released.
    update: function () {
        if (!this.running) {
            return;
        }
        var ghost,
            blinky = lookup('blinky');
        // The Pac-Man Dossier suggests that Blinky isn't affected by the global
        // dot counter, so just release him as soon as he comes inside.
        if (blinky.is(Ghost.STATE_INSIDE)) {
            ghost = blinky;
        } else if (this.useGlobalCounter) {
            var pinky = lookup('pinky'),
                inky = lookup('inky'),
                clyde = lookup('clyde');
            ghost = this.dotCounter === 7 && pinky.is(Ghost.STATE_INSIDE) ? pinky :
                    this.dotCounter === 17 && inky.is(Ghost.STATE_INSIDE) ? inky :
                    this.dotCounter === 32 && clyde.is(Ghost.STATE_INSIDE) ? clyde :
                    null;
        } else {
            var counters = this.counters;
            ghost = Ghost.all(Ghost.STATE_INSIDE).first(function (g) {
                return counters[g.name] <= 0;
            });
        }

        if (ghost) {
            ghost.release();
        }
    }
};

DotCounter.prototype.energiserEaten = DotCounter.prototype.dotEaten;
