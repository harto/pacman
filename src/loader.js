/*
 * Resource loader
 */

/*global alert, Image, $, debug */

function Loader() {
    this.loaderFns = [];
}

Loader.prototype = {

    enqueueImage: function (name) {
        this.loaderFns.push(function (onLoad, onError) {
            var img = new Image();
            img.onload = function () {
                onLoad(name, img);
            };
            img.onerror = function () {
                onError(name);
            };
            img.src = 'res/' + name + '.png';
        });
    },

    enqueueSound: function (name) {
        // XXX
        this.loaderFns.push(function (onLoad, onError) {
            var aud = new Audio();
            $(aud).bind('canplaythrough', function () {
                onLoad(name, aud);
            });
            aud.src = 'res/' + name + '.ogg';
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
            loaderFn(
                function (name, resource) {
                    resources[name] = resource;
                    --nRemaining;
                    handler.update((nResources - nRemaining) / nResources);
                    if (nRemaining === 0) {
                        handler.complete(resources);
                    }
                },
                function (name) {
                    if (!aborted) {
                        aborted = true;
                        handler.error('Unable to load resource: ' + name);
                    }
                }
            );
        });
    }
};
