/*
 * Base classes, constants, globals and utility functions.
 */

/*jslint bitwise: false */
/*global $, console */

var TILE_SIZE = 8,
    TILE_CENTRE = TILE_SIZE / 2,
    COLS = 28,
    ROWS = 36,
    UPDATE_HZ = 60,

    SCREEN_W = COLS * TILE_SIZE,
    SCREEN_H = ROWS * TILE_SIZE,
    TEXT_HEIGHT = TILE_SIZE,

    MAX_SPEED = 1,

    DEBUG = true,

    NORTH = 1 << 0,
    SOUTH = 1 << 1,
    EAST =  1 << 2,
    WEST =  1 << 3,

    lives,
    level,/*,
    lifeLost,
    dotsEaten,*/

    blinky,
    inky,
    pinky,
    clyde;

/// miscellany

function noop() {}

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

function toFrames(seconds) {
    return Math.round(seconds * UPDATE_HZ);
}
function toSeconds(frames) {
    return frames / UPDATE_HZ;
}

function toOrdinal(direction) {
    return Math.log(direction) / Math.log(2);
}

// custom printf-style formatting
function formatNumber(num, fmt) {
    num += '';
    if (!fmt) {
        return num;
    }
    var numParts = num.split('.'), dec = numParts[0], frac = numParts[1] || '',
        fmtParts = fmt.split('.'), nDec = fmtParts[0], nFrac = fmtParts[1];
    if (nFrac === undefined) {
        return dec.substring(0, nDec);
    } else {
        while (frac.length < nFrac) {
            frac += '0';
        }
        return (nDec === '' ? dec : dec.substring(0, nDec)) + '.' +
               frac.substring(0, nFrac);
    }
}
function format(msg/*, args*/) {
    var args = Array.prototype.slice.call(arguments, 1);
    return (msg + '').replace(/%(s|[0-9]?\.?[0-9]?n)/g, function (_, code) {
        var arg = args.shift();
        switch (code.charAt(code.length - 1)) {
        case 's':
            return arg;
        case 'n':
            return formatNumber(arg, code.substring(0, code.length - 1));
        default:
            throw new Error('bad format code: ' + code);
        }
    });
}

function debug(/*msg, args*/) {
    if (DEBUG) {
        console.log(format.apply(this, arguments));
    }
}

// Would be nice to extend Object with these, but it breaks jQuery

function keys(o) {
    var ks = [];
    for (var k in o) {
        if (o.hasOwnProperty(k)) {
            ks.push(k);
        }
    }
    return ks;
}

function values(o) {
    return keys(o).map(function (k) {
        return o[k];
    }, this);
}

function copy(from, to) {
    keys(from).forEach(function (k) {
        to[k] = from[k];
    });
}

/// native object extensions

// remove element from array in linear time
Array.prototype.remove = function (o) {
    var i = this.indexOf(o);
    if (i !== -1) {
        this.splice(i, 1);
    }
};

// return first element matching pred in linear time
Array.prototype.first = function (pred) {
    for (var i = 0; i < this.length; i++) {
        var x = this[i];
        if (pred(x)) {
            return x;
        }
    }
};

Math.sign = function (x) {
    return x < 0 ? -1 : x > 0 ? 1 : 0;
};

// remove fractional part of number
Math.trunc = function (x) {
    return Math.sign(x) * Math.floor(Math.abs(x));
};

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

var events = {

    subscribers: [],

    subscribe: function (subscriber) {
        this.subscribers.push(subscriber);
    },

    broadcast: function (id /*, args...*/) {
        var args = Array.prototype.slice.call(arguments, 1);
        this.subscribers.forEach(function (s) {
            var handler = s[id];
            if (handler) {
                handler.apply(s, args);
            }
        });
    },

    // delayed events

    delays: {},
    nextDelayId: 0,

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

var entities = [];

function addEntity(e) {
    entities.push(e);
    e.invalidate();
}

function removeEntity(e) {
    entities.remove(e);
    e.invalidate();
}

function Entity(props) {
    copy(props, this);
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
                // invalidate entities in affected region
                entities.forEach(function (e) {
                    e.invalidateRegion(nx, ny, nw, nh);
                });
            }
        }
    },

    invalidateRegion: function (x, y, w, h) {
        if (this.visible && !this.invalidated && this.intersects(x, y, w, h)) {
            this.invalidate();
        }
    },

    intersects: function (x, y, w, h) {
        return !(this.y > y + h || y > this.y + this.h ||
                 this.x > x + w || x > this.x + this.w);
    },

    repaint: function (g, regions) {
        if (this.visible && this.invalidated) {
            this.draw(g);
            this.invalidated = false;
        }
    },

    // subclasses may implement these
    draw: noop,
    update: noop,

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

