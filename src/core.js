/*
 * Base classes, constants, globals and utility functions.
 */

/*jslint bitwise: false */
/*global $, console, copy, format, keys, noop, values */

var TILE_SIZE = 8,
    TILE_CENTRE = TILE_SIZE / 2,
    COLS = 28,
    ROWS = 36,
    UPDATE_HZ = 60,

    SCREEN_W = COLS * TILE_SIZE,
    SCREEN_H = ROWS * TILE_SIZE,

    MAX_SPEED = 1,

    DEBUG = true,

    NORTH = 1 << 0,
    SOUTH = 1 << 1,
    EAST =  1 << 2,
    WEST =  1 << 3,

    // top-level entity group
    all,

    // resource manager
    resources,

    lives,
    level;

/// miscellany

function toCol(x) {
    return Math.floor(x / TILE_SIZE);
}

var toRow = toCol;

function toDx(direction) {
    return direction === WEST ? -1 : direction === EAST ? 1 : 0;
}

function toDy(direction) {
    return direction === NORTH ? -1 : direction === SOUTH ? 1 : 0;
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function reverse(direction) {
    return direction === NORTH ? SOUTH :
           direction === SOUTH ? NORTH :
           direction === EAST ? WEST :
           EAST;
}

function toTicks(seconds) {
    return Math.round(seconds * UPDATE_HZ);
}

function toSeconds(ticks) {
    return ticks / UPDATE_HZ;
}

function toOrdinal(direction) {
    return Math.log(direction) / Math.log(2);
}

function debug(/*msg, args*/) {
    if (DEBUG) {
        console.log(format.apply(this, arguments));
    }
}

/// graphics

function ScreenBuffer(w, h) {
    var canvas = $('<canvas></canvas>').attr({ width: w, height: h });
    if (!DEBUG) {
        canvas.hide();
    }
    $('body').append(canvas);
    return canvas.get(0);
}

function SpriteMap(img, fw, fh) {
    this.img = img;
    this.fw = fw;
    this.fh = fh;
    this.cols = img.width / fw;
    this.rows = img.height / fh;
}

SpriteMap.prototype.draw = function (g, x, y, col, row) {
    var w = this.fw, h = this.fh;
    g.drawImage(this.img, col * w, row * h, w, h, x, y, w, h);
};

/// event management

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

function EventManager() {
    this.reset();
}

EventManager.prototype = {

    reset: function () {
        this.delays = {};
        this.nextDelayId = 0;
    },

    delay: function (ticks, fn, repeats) {
        var manager = this,
            delay = new Delay(ticks, function () {
                fn.call(this);
                // fn might modify this.remaining, so check again
                if (!this.remaining) {
                    if (this.repeats === undefined || --this.repeats === 0) {
                        manager.cancel(this);
                    } else {
                        this.reset();
                    }
                }
            }),
            id = this.nextDelayId++;
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

/// entities

function broadcast(/*event, args...*/) {
    return all.notify.apply(all, arguments);
}

function lookup(id) {
    return all.get(id);
}

function Entity(props) {
    copy(props, this);
    this.invalidated = true;
}

Entity.prototype = {

    visible: true,

    setVisible: function (visible) {
        this.visible = visible;
        this.invalidate();
    },

    invalidate: function () {
        this.invalidated = true;
        if (this.x !== undefined && this.y !== undefined && this.w && this.h) {
            // cover antialiasing and sub-pixel artifacts
            var x = this.x - 1, y = this.y - 1, w = this.w + 2, h = this.h + 2;
            // normalise negative overflow
            var nx = Math.max(0, x),
                ny = Math.max(0, y),
                nw = w - (nx - x),
                nh = h - (ny - y);
            // normalise positive overflow
            nw -= Math.max(0, nx + nw - SCREEN_W);
            nh -= Math.max(0, ny + nh - SCREEN_H);
            if (nw > 0 && nh > 0) {
                broadcast('invalidateRegion', nx, ny, nw, nh);
            }
        }
    },

    invalidateRegion: function (x, y, w, h) {
        if (this.visible && !this.invalidated && this.intersects(x, y, w, h)) {
            // This default implementation invalidates the whole entity when any
            // part of it is invalidated, and recursively invalidates any other
            // affected entities. This can be overridden for finer control (Maze
            // does this).
            this.invalidate();
        }
    },

    intersects: function (x, y, w, h) {
        return !(this.y > y + h || y > this.y + this.h ||
                 this.x > x + w || x > this.x + this.w);
    },

    draw: function (g, regions) {
        if (this.visible && this.invalidated) {
            this.repaint(g);
            this.invalidated = false;
        }
    },

    // implemented by subclasses
    repaint: noop,

    moveTo: function (x, y) {
        if (x !== this.x || y !== this.y) {
            this.invalidate();
            this.x = x;
            this.y = y;
        }
    },

    centreAt: function (x, y) {
        this.moveTo(x - this.w / 2, y - this.h / 2);
    }
};

// Entities are organised into a tree-like structure, with `all' at the root.
// EntityGroups provide a relatively simple way to group entities and send them
// 'messages' (i.e. invoke methods on them). Group members are internally stored
// in a map (for fast lookup), but the order in which they are added is also
// preserved for iteration via `all()'.

function EntityGroup(props) {
    this.members = {};
    this.order = [];
    this.nextId = 0;
    copy(props, this);
}

EntityGroup.prototype = {

    // Lookup member by name.
    get: function (id) {
        return this.members[id];
    },

    // Add a named member.
    set: function (id, o) {
        // preserve ordering
        var old = this.get(id);
        if (old) {
            this.order.splice(this.order.indexOf(old), 1, o);
        } else {
            this.order.push(o);
        }
        this.members[id] = o;
    },

    // Add a group member and return its auto-generated ID.
    add: function (o) {
        var id = this.nextId++;
        this.set(id, o);
        return id;
    },

    remove: function (id) {
        var o = this.members[id];
        this.order.remove(o);
        delete this.members[id];
    },

    // Return group members in the order they were added.
    all: function () {
        return this.order;
    },

    // Invokes the named method on all members if the member has a property with
    // that name. If the method doesn't exist for a member EntityGroup, its
    // `notify' method is invoked instead.
    notify: function (fName /*, args...*/) {
        var allArgs = Array.prototype.slice.call(arguments, 0);
        var fArgs = Array.prototype.slice.call(arguments, 1);
        this.all().forEach(function (e) {
            var f = e[fName];
            if (f) {
                f.apply(e, fArgs);
            } else if (e instanceof EntityGroup) {
                e.notify.apply(e, allArgs);
            }
        });
    },

    toString: function () {
        return 'EntityGroup [' + keys(this.members).length + ']';
    }
};

var initialisers = [];

function enqueueInitialiser(f) {
    initialisers.push(f);
}

/// in-game score indicator

function InlineScore(score, cx, cy) {
    this.score = score;
    this.cx = cx;
    this.cy = cy;
}
InlineScore.prototype = new Entity({
    h: 5,
    repaint: function (g) {
        g.save();
        g.setFontSize(this.h);
        if (!this.w) {
            // can't position until we know text width
            this.w = g.measureText(this.score).width;
            this.centreAt(this.cx, this.cy);
        }
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = 'white';
        g.fillText(this.score, this.cx, this.cy);
        g.restore();
    }
});
