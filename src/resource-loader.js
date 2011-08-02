/*
 * Resource loader
 */

/*global Audio, Image, ResourceManager, debug, format */

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
