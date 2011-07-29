/*
 * Resource loader and manager
 */

/*global Audio, Image, debug, format, keys, values */

/// managers

function SoundManager(sounds) {
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

/// loader

function loadImage(id, path, onLoad, onError) {
    var img = new Image();
    img.onload = function () {
        debug('loaded image: %s', this.src);
        onLoad(img);
    };
    img.onerror = function () {
        onError(format('Error loading image: %s', this.src));
    };
    img.src = format('%s/%s.png', path, id);
}

function loadSound(id, path, onLoad, onError) {
    var aud = new Audio();
    // guard against multiple onloads events
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
        return function (msg) {
            if (!aborted) {
                aborted = true;
                handler.onError(format('Unable to load resource: %s\n%s', id, msg));
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
