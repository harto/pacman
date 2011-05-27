/*
 * Base classes, constants, globals and utility functions.
 */

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
    return seconds * UPDATE_HZ;
}
function toSeconds(frames) {
    return frames / UPDATE_HZ;
}

function toOrdinal(direction) {
    return Math.log(direction) / Math.log(2);
}

// custom printf-style formatting
function formatFloat(num, fmt) {
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
    return (msg + '').replace(/%([st]|[0-9]?\.?[0-9]?f)/g, function (_, code) {
        var arg = args.shift();
        switch (code.charAt(code.length - 1)) {
        case 's':
            return arg;
        case 't':
            return toSeconds(arg) + 's';
        case 'f':
            return formatFloat(arg, code.substring(0, code.length - 1));
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

var invalidated = [];

// mark some area of the screen as requiring a redraw
function invalidateRegion(x, y, w, h) {
    invalidated.push({ x: x, y: y, w: w, h: h });
}

// force redraw of entire screen
function invalidateScreen() {
    invalidateRegion(0, 0, SCREEN_W, SCREEN_H);
}

/// event management

var events = {

    subscribers: [],

    subscribe: function (subscriber) {
        this.subscribers.push(subscriber);
    },

    raise: function (id /*, args...*/) {
        var args = Array.prototype.slice.call(arguments, 1);
        this.subscribers.forEach(function (s) {
            var handler = s[id];
            if (handler) {
                handler.apply(s, args);
            }
        });
    },

    // delayed events

    delayed: {},

    raiseDelayed: function (frames, id /*, args...*/) {
        this.delayed[id] = {
            frames: frames,
            // let slice include id to allow easy apply to eventRaise
            args: Array.prototype.slice.call(arguments, 1)
        };
    },

    cancelDelayed: function (id) {
        delete this.delayed[id];
    },

    update: function () {
        for (var id in this.delayed) {
            if (this.delayed.hasOwnProperty(id)) {
                var e = this.delayed[id];
                if (--e.frames <= 0) {
                    this.raise.apply(this, e.args);
                    delete this.delayed[id];
                }
            }
        }
    }
};

/// base class of most entities

function Entity() {}

Entity.prototype = {
    invalidate: function () {
        // cover antialiasing and sub-pixel artifacts
        invalidateRegion(this.x - 1, this.y - 1, this.w + 2, this.h + 2);
    },
    repaint: function (g, invalidated) {
        var x1 = this.x,
            x2 = x1 + this.w,
            y1 = this.y,
            y2 = y1 + this.h,
            invalid = invalidated.some(function (r) {
                var rx = r.x,
                    ry = r.y;
                return !(y1 > ry + r.h || ry > y2 || x1 > rx + r.w || rx > x2);
            });
        if (invalid) {
            this.draw(g);
        }
    },
    draw: function (g) {
        // implemented by subclasses
    },
    update: function () {
        // implemented by subclasses
    },
    moveTo: function (x, y) {
        this.x = x;
        this.y = y;
    },
    centreAt: function (x, y) {
        this.moveTo(x - this.w / 2, y - this.h / 2);
    }
};

