/*
 * Resource loader
 */

/*global Audio, Image, $, debug, format */

function Loader(base) {
    this.base = base.replace(/\/?$/, '/');
    this.loaderFns = [];
}

Loader.prototype = {

    enqueueImage: function (name) {
        this.loaderFns.push(function (onLoad, onError) {
            var img = new Image();
            img.onload = function () {
                debug('loaded image: %s', this.src);
                onLoad(name, img);
            };
            img.onerror = function () {
                debug('error loading image: %s', this.src);
                onError(name, this.src);
            };
            img.src = this.base + name + '.png';
        });
    },

    enqueueSound: function (name) {
        this.loaderFns.push(function (onLoad, onError) {
            var aud = new Audio();
            var loaded;
            $(aud).bind('canplaythrough', function () {
                if (!loaded) {
                    debug('loaded audio: %s', this.src);
                    onLoad(name, aud);
                    loaded = true;
                }
            });
            aud.src = this.base + name + '.ogg';
            // FIXME: error handler
            aud.load();
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
            resources = {},
            aborted = false;

        this.loaderFns.forEach(function (loaderFn) {
            loaderFn.call(
                this,
                function (name, resource) {
                    resources[name] = resource;
                    --nRemaining;
                    handler.update((nResources - nRemaining) / nResources);
                    if (nRemaining === 0) {
                        handler.complete(resources);
                    }
                },
                function (name, src) {
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
