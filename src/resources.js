/*
 * Resource loader and manager
 */

/*global $, Audio, Image, debug, format */

/// managers

function SoundManager(sounds) {
    this.sounds = sounds;
}

SoundManager.prototype = {

    sounds: {},
    playing: [],

    play: function (id) {
        var sound = this.sounds[id];
        var playing = this.playing;
        if (playing.indexOf(sound) !== -1) {
            // already playing; make a copy
            sound = sound.cloneNode(true);
        }
        playing.push(sound);
        $(sound).bind('ended', function () {
            playing.remove(sound);
        });
        sound.play();
    },

    togglePause: function (paused) {
        this.playing.forEach(function (sound) {
            if (paused) {
                sound.pause();
            } else {
                sound.play();
            }
        });
    }
};

function ResourceManager(images, sounds) {
    this.images = images;
    this.sounds = new SoundManager(sounds);
}

ResourceManager.prototype = {

    getImage: function (id) {
        return this.images[id];
    },

    playSound: function (id) {
        this.sounds.play(id);
    },

    togglePause: function (paused) {
        this.sounds.togglePause(paused);
    }
};

/// loader

function loadImage(id, path, onLoad, onError) {
    var img = new Image();
    img.onload = function () {
        debug('loaded image: %s', this.src);
        onLoad(img);
    };
    img.onerror = function () {
        debug('error loading image: %s', this.src);
        onError(this.src);
    };
    img.src = format('%s/%s.png', path, id);
}

function loadSound(id, path, onLoad, onError) {
    var aud = new Audio();
    // guard against multiple onloads in Firefox
    var loaded;
    $(aud).bind('canplaythrough', function () {
        if (!loaded) {
            loaded = true;
            debug('loaded audio: %s', this.src);
            onLoad(aud);
        }
    });
    // FIXME: error handler
    aud.src = format('%s/%s.ogg', path, id);
    aud.load();
}

// Load resources as specified. The `handler' object should specify:
//   base: base href of resources
//   images: array of image IDs to be loaded
//   sounds: array of sound IDs to be loaded
//   onUpdate: function that accepts the proportion of loaded resources (0.0 - 1.0)
//   onComplete: a function that accepts an initialised ResourceManager
//   onError: a function that accepts an error message
function loadResources(handler) {
    var base = handler.base.replace(/\/$/, ''),
        imageIds = handler.images || [],
        soundIds = handler.sounds || [];

    handler.onUpdate(0);

    var nTotal = imageIds.length + soundIds.length,
        nRemaining = nTotal,
        images = {},
        sounds = {};

    function makeOnload(id, collection) {
        return function (resource) {
            collection[id] = resource;
            --nRemaining;
            handler.onUpdate((nTotal - nRemaining) / nTotal);
            if (nRemaining === 0) {
                handler.onComplete(new ResourceManager(images, sounds));
            }
        };
    }

    var aborted;

    function makeOnError(id) {
        return function (src) {
            if (!aborted) {
                aborted = true;
                handler.onError(format('Unable to load resource %s (%s)', id, src));
            }
        };
    }

    imageIds.forEach(function (id) {
        loadImage(id, base, makeOnload(id, images), makeOnError(id));
    });
    soundIds.forEach(function (id) {
        loadSound(id, base, makeOnload(id, sounds), makeOnError(id));
    });
}
