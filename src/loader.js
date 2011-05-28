/*
 * Resource loader
 */

/*global alert, Image, $, debug */

var loader = {

    groups: [],

    enqueue: function (path, onLoad) {
        this.enqueueGroup([path], function (resources) {
            onLoad(resources[path]);
        });
    },

    enqueueGroup: function (paths, onLoad) {
        this.groups.push({ paths: paths, onLoad: onLoad });
    },

    load: function (handler) {
        handler.update(0);

        var nTotalPaths = this.groups.map(function (group) {
            return group.paths.length;
        }).reduce(function (a, b) {
            return a + b;
        });
        var nTotalRemaining = nTotalPaths;
        var self = this;

        this.groups.forEach(function (group) {
            var nGroupPathsRemaining = group.paths.length,
                resources = {};

            group.paths.forEach(function (p) {
                self.loadResource(p, function (resource) {
                    resources[p] = resource;
                    if (--nGroupPathsRemaining === 0) {
                        group.onLoad(resources);
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

    loadImage: function (path, onLoad, onError) {
        var img = new Image();
        img.onload = function () {
            debug('loaded %s', path);
            onLoad(img);
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

    loadResource: function (path, onLoad, onError) {
        // FIXME
        path = 'res/' + path;
        debug('loading %s', path);
        var loader = this.getLoader(path);
        var self = this;
        loader(path, onLoad, onError || function () {
            if (!self.aborted) {
                self.aborted = true;
                alert('Failed to load resource: ' + path);
                throw new Error('Failed to load ' + path + ' - aborting');
            }
        });
    }
};
