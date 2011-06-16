/*
 * Resource loader
 */

/*global Audio, Image, $, debug, format */

function Loader(base) {
    this.base = base.replace(/\/?$/, '/');
    this.loaderFns = [];
}

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
    img.src = path + id + '.png';
}

function loadSound(id, path, onLoad, onError) {
    var aud = new Audio();
    // guard against multiple loads, which appears to happen in Firefox
    var loaded;
    $(aud).bind('canplaythrough', function () {
        if (!loaded) {
            loaded = true;
            debug('loaded audio: %s', this.src);
            onLoad(aud);
        }
    });
    // FIXME: error handler
    aud.src = path + id + '.ogg';
    aud.load();
}

Loader.prototype = {

    enqueueImage: function (name) {
        var path = this.base;
        this.loaderFns.push(function (onLoad, onError) {
            loadImage(
                name,
                path,
                function (image) {
                    onLoad(name, image, 'image');
                },
                onError);
        });
    },

    enqueueSound: function (name) {
        var path = this.base;
        this.loaderFns.push(function (onLoad, onError) {
            loadSound(
                name,
                path,
                function (sound) {
                    onLoad(name, sound, 'sound');
                },
                onError);
        });
    },

    enqueueMultiple: function (enqueueFn, names) {
        Array.prototype.forEach.call(names, function (name) {
            enqueueFn.call(this, name);
        }, this);
    },

    enqueueImages: function (/*names...*/) {
        this.enqueueMultiple(this.enqueueImage, arguments);
    },

    enqueueSounds: function (/*names...*/) {
        this.enqueueMultiple(this.enqueueSound, arguments);
    },

    load: function (handler) {
        handler.update(0);

        var nResources = this.loaderFns.length,
            nRemaining = nResources,
            resources = {
                images: {},
                sounds: {}
            },
            aborted = false;

        this.loaderFns.forEach(function (loaderFn) {
            loaderFn.call(
                this,
                function onLoad(name, resource, type) {
                    resources[type + 's'][name] = resource;
                    --nRemaining;
                    handler.update((nResources - nRemaining) / nResources);
                    if (nRemaining === 0) {
                        handler.complete(resources);
                    }
                },
                function onError(name, src) {
                    if (!aborted) {
                        aborted = true;
                        handler.error(format('Unable to load resource: %s (%s)',
                                             name, src));
                    }
                }
            );
        }, this);
    }
};
