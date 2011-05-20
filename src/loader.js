/*
 * Resource loader
 */

/*global $ */

var loader = {

    paths: [],

    enqueue: function (/*paths...*/) {
        this.paths.push.apply(this.paths, arguments);
    },

    load: function (handler) {
        var inc = 100 / this.paths.length;
        var completed = 0;
        this.paths.forEach(function (path) {
            
        });
    }
};
