/*
 * Resource loader
 */

/*global alert, Image, $, debug */

var loader = {

    groups: [],

    enqueue: function (paths, onComplete) {
        this.groups.push(arguments);
    },

    load: function (handler) {
        handler.update(0);

        var nTotalPaths = this.groups.map(function (entry) {
            return entry[0].length;
        }).reduce(function (a, b) {
            return a + b;
        });
        var nTotalRemaining = nTotalPaths;
        var self = this;

        this.groups.forEach(function (entry) {
            var paths = entry[0],
                nGroupPathsRemaining = paths.length,
                onGroupComplete = entry[1],
                resources = {};

            paths.forEach(function (p) {
                self.loadResource(p, function (resource) {
                    resources[p] = resource;
                    if (--nGroupPathsRemaining === 0) {
                        onGroupComplete(resources);
                    }

                    --nTotalRemaining;
                    handler.update((nTotalPaths - nTotalRemaining) / nTotalPaths);
                    if (nTotalRemaining === 0) {
                        handler.complete();
                    }
                });
            });
        });
    },

    loadImage: function (path, onComplete, onError) {
        var img = new Image();
        img.onload = function () {
            debug('loaded %s', path);
            onComplete(img);
        };
        img.onerror = onError;
        img.src = path;
    },

    getLoader: function (path) {
        // FIXME: HTTP HEAD & MIME type?
        switch (path.replace(/^.+\.([^.]+)$/, '$1').toLowerCase()) {
        case 'png':
            return this.loadImage;
        default:
            return null;
        }
    },

    loadResource: function (path, onComplete, onError) {
        // FIXME
        path = 'res/' + path;
        debug('loading %s', path);
        var loader = this.getLoader(path);
        var self = this;
        loader(path, onComplete, onError || function () {
            if (!self.aborted) {
                self.aborted = true;
                alert('Failed to load resource: ' + path);
                throw new Error('Failed to load ' + path + ' - aborting');
            }
        });
    }
};
