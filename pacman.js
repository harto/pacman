/*
 * A graphics buffer containing a grid of equally-sized frames that may be
 * addressed by row and column index.
 */

function FrameGrid(img, fw, fh) {
    this.img = img;
    this.fw = fw;
    this.fh = fh;
    this.cols = img.width / fw;
    this.rows = img.height / fh;
}

FrameGrid.prototype.draw = function (g, x, y, col, row) {
    var w = this.fw, h = this.fh;
    g.drawImage(this.img, col * w, row * h, w, h, x, y, w, h);
};
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
/*
 * Miscellaneous project-independent utilities
 */

/*global document */

// format a number (fmt = '3.1', '.4', etc)
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

// printf-style formatting
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

function assert(test, msg) {
    if (!test) {
        //throw new Error(format('Assertion failed: %s', msg));
        debugger;
    }
}

function noop() {}

function bind(o, f) {
    return function (/*...*/) {
        f.apply(o, arguments);
    };
}

function idGenerator() {
    var nextId = 0;
    return function () {
        return nextId++;
    };
}

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
    if (!to) {
        to = {};
    }
    keys(from).forEach(function (k) {
        to[k] = from[k];
    });
    return to;
}

function merge(/*objects...*/) {
    var into = {};
    for (var i = 0; i < arguments.length; i++) {
        copy(arguments[i], into);
    }
    return into;
}

// Sends a message to an object. The object handles the message in one of the
// following ways:
//   - If msg is a property of the object, returns the result of invoking the
//     method with the given args.
//   - If no specific handler is found, but the object defines a `dispatch'
//     method, returns the result of invoking that method with the given msg
//     and args.
//   - If no handler or dispatch method is found, returns null.
function dispatch(o, msg, args) {
    if (msg in o) {
        return o[msg].apply(o, args);
    } else if ('dispatch' in o) {
        return o.dispatch(msg, args);
    } else {
        return null;
    }
}

// Math extensions

Math.sign = function (x) {
    return x < 0 ? -1 : x > 0 ? 1 : 0;
};

// remove fractional part of number
Math.trunc = function (x) {
    return x | 0;
};

// Array extensions

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

// Web stuff

var cookies = {

    set: function (name, value, opts) {
        document.cookie =
            name + '=' + value +
            (opts.expires ? '; expires=' + opts.expires.toGMTString() : '') +
            (opts.domain ? '; domain=' + opts.domain : '') +
            (opts.path ? '; path=' + opts.path : '');
    },

    unset: function (name) {
        this.set(name, '', { expires: new Date(0) });
    },

    read: function (name) {
        var kvs = document.cookie.split('; ');
        for (var i = 0; i < kvs.length; i++) {
            var kv = kvs[i].split('=', 2);
            if (kv[0] === name) {
                return kv[1];
            }
        }
    }
};
/*
 * Base classes, constants, globals and utility functions.
 */

/*jslint bitwise: false */
/*global console, dispatch, format */

var SCALE = 2,

    TILE_SIZE = 8 * SCALE,
    TILE_CENTRE = TILE_SIZE / 2,
    COLS = 28,
    ROWS = 36,
    UPDATE_HZ = 60,

    SCREEN_W = COLS * TILE_SIZE,
    SCREEN_H = ROWS * TILE_SIZE,

    MAX_SPEED = SCALE,

    DEBUG = false,

    NORTH = 1 << 0,
    SOUTH = 1 << 1,
    EAST =  1 << 2,
    WEST =  1 << 3,

    // forward declarations

    objects,   // top-level entity group
    resources, // resource manager
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

// Returns the ordinal of constants defined as increasing powers of 2.
function ordinal(constant) {
    return Math.log(constant) / Math.log(2);
}

function debug(/*msg, args*/) {
    if (DEBUG) {
        console.log(format.apply(this, arguments));
    }
}

function insertObject(id, o) {
    objects.set(id, o);
}

function getObject(id) {
    return objects.get(id);
}

function removeObject(id) {
    return objects.remove(id);
}

function broadcast(msg, args) {
    dispatch(objects, msg, args);
}

function invalidateRegion(x, y, w, h) {
    broadcast('invalidateRegion', [x, y, w, h]);
}

function invalidateScreen() {
    invalidateRegion(0, 0, SCREEN_W, SCREEN_H);
}

// once-off initialisation

var initialisers = [];

function enqueueInitialiser(f) {
    initialisers.push(f);
}
/*
 * Sound manager.
 */

/*global Audio, debug, format, keys, noop, values */

// Hack for browsers that don't support audio requirements
function DummySoundManager() {}

DummySoundManager.prototype = {
    play: noop,
    togglePause: noop,
    enable: noop,
    killAll: noop
};

function SoundManager(sounds) {
    // XXX: hack for Safari testing
    if (values(sounds).some(function (sound) { return !sound; })) {
        return new DummySoundManager();
    }

    // Copies of each sound are made in case a play request occurs while the
    // original is playing. Borrowed from
    // http://www.phoboslab.org/log/2011/03/multiple-channels-for-html5-audio
    this.sounds = {};
    keys(sounds).forEach(function (k) {
        var sound = sounds[k];
        var channels = [sound];
        // For this game, the number of channels is determined by the length
        // of the dot-eaten sound effect and the rate at which Pac-Man may
        // consume dots. With Pac-Man moving at 60px/sec, and dots about 8px
        // apart, the sound effect could be played up to 8 times per second. The
        // sound is just under a second long, so the number of required channels
        // is 8.
        var nCopies = 7;
        for (var i = 0; i < nCopies; i++) {
            channels.push(sound.cloneNode(true));
        }
        this.sounds[k] = channels;
    }, this);

    this.playing = [];
    this.enabled = true;
    this.nclones = 0;
}

SoundManager.formats = {
    ogg: 'audio/ogg; codecs="vorbis"'
};

SoundManager.load = function (id, path, onLoad, onError) {
    var aud = new Audio();

    var exts = keys(SoundManager.formats);
    var ext = exts.first(function (ext) {
        return aud.canPlayType(SoundManager.formats[ext]);
    });

    if (!ext) {
        // onError(format('No required audio formats (%s) are supported',
        //                exts.join(', ')));
        onLoad(null);
        return;
    }

    // guard against multiple onload events
    var loaded;
    aud.addEventListener('canplaythrough', function (e) {
        if (!loaded) {
            loaded = true;
            debug('loaded audio: %s', this.src);
            onLoad(aud);
        }
    }, false);
    aud.addEventListener('error', function (e) {
        onError(format('Error loading audio: %s', e.src));
    }, false);
    aud.src = format('%s/%s.ogg', path, id);
    aud.load();
};

SoundManager.prototype = {

    play: function (id) {
        if (!this.enabled) {
            return;
        }
        var channels = this.sounds[id];
        // find the first sound not playing
        var sound = channels.first(function (s) {
            return !s.playing;
        });

        if (!sound) {
            debug('can\'t play %s; skipping', id);
            return;
        }

        sound.playing = true;
        sound.addEventListener('ended', function () {
            sound.playing = false;
        }, false);
        sound.play();
    },

    currentlyPlaying: function () {
        var playing = values(this.sounds).map(function (channels) {
            return channels.filter(function (sound) {
                return sound.playing;
            });
        });
        return Array.prototype.concat.apply([], playing);
    },

    togglePause: function (paused) {
        this.currentlyPlaying().forEach(function (sound) {
            if (paused) {
                sound.pause();
            } else {
                sound.play();
            }
        });
    },

    enable: function (enabled) {
        if (!enabled) {
            this.killAll();
        }
        this.enabled = enabled;
    },

    killAll: function () {
        this.currentlyPlaying().forEach(function (sound) {
            sound.playing = false;
            // XXX: is there a better way to kill sounds?
            sound.pause();
            sound.currentTime = 0;
        });
    }
};
/*
 * A way to group entities into a tree-like structure. The top-level group
 * is the global variable `objects'.
 *
 * Groups provide a relatively simple way to organise objects and send them
 * 'messages' (i.e. invoke methods on them).
 *
 * Members are internally stored in a map for fast lookup. Their iteration
 * order is defined by their respective `z' attributes. (Note: this is only
 * checked on insert.
 */

/*global copy, dispatch, idGenerator, keys */

function Group(props) {
    copy(props, this);
}

Group.prototype = {

    // Lookup member by name.
    get: function (id) {
        return this.members[id];
    },

    // Add a named member.
    set: function (id, o) {
        if (!this.members) {
            this.members = {};
            this.zIndex = [];
        }
        if (id in this.members) {
            // Remove previous incarnation
            this.remove(id);
        }
        this.members[id] = o;

        // Respect z-index order. An object added after another object with the
        // same z-index appears later in the index.
        if (o.z === undefined) {
            o.z = 0;
        }
        // Insertion sort
        var zIndex = this.zIndex;
        for (var i = 0; i < zIndex.length; i++) {
            if (o.z < zIndex[i].z) {
                break;
            }
        }
        zIndex.splice(i, 0, o);
        dispatch(o, 'invalidate');
    },

    // Add a group member and return its auto-generated ID.
    add: function (o) {
        if (!this.nextId) {
            this.nextId = idGenerator();
        }
        var id = this.nextId();
        this.set(id, o);
        return id;
    },

    remove: function (id) {
        var o = this.members[id];
        if (o) {
            delete this.members[id];
            this.zIndex.remove(o);
            dispatch(o, 'invalidate');
        }
        return o;
    },

    suspend: function (id) {
        this.get(id)._active = false;
    },

    resume: function (id) {
        this.get(id)._active = true;
    },

    // Returns the result of dispatching the given message to all members of the
    // group. To intercept specific messages, define a method with that name.
    // This function could then be manually called from within the handler to
    // continue propagating the message.
    dispatch: function (msg, args) {
        this.zIndex.forEach(function (o) {
            dispatch(o, msg, args);
        });
    },

    toString: function () {
        return 'Group [' + keys(this.members).length + ']';
    }
};
/*
 * Image manager
 */

/*global Image, debug, format */

function ImageManager(imgs) {
    this.imgs = imgs;
}

ImageManager.load = function (id, path, onLoad, onError) {
    var img = new Image();
    img.onload = function () {
        debug('loaded image: %s', this.src);
        onLoad(img);
    };
    img.onerror = function () {
        onError(format('Error loading image: %s', this.src));
    };
    img.src = format('%s/%s.png', path, id);
};

ImageManager.prototype = {

    get: function (id) {
        return this.imgs[id];
    }
};
/*
 * Top-level resource manager
 */

/*global FontLoader, ImageManager, SoundManager, format */

function ResourceManager(imageManager, soundManager) {
    this.images = imageManager;
    this.sounds = soundManager;
}

ResourceManager.prototype = {

    getImage: function (id) {
        return this.images.get(id);
    },

    playSound: function (id) {
        this.sounds.play(id);
    },

    togglePause: function (paused) {
        this.sounds.togglePause(paused);
    },

    enableSounds: function (enabled) {
        this.sounds.enable(enabled);
    },

    soundsEnabled: function () {
        return this.sounds.enabled;
    },

    killSounds: function () {
        this.sounds.killAll();
    }
};

// Load resources as specified. The `props' object should specify:
//   base: base href of resources
//   images: array of image IDs to be loaded
//   sounds: array of sound IDs to be loaded
//   fonts: an object defining `stylesheet' and `families'
//   onUpdate: function that accepts the proportion of loaded resources (0.0 - 1.0)
//   onComplete: a function that accepts an initialised ResourceManager
//   onError: a function that accepts an error message
ResourceManager.load = function (props) {
    var base = props.base.replace(/\/$/, ''),
        imageIds = props.images || [],
        soundIds = props.sounds || [],
        fonts = props.fonts || {};

    props.onUpdate(0);

    var nTotal = imageIds.length +
                 soundIds.length +
                 (fonts.families ? fonts.families.length : 0),
        nRemaining = nTotal,
        images = {},
        sounds = {};

    function resourceLoaded() {
        --nRemaining;
        props.onUpdate((nTotal - nRemaining) / nTotal);
        if (nRemaining === 0) {
            props.onComplete(new ResourceManager(new ImageManager(images),
                                                 new SoundManager(sounds)));
        }
    }

    var aborted;
    function resourceFailed(/*msg, args...*/) {
        if (!aborted) {
            aborted = true;
            props.onError(format.apply(this, arguments));
        }
    }

    // Produces an onload function that inserts resource with `id' into
    // `collection'.
    function makeOnload(id, collection) {
        return function (resource) {
            collection[id] = resource;
            resourceLoaded();
        };
    }

    function makeOnError(id) {
        return function (msg) {
            resourceFailed('Unable to load resource: %s\n%s', id, msg);
        };
    }

    imageIds.forEach(function (id) {
        ImageManager.load(id, base, makeOnload(id, images), makeOnError(id));
    });
    soundIds.forEach(function (id) {
        SoundManager.load(id, base, makeOnload(id, sounds), makeOnError(id));
    });

    // Loading fonts is different to loading other resources: objects aren't
    // returned and all fonts begin loading at the same time.
    function onFontError(family) {
        resourceFailed('Unable to load font: %s', family);
    }
    FontLoader.load(base, fonts.stylesheet, fonts.families, resourceLoaded, onFontError);
};

/*
 * An object that can be updated and which manages its own events.
 */

/*global Delay, assert, bind, copy, noop */

function Entity(props) {
    copy(props, this);
}

Entity.prototype = {

    delayEvent: function (ticks, fn, repeats) {
        assert(ticks > 0);
        assert(fn instanceof Function);
        assert(repeats === undefined || repeats > 0);

        var self = this;
        var event = new Delay(ticks, function () {
            fn.call(self);
            if (repeats === undefined || --repeats === 0) {
                self.cancelEvent(event);
            } else {
                event.reset();
            }
        });

        if (!this._events) {
            this._events = [];
        }
        this._events.push(event);
        return event;
    },

    repeatEvent: function (ticks, fn, repeats) {
        return this.delayEvent(ticks, fn, repeats || Infinity);
    },

    cancelEvent: function (event) {
        if (event) {
            this._events.remove(event);
        }
    },

    wait: function (ticks) {
        this._wait = new Delay(ticks || Infinity, bind(this, function () {
            this.resume();
        }));
    },

    resume: function () {
        delete this._wait;
    },

    update: function () {
        if (this._wait) {
            this._wait.update();
        }

        // check again; might be time to resume
        if (!this._wait) {
            this.doUpdate();
            if (this._events) {
                this._events.forEach(function (event) {
                    event.update();
                });
            }
        }
    },

    doUpdate: noop
};
/*
 * Drawable entity
 */

/*global Entity, SCREEN_H, SCREEN_W, copy, invalidateRegion, noop, toCol,
  toRow */

function Sprite(props) {
    copy(props, this);
    this._invalidated = true;
    this._visible = true;
}

Sprite.prototype = new Entity({

    setVisible: function (visible) {
        this._visible = visible;
        this.invalidate();
    },

    isVisible: function () {
        return this._visible;
    },

    invalidate: function () {
        this._invalidated = true;
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
                invalidateRegion(nx, ny, nw, nh);
            }
        }
    },

    invalidateRegion: function (x, y, w, h) {
        if (this._visible && !this._invalidated && this.intersects(x, y, w, h)) {
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

    draw: function (g) {
        if (this._visible && this._invalidated) {
            this.repaint(g);
            this._invalidated = false;
        }
    },

    // implemented by subclasses
    repaint: noop,

    moveTo: function (x, y) {
        if (x !== this.x || y !== this.y) {
            this.invalidate();
            this.x = x;
            this.y = y;
            // centre x, y
            this.cx = x + this.w / 2;
            this.cy = y + this.h / 2;
            // tile location
            this.col = toCol(this.cx);
            this.row = toRow(this.cy);
        }
    },

    centreAt: function (x, y) {
        this.moveTo(x - this.w / 2, y - this.h / 2);
    }
});
/*
 * Drawable text
 */

/*global Sprite, copy, format */

function Text(props) {
    copy(props, this);
}

Text.STYLE_NORMAL = '"Helvetica Neue", Helvetica, sans-serif';
Text.STYLE_FIXED_WIDTH = '"Press Start 2P"';

Text.prototype = new Sprite({

    repaint: function (g) {
        g.save();

        this.recomputeBoundary(g);

        g.textAlign = this.align || 'left';
        g.textBaseline = this.valign || 'top';
        g.fillStyle = this.colour || 'white';
        g.fillText(this.txt, this._x, this._y);

        g.restore();
    },

    recomputeBoundary: function (g) {
        g.font = format('%spx %s', this.size, this.style);

        this.w = g.measureText(this.txt).width;
        this.h = this.size;

        // We initially allow the `x' and `y' properties to be interpreted
        // according to the `align' and `valign' properties. However, an Entity
        // must describe the top-left of the bounding rectangle with these
        // properties. We therefore keep the original x- and y-coords in
        // anticipation of overwriting them.
        if (this._x === undefined) {
            this._x = this.x;
            this._y = this.y;
        }

        this.x = this.align === 'center' ? this._x - this.w / 2 :
                 this.align === 'right' ? this._x - this.w :
                 this._x;

        this.y = this.valign === 'middle' ? this._y - this.h / 2 :
                 this.valign === 'bottom' ? this._y - this.h :
                 this._y;
    },

    setText: function (txt) {
        this.txt = txt;
        this.invalidate();
    },

    toString: function () {
        return format('Text [%s]', this.txt);
    }
});
/*
 * Text bits and pieces appearing in the header area
 */

/*global Group, TILE_SIZE, Text, highscore, merge, score, toTicks */

function Header() {
    var props = {
        style: Text.STYLE_FIXED_WIDTH,
        size: TILE_SIZE
    };
    this.set('1up', new Text(merge(props, {
        txt: '1UP',
        x: 4 * TILE_SIZE,
        y: 0
    })));
    this.add(new Text(merge(props, {
        txt: 'HIGH SCORE',
        x: 9 * TILE_SIZE,
        y: 0
    })));
    this.set('score', new Text(merge(props, {
        txt: score,
        align: 'right',
        x: 7 * TILE_SIZE,
        y: TILE_SIZE
    })));
    this.set('highscore', new Text(merge(props, {
        txt: highscore,
        align: 'right',
        x: 17 * TILE_SIZE,
        y: TILE_SIZE
    })));
}

Header.prototype = new Group({

    onRespawn: function () {
        var oneup = this.get('1up');
        oneup.cancelEvent(oneup._blinker);
        oneup._blinker = oneup.repeatEvent(toTicks(0.25), function () {
            this.setVisible(!this.isVisible());
        });
    },

    updateScore: function (score, highscore) {
        this.get('score').setText(score);
        if (score === highscore) {
            this.get('highscore').setText(highscore);
        }
    }
});
/*
 * Text overlay for pause etc.
 */

/*global SCREEN_H, SCREEN_W, Sprite, TILE_SIZE, Text */

function InfoText(txt) {
    this.txt = new Text({
        txt: txt,
        style: Text.STYLE_NORMAL,
        size: TILE_SIZE,
        colour: 'black',
        align: 'center',
        valign: 'middle',
        x: SCREEN_W / 2,
        y: SCREEN_H / 2
    });

    this.pad = TILE_SIZE / 2;
    this.z = 3;

    this.w = this.h = 0;
}

InfoText.prototype = new Sprite({

    repaint: function (g) {
        g.save();

        if (!this.w) {
            this.txt.recomputeBoundary(g);
            this.w = this.txt.w + 2 * this.pad;
            this.h = this.txt.h + 2 * this.pad;
            this.x = this.txt.x - this.pad;
            this.y = this.txt.y - this.pad;
        }

        g.fillStyle = 'white';
        g.fillRect(this.x, this.y, this.w, this.h);
        this.txt.repaint(g);

        g.restore();
    }
});
/*
 * Interface to Google WebFont Loader, per
 * http://code.google.com/apis/webfonts/docs/webfont_loader.html
 */

/*global $, debug, document, format, window */

var FontLoader = {

    load: function (base, stylesheet, families, onload, onerror) {

        window.WebFontConfig = {
            custom: {
                families: families,
                urls: [format('%s/%s', base, stylesheet)]
            },
            fontactive: function (family, _) {
                //debug('active: %s', family);
                onload(family);
            },
            fontinactive: function (family, _) {
                //debug('inactive: %s', family);
                onerror(family);
            }
        };

        $('head').append(
            $(document.createElement('script')).attr(
                'src', 'http://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js'));
    }
};
/*
 * An off-screen graphics buffer.
 */

/*global $, DEBUG */

function GraphicsBuffer(w, h) {
    var canvas = $('<canvas></canvas>').attr({ width: w, height: h });
    if (DEBUG) {
        canvas.css({ border: '1px black solid' });
        $('body').append(canvas);
    }
    return canvas.get(0);
}
/*
 * Maze.
 */

/*jslint bitwise: false */
/*global COLS, DEBUG, EAST, Entity, GraphicsBuffer, NORTH, ROWS, SCREEN_H,
  SCREEN_W, SOUTH, TILE_CENTRE, TILE_SIZE, WEST, debug, enqueueInitialiser,
  invalidateScreen, resources, toTicks */

function Maze() {
    this.invalidatedRegions = [];
    this.img = Maze.BG;
    // always draw first
    this.z = -Infinity;
}

// house entry/exit tile
Maze.HOME_COL = 14;
Maze.HOME_ROW = 14;
Maze.HOME_TILE = { col: Maze.HOME_COL, row: Maze.HOME_ROW };

// no-north-turn zones
Maze.NNTZ_COL_MIN = 12;
Maze.NNTZ_COL_MAX = 15;
Maze.NNTZ_ROW_1 = 14;
Maze.NNTZ_ROW_2 = 26;

Maze.TUNNEL_WEST_EXIT_COL = -2;
Maze.TUNNEL_EAST_EXIT_COL = COLS + 1;

Maze.PACMAN_X = Maze.BONUS_X = Maze.HOME_COL * TILE_SIZE;
Maze.PACMAN_Y = Maze.BONUS_Y = 26 * TILE_SIZE + TILE_CENTRE;

// collision map including dots and energisers
Maze.LAYOUT = ['############################',
               '############################',
               '############################',
               '############################',
               '#............##............#',
               '#.####.#####.##.#####.####.#',
               '#o####.#####.##.#####.####o#',
               '#.####.#####.##.#####.####.#',
               '#..........................#',
               '#.####.##.########.##.####.#',
               '#.####.##.########.##.####.#',
               '#......##....##....##......#',
               '######.##### ## #####.######',
               '######.##### ## #####.######',
               '######.##          ##.######',
               '######.## ######## ##.######',
               '######.## ######## ##.######',
               '      .   ########   .      ',
               '######.## ######## ##.######',
               '######.## ######## ##.######',
               '######.##          ##.######',
               '######.## ######## ##.######',
               '######.## ######## ##.######',
               '#............##............#',
               '#.####.#####.##.#####.####.#',
               '#.####.#####.##.#####.####.#',
               '#o..##.......  .......##..o#',
               '###.##.##.########.##.##.###',
               '###.##.##.########.##.##.###',
               '#......##....##....##......#',
               '#.##########.##.##########.#',
               '#.##########.##.##########.#',
               '#..........................#',
               '############################',
               '############################',
               '############################'];

Maze.enterable = function (col, row) {
    return Maze.LAYOUT[row][col] !== '#';
};

Maze.inTunnel = function (col, row) {
    return row === 17 && (col <= 4 || 23 <= col);
};

// Return a number that is the bitwise-OR of directions in which an actor
// may exit a given tile.
Maze.exitsFrom = function (col, row) {
    if (this.inTunnel(col, row)) {
        return EAST | WEST;
    } else {
        return (this.enterable(col, row - 1) ? NORTH : 0) |
               (this.enterable(col, row + 1) ? SOUTH : 0) |
               (this.enterable(col - 1, row) ? WEST : 0) |
               (this.enterable(col + 1, row) ? EAST : 0);
    }
};

// check if tile falls within one of two zones in which ghosts are
// prohibited from turning north
Maze.northDisallowed = function (col, row) {
    return (Maze.NNTZ_COL_MIN <= col && col <= Maze.NNTZ_COL_MAX) &&
           (row === Maze.NNTZ_ROW_1 || row === Maze.NNTZ_ROW_2);
};

Maze.prototype = new Entity({

    invalidate: function () {
        invalidateScreen();
    },

    invalidateRegion: function (x, y, w, h) {
        this.invalidatedRegions.push({ x: x, y: y, w: w, h: h });
    },

    draw: function (g) {
        this.invalidatedRegions.forEach(function (r) {
            var x = r.x, y = r.y, w = r.w, h = r.h;
            g.drawImage(this.img, x, y, w, h, x, y, w, h);
        }, this);
        this.invalidatedRegions = [];
    },

    isFlashing: function (g) {
        return this.img === Maze.BG_FLASH;
    },

    setFlashing: function (flashing) {
        this.img = flashing ? Maze.BG_FLASH : Maze.BG;
        this.invalidate();
    },

    flash: function (fn) {
        var duration = toTicks(0.4);
        var times = 8;

        this.repeatEvent(duration, function () {
            this.setFlashing(!this.isFlashing());
        }, times);
        this.delayEvent(duration * (times + 1), fn);
    }
});

enqueueInitialiser(function () {
    function createBuffer(imgName) {
        var img = resources.getImage(imgName);
        var buf = new GraphicsBuffer(SCREEN_W, SCREEN_H);
        buf.getContext('2d').drawImage(img, 0, 0, SCREEN_W, SCREEN_H);
        return buf;
    }

    Maze.BG = createBuffer('bg', SCREEN_W, SCREEN_H);
    var g = Maze.BG.getContext('2d');

    // FIXME: should this be toggleable?
    if (DEBUG) {
        // gridlines
        g.strokeStyle = 'white';
        g.lineWidth = 0.25;
        for (var row = 0; row < ROWS; row++) {
            g.beginPath();
            g.moveTo(0, row * TILE_SIZE);
            g.lineTo(SCREEN_W, row * TILE_SIZE);
            g.stroke();
        }
        for (var col = 0; col < COLS; col++) {
            g.beginPath();
            g.moveTo(col * TILE_SIZE, 0);
            g.lineTo(col * TILE_SIZE, SCREEN_H);
            g.stroke();
        }

        g.globalAlpha = 0.5;

        // no-NORTH-turn zones
        g.fillStyle = 'grey';
        var nntzX = Maze.NNTZ_COL_MIN * TILE_SIZE;
        var nntzW = (Maze.NNTZ_COL_MAX - Maze.NNTZ_COL_MIN + 1) * TILE_SIZE;
        g.fillRect(nntzX, Maze.NNTZ_ROW_1 * TILE_SIZE,
                   nntzW, TILE_SIZE);
        g.fillRect(nntzX, Maze.NNTZ_ROW_2 * TILE_SIZE,
                   nntzW, TILE_SIZE);

        // ghost home tile
        g.fillStyle = 'green';
        g.fillRect(Maze.HOME_COL * TILE_SIZE, Maze.HOME_ROW * TILE_SIZE,
                   TILE_SIZE, TILE_SIZE);
    }

    Maze.BG_FLASH = createBuffer('bg-flash');
});
/*
 * Base class of entities that move through the maze.
 */

/*global EAST, Maze, NORTH, SOUTH, Sprite, TILE_CENTRE, TILE_SIZE, WEST, copy,
  toCol, toRow */

function Actor(props) {
    copy(props, this);
}

// Actors can only move in whole-pixel offsets, but speeds (and hence movements)
// may be provided as non-integral amounts. When such values are given, the
// fractional amount of movement is accumulated and added to the actor's next
// move.

Actor._calcMove = function (dx, dy, accDx, accDy) {
    function addAccumulated(v, acc) {
        // Discard accumulated value when changing direction
        return v + (v && Math.sign(v) === Math.sign(acc) ? acc : 0);
    }

    var realDx = addAccumulated(dx, accDx);
    var realDy = addAccumulated(dy, accDy);

    var integralDx = Math.trunc(realDx);
    var integralDy = Math.trunc(realDy);

    return { dx: integralDx,
             dy: integralDy,
             accDx: realDx - integralDx,
             accDy: realDy - integralDy };
};

Actor._pastTileCentre = function (lx, ly, direction) {
    return (direction === WEST && lx <= TILE_CENTRE) ||
           (direction === EAST && lx >= TILE_CENTRE) ||
           (direction === NORTH && ly <= TILE_CENTRE) ||
           (direction === SOUTH && ly >= TILE_CENTRE);
};

Actor.prototype = new Sprite({

    pastTileCentre: function () {
        return Actor._pastTileCentre(this.lx, this.ly, this.direction);
    },

    moveBy: function (dx, dy) {
        this.applyMove(Actor._calcMove(dx, dy, this.accDx, this.accDy));
    },

    calcMove: function (dx, dy) {
        return Actor._calcMove(dx, dy, this.accDx, this.accDy);
    },

    applyMove: function (move) {
        this.moveTo(this.x + move.dx, this.y + move.dy);
        this.accDx = move.accDx;
        this.accDy = move.accDy;
    },

    moveSwitchesTile: function (x, y, move) {
        return toCol(x) !== toCol(x + move.dx) ||
               toRow(y) !== toRow(y + move.dy);
    },

    // check if planned move goes past tile centre in given direction
    movesPastTileCentre: function (move, direction) {
        return Actor._pastTileCentre(this.lx + move.dx, this.ly + move.dy, direction);
    },

    // Raw placement function - doesn't account for accumulated dx, dy
    moveTo: function (x, y) {
        var min = Maze.TUNNEL_WEST_EXIT_COL * TILE_SIZE;
        var max = Maze.TUNNEL_EAST_EXIT_COL * TILE_SIZE;
        x = x < min ? max : max < x ? min : x;

        this.prevCol = this.col;
        this.prevRow = this.row;

        Sprite.prototype.moveTo.call(this, x, y);

        // local x, y
        this.lx = Math.abs(this.cx % TILE_SIZE);
        this.ly = Math.abs(this.cy % TILE_SIZE);
    }
});
/*
 * Ghost class and aggregate utility functions.
 */

/*jslint bitwise:false */
/*global Actor, EAST, MAX_SPEED, Maze, NORTH, SOUTH, FrameGrid, TILE_CENTRE,
  TILE_SIZE, UPDATE_HZ, WEST, copy, debug, distance, enqueueInitialiser,
  format, keys, level, getObject, ordinal, resources, reverse, toCol, toDx, toDy,
  toRow, toTicks */

function Ghost(props) {
    copy(props, this);
    // XXX: call this animTicks or something
    this.nTicks = 0;
    this.w = this.h = Ghost.SIZE;
    this.z = 2;
}

Ghost.STATE_ENTERING   = 1 << 0;
Ghost.STATE_INSIDE     = 1 << 1;
Ghost.STATE_EXITING    = 1 << 2;
Ghost.STATE_FRIGHTENED = 1 << 3;
Ghost.STATE_DEAD       = 1 << 4;
Ghost.STATE_CHASING    = 1 << 5;
Ghost.STATE_SCATTERING = 1 << 6;
Ghost.STATE_ELROY_1    = 1 << 7;
Ghost.STATE_ELROY_2    = 1 << 8;

Ghost.STATE_LABELS = (function () {
    var labels = {};
    keys(Ghost).forEach(function (k) {
        var m = /^STATE_(.+)$/.exec(k);
        if (m) {
            labels[Ghost[k]] = m[1];
        }
    });
    return labels;
}());

// Returns ghosts in the given state, in preferred-release-order.
Ghost.all = function (state) {
    return ['blinky', 'pinky', 'inky', 'clyde'].map(getObject).filter(function (g) {
        return !state || g.is(state);
    });
};

// Gets the number of points that a ghost is worth. This is determined by the
// number of ghosts killed, which is inferred from the number of currently
// frightened ghosts.
Ghost.calcGhostScore = function (nFrightened) {
    return Math.pow(2, 4 - nFrightened) * 200;
};

// duration of frightened time, indexed by level
Ghost.FRIGHT_TICKS = [null, 6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1].map(toTicks);
// number of times to flash when becoming unfrightened, indexed by level
Ghost.FRIGHT_FLASHES = [null, 5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 5, 3, 3, 5, 3, 3, 0, 3];

Ghost.ANIM_FREQ = UPDATE_HZ / 10;
Ghost.SPRITES = {};
Ghost.SIZE = 28;

enqueueInitialiser(function () {
    var w = Ghost.SIZE,
        h = Ghost.SIZE,
        ids = ['blinky', 'pinky', 'inky', 'clyde', 'frightened', 'flashing', 'dead'];
    ids.forEach(function (id) {
        Ghost.SPRITES[id] = new FrameGrid(resources.getImage(id), w, h);
    });
});

Ghost.prototype = new Actor({

    onRespawn: function () {
        this.startCx = this.startCol * TILE_SIZE;
        this.startCy = this.startRow * TILE_SIZE + TILE_CENTRE;
        this.centreAt(this.startCx, this.startCy);

        if (toRow(this.startCy) !== Maze.HOME_ROW) {
            this.set(Ghost.STATE_INSIDE);
        }

        this.set(Ghost.STATE_SCATTERING);
        this.setOutsideDirection(WEST);
    },

    toString: function () {
        return this.name;
    },

    set: function (state) {
        //debug('%s: entering state %s', this, Ghost.STATE_LABELS[state]);
        this.state |= state;
    },

    unset: function (state) {
        //debug('%s: leaving state %s', this, Ghost.STATE_LABELS[state]);
        this.state &= ~state;
    },

    is: function (state) {
        return this.state & state;
    },

    repaint: function (g) {
        var sprites =
                this.is(Ghost.STATE_DEAD) ? Ghost.SPRITES.dead :
                this.is(Ghost.STATE_FRIGHTENED) ? (this.flashing ?
                                                   Ghost.SPRITES.flashing :
                                                   Ghost.SPRITES.frightened) :
                Ghost.SPRITES[this.name],
            spriteCol = Math.floor(this.nTicks / Ghost.ANIM_FREQ) % sprites.cols,
            spriteRow = ordinal(this.pendingDirection);
        g.save();
        sprites.draw(g, this.x, this.y, spriteCol, spriteRow);
        g.restore();
    },

    release: function () {
        debug('%s: exiting', this);
        this.unset(Ghost.STATE_INSIDE);
        this.set(Ghost.STATE_EXITING);
        this.path = this.calcExitPath();
    },

    calcExitPath: function () {
        var x = Maze.HOME_COL * TILE_SIZE;
        var y = Maze.HOME_ROW * TILE_SIZE + TILE_CENTRE;
        return [{ x: x, y: y + 3 * TILE_SIZE }, { x: x, y: y }];
    },

    calcEntryPath: function () {
        var path = this.calcExitPath();
        path.reverse();
        if (toRow(this.startCy) !== Maze.HOME_ROW) {
            // return ghosts to start column in house
            path.push({ x: this.startCx, y: this.startCy });
        }
        return path;
    },

    calcSpeed: function () {
        // XXX: entry/exit and dead speeds are just estimates
        return (this.is(Ghost.STATE_ENTERING) || this.is(Ghost.STATE_EXITING) ? 0.6 :
                this.is(Ghost.STATE_DEAD) ? 2 :
                Maze.inTunnel(this.col, this.row) ? (level === 1 ? 0.4 :
                                                     level < 5 ? 0.45 :
                                                     0.5) :
                this.is(Ghost.STATE_FRIGHTENED) ? (level === 1 ? 0.5 :
                                                   level < 5 ? 0.55 :
                                                   0.6) :
                this.is(Ghost.STATE_ELROY_2) ? (level === 1 ? 0.85 :
                                                level < 5 ? 0.95 :
                                                1.05) :
                this.is(Ghost.STATE_ELROY_1) ? (level === 1 ? 0.8 :
                                                level < 5 ? 0.9 :
                                                1) :
                (level === 1 ? 0.75 : level < 5 ? 0.85 : 0.95)) * MAX_SPEED;
    },

    doUpdate: function () {
        if (this.is(Ghost.STATE_INSIDE)) {
            this.jostle();
        } else if (this.is(Ghost.STATE_ENTERING) || this.is(Ghost.STATE_EXITING)) {
            this.enterExitHouse();
        } else if (this.shouldEnterHouse()) {
            this.startEnteringHouse();
        } else {
            this.move();
        }
        this.nTicks++;
    },

    jostle: function () {
        // FIXME
        this.invalidate();
    },

    // follow path into/out of house
    // FIXME: need to set direction for correct sprite display
    enterExitHouse: function () {
        var point = this.path.shift(),
            dx = point.x - this.cx,
            dy = point.y - this.cy,
            speed = this.calcSpeed();
        if (point && !(Math.abs(dx) < speed && Math.abs(dy) < speed)) {
            this.moveBy(Math.sign(dx) * speed, Math.sign(dy) * speed);
            this.path.unshift(point);
        }
        if (!this.path.length) {
            if (this.is(Ghost.STATE_ENTERING)) {
                this.unset(Ghost.STATE_ENTERING);
                this.set(Ghost.STATE_INSIDE);
            } else {
                this.unset(Ghost.STATE_EXITING);
            }
        }
    },

    shouldEnterHouse: function () {
        return this.is(Ghost.STATE_DEAD) &&
               this.row === Maze.HOME_ROW &&
               Math.abs(this.cx - Maze.HOME_COL * TILE_SIZE) < this.calcSpeed();
    },

    startEnteringHouse: function () {
        debug('%s: entering house', this);
        this.unset(Ghost.STATE_DEAD);
        this.set(Ghost.STATE_ENTERING);
        this.path = this.calcEntryPath();
    },

    // Ghosts can only change direction at the centre of a tile. They compute
    // their moves one tile in advance.
    //
    // The following properties track ghost direction:
    //   direction:         current direction
    //   pendingDirection:  direction to take when current tile centre is reached
    //   nextTileDirection: direction to take when next tile centre is reached

    // set direction to be taken on house exit
    setOutsideDirection: function (direction) {
        this.direction = this.pendingDirection = direction;
        this.nextTileDirection = this.calcExitDirection(Maze.HOME_COL,
                                                        Maze.HOME_ROW,
                                                        direction);
    },

    move: function () {
        var speed = this.calcSpeed();
        var move = this.calcMove(toDx(this.direction) * speed,
                                 toDy(this.direction) * speed);

        if (this.pendingDirection !== this.direction &&
            this.movesPastTileCentre(move, this.direction)) {
            // centre on tile to avoid under/overshoot
            this.moveBy(TILE_CENTRE - this.lx, TILE_CENTRE - this.ly);
            this.direction = this.pendingDirection;
        } else {
            if (this.moveSwitchesTile(this.cx, this.cy, move)) {
                var pending = this.nextTileDirection;
                // prepare for current tile move
                this.pendingDirection = pending;
                // compute next tile move
                this.nextTileDirection =
                    this.calcExitDirection(toCol(this.cx + move.dx) + toDx(pending),
                                           toRow(this.cy + move.dy) + toDy(pending),
                                           pending);
            }
            this.applyMove(move);
        }
    },

    // Reverses the ghost at the next available opportunity. Directional changes
    // only take effect when a tile centre is reached.
    reverse: function (direction) {
        direction = reverse(this.direction);

        if (this.is(Ghost.STATE_ENTERING) ||
            this.is(Ghost.STATE_INSIDE) ||
            this.is(Ghost.STATE_EXITING)) {
            this.setOutsideDirection(direction);
        } else if (this.pastTileCentre()) {
            // Too late to change in this tile; wait until next one
            this.nextTileDirection = direction;
        } else {
            // Set direction to leave current tile
            this.pendingDirection = direction;
            this.nextTileDirection = this.calcExitDirection(this.col + toDx(direction),
                                                            this.row + toDy(direction),
                                                            direction);
        }
    },

    // calculates direction to exit a tile
    calcExitDirection: function (col, row, entryDirection) {
        var exits = Maze.exitsFrom(col, row);
        // exclude illegal moves
        exits &= ~reverse(entryDirection);
        if (Maze.northDisallowed(col, row)) {
            exits &= ~NORTH;
        }
        if (!exits) {
            throw new Error(format('%s: no exits from [%s, %s]', this, col, row));
        }
        // check for single available exit
        if (exits === NORTH || exits === SOUTH || exits === WEST || exits === EAST) {
            return exits;
        }

        // When a ghost is frightened, it selects a random direction and cycles
        // clockwise until a valid exit is found. In any other mode, an exit is
        // selected according to the Euclidean distance between the exit tile and
        // some current target tile.
        var exitDirection;
        if (this.is(Ghost.STATE_FRIGHTENED)) {
            var directions = [NORTH, EAST, SOUTH, WEST];
            var i = Math.floor(Math.random() * directions.length);
            while (!(exitDirection = directions[i] & exits)) {
                i = (i + 1) % directions.length;
            }
        } else {
            var target = this.is(Ghost.STATE_DEAD) ? Maze.HOME_TILE :
                         this.is(Ghost.STATE_SCATTERING) ? this.scatterTile :
                         this.calcTarget();

            var candidates = [];
            // Add candidates in tie-break order
            [NORTH, WEST, SOUTH, EAST].filter(function (d) {
                return exits & d;
            }).forEach(function (d) {
                candidates.push({ direction: d,
                                  dist: distance(col + toDx(d),
                                                 row + toDy(d),
                                                 target.col,
                                                 target.row) });
            });
            candidates.sort(function (a, b) {
                return a.dist - b.dist;
            });
            exitDirection = candidates[0].direction;
        }
        return exitDirection;
    },

    colliding: function (pacman) {
        return pacman.col === this.col &&
               pacman.row === this.row &&
               !this.is(Ghost.STATE_DEAD) ? this : null;
    },

    kill: function () {
        this.unfrighten();
        this.set(Ghost.STATE_DEAD);
    },

    onEnergiserEaten: function () {
        if (!this.is(Ghost.STATE_DEAD)) {
            this.reverse();
        }

        var frightTicks = Ghost.FRIGHT_TICKS[level];
        if (!frightTicks) {
            return;
        }

        // cancel any existing timers
        this.unfrighten();
        this.set(Ghost.STATE_FRIGHTENED);
        // ensure stationary ghosts are redrawn
        // FIXME: might be unnecessary
        this.invalidate();

        this.unfrightenTimer = this.delayEvent(frightTicks, function () {
            this.unfrighten();
        });

        var flashes = 2 * Ghost.FRIGHT_FLASHES[level],
            // FIXME: won't work for later levels
            flashDuration = toTicks(0.25),
            flashStart = frightTicks - (flashes + 1) * flashDuration;

        this.flashing = false;
        this.startFlashTimer = this.delayEvent(flashStart, function () {
            this.flashTimer = this.repeatEvent(flashDuration, function () {
                this.flashing = !this.flashing;
            }, flashes);
        });
    },

    unfrighten: function () {
        [this.unfrightenTimer,
         this.startFlashTimer,
         this.flashTimer].forEach(this.cancelEvent, this);
        this.unset(Ghost.STATE_FRIGHTENED);
    }
});
/*
 * The red ghost.
 */

/*global COLS, Ghost, Maze, getObject */

function Blinky() {
    this.name = 'blinky';
    this.startCol = Maze.HOME_COL;
    this.startRow = Maze.HOME_ROW;
    this.scatterTile = { col: COLS - 3, row: 0 };
}

Blinky.prototype = new Ghost({

    calcTarget: function () {
        // target pacman directly
        var pacman = getObject('pacman');
        return { col: pacman.col, row: pacman.row };
    }
});
/*
 * The orange ghost.
 */

/*global Ghost, Maze, ROWS, distance, getObject */

function Clyde() {
    this.name = 'clyde';
    this.startCol = Maze.HOME_COL + 2;
    this.startRow = Maze.HOME_ROW + 3;
    this.scatterTile = { col: 0, row: ROWS - 2 };
}

Clyde.prototype = new Ghost({

    calcTarget: function () {
        // target pacman directly when further than 8 tiles from him, otherwise
        // target scatter mode tile
        var pacman = getObject('pacman'),
            pCol = pacman.col,
            pRow = pacman.row;
        return distance(pCol, pRow, this.col, this.row) > 8 ?
                   { col: pCol, row: pRow } :
                   this.scatterTile;
    }
});
/*
 * The Pac-Man actor.
 */

/*jslint bitwise:false */
/*global Actor, EAST, Ghost, GraphicsBuffer, MAX_SPEED, Maze, NORTH, SOUTH,
  FrameGrid, TILE_CENTRE, TILE_SIZE, WEST, enqueueInitialiser, level, ordinal,
  toDx, toDy, toTicks */

function Pacman() {
    this.direction = WEST;

    this.frameIndex = 0;
    this.frameInc = 1;

    this.w = this.h = Pacman.SIZE;
    this.centreAt(Maze.PACMAN_X, Maze.PACMAN_Y);

    this.z = 1;
}

// Draws a Pac-Man figure to the given context.
//  - g: graphics context
//  - x: centre x-coord
//  - y: centre y-coord
//  - radius: radius
//  - startAngle: angle at which mouth points
//  - proportion: proportion to draw [0, 1]
//  - offsetHinge: true to offset hinge toward back of head
Pacman.draw = function (g, x, y, radius, startAngle, proportion, offsetHinge) {
    if (!proportion) {
        return;
    }
    g.save();
    g.beginPath();
    // offset hinge towards back of head
    var centreOffset = offsetHinge ? radius / 4 : 0;
    var xOffset = (startAngle === 0 ? -1 :
                   startAngle === Math.PI ? 1 :
                   0) * centreOffset;
    var yOffset = (startAngle === Math.PI / 2 ? -1 :
                   startAngle === 3 * Math.PI / 2 ? 1 :
                   0) * centreOffset;
    g.moveTo(x + xOffset, y + yOffset);
    var start = startAngle || 0;
    var angle = Math.PI - proportion * Math.PI;
    g.arc(x, y, radius, start + angle, start + (angle === 0 ? 2 * Math.PI : -angle), false);
    g.moveTo(x + xOffset, y + yOffset);
    g.closePath();
    g.fillStyle = 'yellow';
    g.fill();
    g.restore();
};

Pacman.SIZE = Math.floor(1.5 * TILE_SIZE);

// Programmatically pre-render frames
enqueueInitialiser(function () {
    // Two sprite maps are produced: one for regular maze movement and one for
    // the death sequence. The animation runs faster during regular maze
    // movement (i.e. contains fewer frames) and only limits mouth angle to
    // 40% of the maximum.

    function createFrameGrid(steps, stepProportion) {
        var size = Pacman.SIZE,
            // iterate through directions in increasing-angle order
            directions = [EAST, SOUTH, WEST, NORTH],
            buf = new GraphicsBuffer(size * steps, size * directions.length),
            g = buf.getContext('2d'),
            radius = size / 2;

        directions.forEach(function (direction, row) {
            var startAngle = row * Math.PI / 2;
            //var stepProportion = minProportion / steps;
            var y = ordinal(direction) * size + radius;
            for (var col = 0; col < steps; col++) {
                Pacman.draw(g, col * size + radius, y, radius,
                            startAngle,
                            1 - col * stepProportion,
                            true);
            }
        });

        return new FrameGrid(buf, size, size);
    }

    var steps = toTicks(0.08);
    Pacman.SPRITES = createFrameGrid(steps, 0.4 / steps);
    steps = toTicks(1);
    Pacman.SPRITES_DYING = createFrameGrid(steps, 1 / steps);

    // TODO: create dead 'blink'
});

Pacman.prototype = new Actor({

    onDotEaten: function (d) {
        this.wait(d.delay);
    },

    repaint: function (g) {
        var self = this;
        function drawSprite(map, col) {
            map.draw(g, self.x, self.y, col, ordinal(self.direction));
        }

        if (this.dying) {
            var nFrames = Pacman.SPRITES_DYING.cols;
            if (this.deathTicks < nFrames) {
                drawSprite(Pacman.SPRITES_DYING, this.deathTicks);
            } else if (this.deathTicks < nFrames + toTicks(0.2)) {
                // hide momentarily
            }
        } else {
            drawSprite(Pacman.SPRITES, this.frameIndex);
        }
    },

    // replaces doUpdate on kill (FIXME: ugly)
    deathSequence: function () {
        if (this.deathTicks++ > Pacman.SPRITES_DYING.cols + toTicks(0.5)) {
            this.dead = true;
        }
        this.invalidate();
    },

    doUpdate: function () {
        var newDirection = this.turning || this.direction;
        if (this.move(newDirection)) {
            this.direction = newDirection;
        } else if (this.direction !== newDirection) {
            this.move(this.direction);
        }
    },

    calcSpeed: function () {
        var frightened = Ghost.all(Ghost.STATE_FRIGHTENED).length;
        return (frightened ? (level === 1 ? 0.9 :
                              level < 5 ? 0.95 :
                              1) :
                             (level === 1 ? 0.8 :
                              level < 5 || level > 20 ? 0.9 :
                              1)) * MAX_SPEED;
    },

    move: function (direction) {
        var speed = this.calcSpeed();

        // cornering - centre on axis of movement
        var dx = toDx(direction) * speed;
        var dy = toDy(direction) * speed;
        if (toDx(direction)) {
            dy = (this.ly > TILE_CENTRE ? -1 : this.ly < TILE_CENTRE ? 1 : 0) * speed;
        } else if (toDy(direction)) {
            dx = (this.lx > TILE_CENTRE ? -1 : this.lx < TILE_CENTRE ? 1 : 0) * speed;
        }

        var move = this.calcMove(dx, dy);

        // Move in the given direction iff before tile centrepoint or
        // an adjacent tile lies beyond.
        if (this.movesPastTileCentre(move, direction) &&
            !(direction & Maze.exitsFrom(this.col, this.row))) {
            return false;
        }

        this.applyMove(move);
        // update animation cycle
        this.frameIndex += this.frameInc;
        if (this.frameIndex === 0 || this.frameIndex === Pacman.SPRITES.cols - 1) {
            this.frameInc *= -1;
        }
        return true;
    },

    kill: function () {
        this.dying = true;
        this.deathTicks = 0;
        // XXX: ugly
        this.doUpdate = this.deathSequence;
    },

    toString: function () {
        return 'pacman';
    }
});
/*
 * Gutter panel displaying remaining number of lives
 */

/*global GraphicsBuffer, Pacman, SCREEN_H, Sprite, TILE_SIZE,
  enqueueInitialiser */

function LifeDisplay(lives) {
    this.setLives(lives);
}

LifeDisplay.GRID_SIZE = 2 * TILE_SIZE;
LifeDisplay.ICON_SIZE = Math.floor(1.4 * TILE_SIZE);

LifeDisplay.prototype = new Sprite({

    setLives: function (lives) {
        this.invalidate();

        this.lives = lives;

        var gridSize = LifeDisplay.GRID_SIZE;
        this.x = TILE_SIZE * 2;
        this.y = SCREEN_H - gridSize;
        this.w = gridSize * lives;
        this.h = gridSize;
    },

    repaint: function (g) {
        g.save();

        var iconSize = LifeDisplay.ICON_SIZE,
            gridSize = LifeDisplay.GRID_SIZE,
            lives = this.lives,
            x,
            y = this.y + gridSize / 2 - iconSize / 2;
        for (var i = 0; i < lives; i++) {
            x = this.x + i * gridSize + gridSize / 2 - iconSize / 2;
            g.drawImage(LifeDisplay.ICON,
                        0, 0, iconSize, iconSize,
                        x, y, iconSize, iconSize);
        }

        g.restore();
    }
});

enqueueInitialiser(function () {
    var size = LifeDisplay.ICON_SIZE;
    var icon = new GraphicsBuffer(size, size);
    var r = size / 2;
    Pacman.draw(icon.getContext('2d'), r, r, r, Math.PI, 0.8, true);
    LifeDisplay.ICON = icon;
});
/*
 * Timer that periodically changes ghost behaviour between scatter and chase
 * modes.
 */

/*global Entity, Ghost, debug, level, getObject, toSeconds, toTicks */

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
                return getObject(name);
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
/*
 * The pink ghost.
 */

/*global Ghost, Maze, getObject, toDx, toDy */

function Pinky() {
    this.name = 'pinky';
    this.startCol = Maze.HOME_COL;
    this.startRow = Maze.HOME_ROW + 3;
    this.scatterTile = { col: 2, row: 0 };
}

Pinky.prototype = new Ghost({

    calcTarget: function () {
        // target 4 tiles ahead of pacman's current direction
        var pacman = getObject('pacman');
        return { col: pacman.col + toDx(pacman.direction) * 4,
                 row: pacman.row + toDy(pacman.direction) * 4 };
    }
});
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
/*
 * Bonus/fruit
 */

/*global Maze, Sprite, TILE_SIZE, debug, insertObject, removeObject, toTicks */

function Bonus(symbol, value) {
    // FIXME: do something with symbol
    this.symbol = symbol;
    this.w = this.h = TILE_SIZE;
    this.value = value;
}

Bonus.prototype = new Sprite({

    repaint: function (g) {
        // FIXME
        g.save();
        g.fillStyle = 'white';
        g.fillRect(this.x, this.y, this.w, this.h);
        g.restore();
    },

    insert: function () {
        this.centreAt(Maze.BONUS_X, Maze.BONUS_Y);
        var secs = 9 + Math.random();
        debug('displaying bonus for %.3ns', secs);
        insertObject('bonus', this);
        this.timeout = this.delayEvent(toTicks(secs), function () {
            debug('bonus timeout');
            removeObject('bonus');
        });
    },

    colliding: function (pacman) {
        return pacman.col === this.col && pacman.row === this.row ? this : null;
    }
});

Bonus.forLevel = function (level) {
    return level === 1 ? new Bonus('cherry', 100) :
           level === 2 ? new Bonus('strawberry', 300) :
           level <= 4 ? new Bonus('peach', 500) :
           level <= 6 ? new Bonus('apple', 700) :
           level <= 8 ? new Bonus('grape', 700) :
           level <= 10 ? new Bonus('galaxian', 2000) :
           level <= 12 ? new Bonus('bell', 3000) :
           new Bonus('key', 5000);
};
/*
 * The gutter display containing last 6 bonuses.
 */

/*global Bonus, Group, SCREEN_H, SCREEN_W, TILE_SIZE */

function BonusDisplay(level) {
    // display bonus for current and previous 5 levels, drawing right-to-left
    var cx = SCREEN_W - 3 * TILE_SIZE;
    var cy = SCREEN_H - TILE_SIZE;
    var minLevel = Math.max(1, level - BonusDisplay.MAX_DISPLAY + 1);
    for (var L = level; L >= minLevel; L--) {
        var b = Bonus.forLevel(L);
        b.centreAt(cx - (level - L) * 2 * TILE_SIZE, cy);
        this.add(b);
    }
}

BonusDisplay.MAX_DISPLAY = 6;
BonusDisplay.prototype = new Group();
/*
 * An edible maze dot.
 */

/*global GraphicsBuffer, Sprite, TILE_SIZE, copy, enqueueInitialiser */

function Dot(props) {
    copy(props, this);
    this.value = 10;
    this.delay = 1;
    this.w = Dot.SIZE;
    this.h = Dot.SIZE;
}

Dot.SIZE = TILE_SIZE * 0.25;
Dot.COLOUR = '#FCC';

Dot.createSprite = function (size, colour) {
    var sprite = new GraphicsBuffer(size, size);
    var g = sprite.getContext('2d');
    g.beginPath();
    var r = size / 2;
    g.arc(r, r, r, 0, Math.PI * 2, true);
    g.fillStyle = colour;
    g.fill();

    return sprite;
};

Dot.prototype = new Sprite({

    place: function (col, row) {
        this.centreAt(col * TILE_SIZE + TILE_SIZE / 2,
                      row * TILE_SIZE + TILE_SIZE / 2);
    },

    repaint: function (g) {
        g.save();
        g.drawImage(this.sprite, this.x, this.y);
        g.restore();
    }
});

enqueueInitialiser(function () {
    Dot.prototype.sprite = Dot.createSprite(Dot.SIZE, Dot.COLOUR);
});
/*
 * A flashing dot that bestows ghost-eating powers.
 */

/*global Dot, TILE_SIZE, enqueueInitialiser, toTicks */

function Energiser() {
    this.value = 50;
    this.delay = 3;
    this.w = Energiser.SIZE;
    this.h = Energiser.SIZE;
}

Energiser.SIZE = TILE_SIZE * 0.75;
Energiser.COLOUR = '#FFB6AD';
Energiser.BLINK_DURATION = toTicks(0.15);

Energiser.prototype = new Dot({

    onRespawn: function () {
        this.setVisible(true);
        this.cancelEvent(this._blinker);
        this._blinker = this.repeatEvent(Energiser.BLINK_DURATION, function () {
            this.setVisible(!this.isVisible());
        });
    }
});

enqueueInitialiser(function () {
    Energiser.prototype.sprite = Dot.createSprite(Energiser.SIZE, Energiser.COLOUR);
});
/*
 * The group that manages dots and energisers for performance reasons.
 */

/*global Bonus, COLS, Dot, Energiser, Maze, dispatch, level, toCol, toRow */

function DotGroup() {
    this.nDots = 0;
    this.dots = [];
    this.energisers = [];

    var layout = Maze.LAYOUT;
    for (var row = 0; row < layout.length; row++) {
        this.dots[row] = [];
        for (var col = 0; col < layout[row].length; col++) {
            var ch = layout[row][col];
            var dot;
            if (ch === '.') {
                dot = new Dot();
            } else if (ch === 'o') {
                dot = new Energiser();
                this.energisers.push(dot);
            } else {
                continue;
            }
            this.dots[row][col] = dot;
            dot.place(col, row);
            ++this.nDots;
        }
    }

    this.invalidated = [];
}

DotGroup.prototype = {

    onRespawn: function () {
        this.energisers.forEach(function (energiser) {
            energiser.onRespawn();
        });
    },

    dotsRemaining: function () {
        return this.nDots;
    },

    isEmpty: function () {
        return this.dotsRemaining() === 0;
    },

    dotAt: function (col, row) {
        var dots = this.dots[row];
        return dots ? dots[col] : null;
    },

    colliding: function (pacman) {
        return this.dotAt(pacman.col, pacman.row);
    },

    remove: function (dot) {
        delete this.dots[dot.row][dot.col];
        if (dot instanceof Energiser) {
            this.energisers.remove(dot);
        }
        --this.nDots;
        // FIXME: pull up
        if (this.nDots === 74 || this.nDots === 174) {
            Bonus.forLevel(level).insert();
        }
    },

    invalidateRegion: function (x, y, w, h) {
        // Track distinct invalidated dots using a sparse array. This is faster
        // than doing an overlap check on all the dots, particularly near the
        // start of a level. (An average of 9 invalidated regions and ~200 dots
        // equates to nearly 2000 calls to intersecting() per frame. This
        // solution:
        //   * finds the tiles touching each invalidated region (a maximum of
        //     about 50 per frame),
        //   * does a constant-time lookup on the 2D array of dots to find
        //     possibly affected dots, then
        //   * does a bounds check only on those dots that might be affected.
        var c1 = toCol(x),
            r1 = toRow(y),
            c2 = toCol(x + w),
            r2 = toRow(y + h);
        for (var r = r1; r <= r2; r++) {
            for (var c = c1; c <= c2; c++) {
                var d = this.dotAt(c, r);
                // This dot is in the vicinity of the affected region, so
                // perform a full bounds check
                if (d && d.isVisible() && d.intersects(x, y, w, h)) {
                    this.invalidated[r * COLS + c] = d;
                }
            }
        }
    },

    draw: function (g) {
        this.invalidated.forEach(function (d) {
            d.repaint(g);
        });
        this.invalidated = [];
    },

    update: function () {
        this.energisers.forEach(function (energiser) {
            energiser.update();
        });
    }
};
/*
 * In-maze score indicators
 */

/*global TILE_SIZE, Text, format */

function InlineScore(score, colour, cx, cy) {
    this.txt = score;
    this.colour = colour;
    this.x = cx;
    this.y = cy;

    this.size = TILE_SIZE * 0.9;
    this.style = Text.STYLE_NORMAL;
    this.align = 'center';
    this.valign = 'middle';
}

InlineScore.prototype = new Text({

    toString: function () {
        return format('InlineScore [%s]', this.txt);
    }
});
/*
 * The blue ghost.
 */

/*global COLS, Ghost, Maze, ROWS, getObject, toDx, toDy */

function Inky() {
    this.name = 'inky';
    this.startCol = Maze.HOME_COL - 2;
    this.startRow = Maze.HOME_ROW + 3;
    this.scatterTile = { col: COLS - 1, row: ROWS - 2 };
}

Inky.prototype = new Ghost({

    calcTarget: function () {
        // target tile at vector extending from blinky with midpoint 2 tiles
        // ahead of pacman
        var pacman = getObject('pacman'),
            blinky = getObject('blinky');
        var cx = pacman.col + toDx(pacman.direction) * 2;
        var cy = pacman.row + toDy(pacman.direction) * 2;
        return { col: cx + cx - blinky.col,
                 row: cy + cy - blinky.row };
    }
});
/*
 * Counter that triggers 'Cruise Elroy' mode
 */

/*global Ghost, debug, level, getObject */

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
        getObject('blinky').set(n === 1 ? Ghost.STATE_ELROY_1 : Ghost.STATE_ELROY_2);
    },

    onDotEaten: function () {
        var dots = getObject('dots').dotsRemaining();
        var threshold = this.threshold(level);
        if (dots === threshold) {
            this.trigger(2);
        } else if (dots === threshold * 2) {
            this.trigger(1);
        }
    }
};
/*
 * A timer that tracks the time since Pac-Man last ate a dot. If no dot is eaten
 * for some level-specific amount of time, the first waiting ghost is released.
 */

/*global Entity, Ghost, debug, toTicks */

function ReleaseTimer(level) {
    this.frequency = toTicks(level < 5 ? 4 : 3);
}

ReleaseTimer.prototype = new Entity({

    onRespawn: function () {
        this.timer = this.repeatEvent(this.frequency, function () {
            var ghost = Ghost.all(Ghost.STATE_INSIDE)[0];
            if (ghost) {
                debug('dot-eaten timeout');
                ghost.release();
            }
        });
    },

    dotEaten: function () {
        this.timer.reset();
    }
});
/*
 * An HTML5 Pac-Man clone.
 * https://www.github.com/harto/pacman
 *
 * Based on the game as described by The Pac-Man Dossier
 * (http://home.comcast.net/~jpittman2/pacman/pacmandossier.html)
 */

/*global $, Blinky, BonusDisplay, Clyde, DEBUG, Delay, DotCounter, DotGroup,
  EAST, ElroyCounter, Energiser, Ghost, Group, Header, InfoText, Inky,
  InlineScore, LifeDisplay, Maze, ModeSwitcher, NORTH, Pacman, Pinky,
  ReleaseTimer, ResourceManager, SCREEN_H, SCREEN_W, SOUTH, TILE_SIZE, Text,
  UPDATE_HZ, WEST, alert, broadcast, cookies, debug, format, highscore:true,
  initialisers, insertObject, invalidateScreen, level:true, lives:true, getObject,
  merge, objects:true, removeObject, resources:true, score:true, toTicks, wait,
  window */

function getPref(key) {
    return cookies.read(key);
}

function setPref(key, value) {
    var expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    cookies.set(key, value, { expires: expiry });
}

var stats = {

    UPDATE_INTERVAL_MS: 1000,
    nTicks: 0,
    totalTickTime: 0,
    totalInvalidated: 0,
    prevUpdate: new Date().getTime(),

    init: function () {
        this.panel = $('<pre id="stats"></pre>');
        this.panel.css({ position: 'fixed', right: 0, top: 0 });
        $('#cruft').append(this.panel);
        this.inited = true;
    },

    update: function () {
        var now = new Date().getTime();
        if (now - this.prevUpdate >= this.UPDATE_INTERVAL_MS) {
            if (!this.inited) {
                this.init();
            }
            this.prevUpdate = now;

            var fps = this.nTicks;
            this.nTicks = 0;

            var avgTick = this.totalTickTime / fps;
            this.totalTickTime = 0;

            this.panel.html(format('fps: %n\navgTick: %3.2nms',
                                   fps, avgTick));

        } else {
            ++this.nTicks;
        }
    }
};

var MODE_RUNNING  = 'running',
    MODE_WAITING  = 'waiting',
    MODE_DYING    = 'dying',
    MODE_LEVELUP  = 'levelup',
    MODE_FINISHED = 'finished';

var mode, paused, waitTimer;

function wait(secs, onResume) {
    waitTimer = (function (prevMode, prevTimer) {
        return new Delay(toTicks(secs), function () {
            mode = prevMode;
            waitTimer = prevTimer;
            onResume();
        });
    }(mode, waitTimer));
    mode = MODE_WAITING;
}

function respawn(starting) {
    invalidateScreen();
    mode = MODE_RUNNING;

    insertObject('modeSwitcher', new ModeSwitcher(level));
    insertObject('releaseTimer', new ReleaseTimer(level));
    var lifeDisplay = new LifeDisplay(starting ? lives : lives - 1);
    insertObject('lifeDisplay', lifeDisplay);

    function insertStartupText(id, props) {
        insertObject(id, new Text(merge(props, {
            size: TILE_SIZE,
            style: Text.STYLE_FIXED_WIDTH
        })));
    }

    insertStartupText('readyText', {
        txt: 'READY!',
        colour: 'yellow',
        x: 11 * TILE_SIZE,
        y: 20 * TILE_SIZE
    });

    function start() {
        insertObject('pacman', new Pacman());
        insertObject('blinky', new Blinky());
        insertObject('pinky', new Pinky());
        insertObject('inky', new Inky());
        insertObject('clyde', new Clyde());
        insertObject('elroyCounter', new ElroyCounter(level, getObject('dots').dotsRemaining()));
        broadcast('onRespawn');
        wait(starting ? 2 : 1, function () {
            removeObject('readyText');
        });
    }

    if (starting) {
        insertStartupText('playerOneText', {
            txt: 'PLAYER ONE',
            colour: 'cyan',
            x: 9 * TILE_SIZE,
            y: 14 * TILE_SIZE
        });
        wait(2, function () {
            lifeDisplay.setLives(lives - 1);
            removeObject('playerOneText');
            start();
        });
        resources.playSound('intro');
    } else {
        start();
    }
}

function levelUp(starting) {
    resources.killSounds();
    ++level;
    debug('starting level %s', level);

    insertObject('dots', new DotGroup());
    insertObject('dotCounter', new DotCounter(level));
    insertObject('bonusDisplay', new BonusDisplay(level));

    respawn(starting);
}

function addPoints(points) {
    score += points;
    highscore = Math.max(score, highscore);
    getObject('header').updateScore(score, highscore);
}

// Removes all entities that will be replaced on respawn.
function removeTransientEntities() {
    ['blinky', 'inky', 'pinky', 'clyde', 'bonus', 'bonusScore',
     'ghostScore', 'releaseTimer', 'modeSwitcher'].forEach(removeObject);
}

function levelComplete() {
    removeTransientEntities();
    removeObject('dots');
    getObject('pacman').wait();
    getObject('maze').flash(levelUp);
    mode = MODE_LEVELUP;
}

function processDotCollisions(pacman, dots) {
    var dot = dots.colliding(pacman);
    if (dot) {
        dots.remove(dot);
        broadcast('onDotEaten', [dot]);
        if (dot instanceof Energiser) {
            broadcast('onEnergiserEaten', [dot]);
        }
        resources.playSound('tick' + Math.floor(Math.random() * 4));
        addPoints(dot.value);
        if (dots.isEmpty()) {
            wait(1, levelComplete);
        }
    }
}

function processBonusCollision(pacman, bonus) {
    if (bonus && bonus.colliding(pacman)) {
        debug('bonus eaten');
        removeObject('bonus');
        addPoints(bonus.value);
        var bonusScore = new InlineScore(bonus.value, '#FBD', bonus.cx, bonus.cy);
        insertObject('bonusScore', bonusScore);
        bonusScore.delayEvent(toTicks(1), function () {
            removeObject('bonusScore');
        });
    }
}

function killPacman() {
    removeTransientEntities();
    getObject('pacman').kill();
    getObject('dotCounter').useGlobalCounter();
    mode = MODE_DYING;
}

function killGhosts(pacman, deadGhosts) {
    pacman.setVisible(false);
    var scoreValue, scoreCx, scoreCy;
    var nFrightened = Ghost.all(Ghost.STATE_FRIGHTENED).length;
    deadGhosts.forEach(function (g) {
        debug('%s: dying', g);
        g.kill();
        g.setVisible(false);
        scoreValue = Ghost.calcGhostScore(nFrightened--);
        scoreCx = g.cx;
        scoreCy = g.cy;
        addPoints(scoreValue);
    });
    insertObject('ghostScore', new InlineScore(scoreValue, 'cyan', scoreCx, scoreCy));
    wait(0.5, function () {
        removeObject('ghostScore');
        deadGhosts.concat(pacman).forEach(function (o) {
            o.setVisible(true);
        });
    });
}

function processGhostCollisions(pacman, ghosts) {
    var collidingGhosts = ghosts.filter(function (g) {
        return g.colliding(pacman);
    });
    var deadGhosts = collidingGhosts.filter(function (g) {
        return g.is(Ghost.STATE_FRIGHTENED);
    });
    if (deadGhosts.length !== collidingGhosts.length) {
        wait(1, killPacman);
    } else if (deadGhosts.length) {
        killGhosts(pacman, deadGhosts);
    }
}

function lifeLost() {
    if (--lives) {
        respawn();
    } else {
        // game over
        var prevBest = getPref('highscore') || 0;
        setPref('highscore', Math.max(prevBest, highscore));
        mode = MODE_FINISHED;
    }
}

function update() {
    if (paused) {
        return;
    }

    if (mode === MODE_WAITING) {
        waitTimer.update();
        return;
    }

    objects.dispatch('update');

    var pacman = getObject('pacman');
    if (mode === MODE_RUNNING) {
        processDotCollisions(pacman, getObject('dots'));
        processBonusCollision(pacman, getObject('bonus'));
        processGhostCollisions(pacman, Ghost.all());
        var waitingGhost = getObject('dotCounter').waitingGhost();
        if (waitingGhost) {
            waitingGhost.release();
        }
    } else if (mode === MODE_DYING && pacman.dead) {
        lifeLost();
    }
}

var ctx;

function draw() {
    objects.dispatch('draw', [ctx]);
}

var UPDATE_DELAY = 1000 / UPDATE_HZ,
    timer,
    lastLoopTime = new Date(),
    lastFrameTime = new Date();

function loop() {
    var now = new Date();

    update();
    draw();

    var elapsed = new Date() - now;
    stats.totalTickTime += elapsed;
    if (mode !== MODE_FINISHED) {
        timer = window.setTimeout(loop, Math.max(0, UPDATE_DELAY - elapsed));
    }
}

/// initialisation

function newGame() {
    window.clearTimeout(timer);

    level = 0;
    lives = 3;
    score = 0;
    paused = false;

    objects = new Group();
    insertObject('maze', new Maze());
    insertObject('header', new Header());
    if (DEBUG) {
        insertObject('stats', stats);
    }

    levelUp(true);
    loop();
}

var pauseTextId;

function togglePause() {
    paused = !paused;
    resources.togglePause(paused);
    if (paused) {
        insertObject('pauseText', new InfoText('Paused'));
    } else {
        removeObject('pauseText');
    }
}

function initKeyBindings() {
    function charCode(c) {
        return c.charCodeAt(0);
    }

    var keys = {
        left:          37, // left arrow
        right:         39, // right arrow
        up:            38, // up arrow
        down:          40, // down arrow

        togglePause:   charCode('P'),
        newGame:       charCode('N'),

        // development helpers
        kill:          charCode('K'),
        levelComplete: 107 // +
    };

    // reverse-lookup
    var keycodes = {};
    for (var k in keys) {
        if (keys.hasOwnProperty(k)) {
            keycodes[keys[k]] = k;
        }
    }

    function getKeyCode(e) {
        var k = e.which;
        if (!keycodes[k] || e.ctrlKey || e.metaKey) {
            return null;
        }
        e.preventDefault();
        return k;
    }

    var directions = {};
    directions[keys.up] = NORTH;
    directions[keys.down] = SOUTH;
    directions[keys.right] = EAST;
    directions[keys.left] = WEST;

    $(window).keydown(function (e) {
        var k = getKeyCode(e);
        if (!k) {
            return;
        }

        switch (k) {
        case keys.left:
        case keys.right:
        case keys.up:
        case keys.down:
            var pacman = getObject('pacman');
            if (pacman) {
                pacman.turning = directions[k];
            }
            break;
        case keys.togglePause:
            togglePause();
            break;
        case keys.newGame:
            newGame();
            break;
        case keys.kill:
            window.clearTimeout(timer);
            break;
        case keys.levelComplete:
            levelComplete();
            break;
        default:
            throw new Error('unhandled: ' + keycodes[k]);
        }
    });

    $(window).keyup(function (e) {
        var pacman = getObject('pacman');
        var k = getKeyCode(e);
        if (pacman && pacman.turning === directions[k]) {
            pacman.turning = null;
        }
    });
}

$(function () {
    var canvas = $('canvas').get(0);
    ctx = canvas.getContext('2d');
    ctx.scale(canvas.width / SCREEN_W, canvas.height / SCREEN_H);

    function drawProgress(proportion) {
        var g = ctx;
        g.save();
        g.fillStyle = 'black';
        g.fillRect(0, 0, SCREEN_W, SCREEN_H);

        var cx = SCREEN_W / 2;

        var percentage = new Text({
            txt: format('%.1n%', proportion * 100),
            colour: 'white',
            style: Text.STYLE_NORMAL,
            size: TILE_SIZE,
            align: 'center',
            x: cx,
            y: SCREEN_H / 3
        });
        percentage.repaint(g);

        Pacman.draw(g, cx, SCREEN_H / 2, SCREEN_W / 8, 0, proportion, false);

        g.restore();
    }

    function init() {
        // check for previous sound preference
        var soundsEnabled = getPref('sound.enabled') !== 'false';
        resources.enableSounds(soundsEnabled);

        var soundToggle = $('#enableSounds');
        soundToggle.attr('disabled', false);
        soundToggle.attr('checked', resources.soundsEnabled());
        soundToggle.click(function (e) {
            resources.enableSounds(this.checked);
            setPref('sound.enabled', this.checked);
        });

        initialisers.forEach(function (f) {
            f();
        });

        highscore = getPref('highscore') || 0;
        initKeyBindings();
        newGame();
    }

    ResourceManager.load({
        base: 'res',
        images: ['bg', 'bg-flash', 'blinky', 'pinky', 'inky',
                 'clyde', 'frightened', 'flashing', 'dead'],
        sounds: ['intro', 'tick0', 'tick1', 'tick2', 'tick3'],
        fonts: { stylesheet: 'fonts.css',
                 families: [Text.STYLE_FIXED_WIDTH] },

        onUpdate: drawProgress,
        onComplete: function (resourceManager) {
            resources = resourceManager;
            init();
        },
        onError: function (msg) {
            alert(msg);
            throw new Error(msg);
        }
    });
});
