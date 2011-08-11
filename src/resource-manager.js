/*
 * Top-level resource manager
 */

/*global ImageManager, SoundManager, format */

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
//   onUpdate: function that accepts the proportion of loaded resources (0.0 - 1.0)
//   onComplete: a function that accepts an initialised ResourceManager
//   onError: a function that accepts an error message
ResourceManager.load = function (props) {
    var base = props.base.replace(/\/$/, ''),
        imageIds = props.images || [],
        soundIds = props.sounds || [];

    props.onUpdate(0);

    var nTotal = imageIds.length + soundIds.length,
        nRemaining = nTotal,
        images = {},
        sounds = {};

    function makeOnload(id, collection) {
        return function (resource) {
            collection[id] = resource;
            --nRemaining;
            props.onUpdate((nTotal - nRemaining) / nTotal);
            if (nRemaining === 0) {
                props.onComplete(new ResourceManager(new ImageManager(images),
                                                     new SoundManager(sounds)));
            }
        };
    }

    var aborted;

    function makeOnError(id) {
        return function (msg) {
            if (!aborted) {
                aborted = true;
                props.onError(format('Unable to load resource: %s\n%s', id, msg));
            }
        };
    }

    imageIds.forEach(function (id) {
        ImageManager.load(id, base, makeOnload(id, images), makeOnError(id));
    });
    soundIds.forEach(function (id) {
        SoundManager.load(id, base, makeOnload(id, sounds), makeOnError(id));
    });
};

