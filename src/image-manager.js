/*
 * Image manager
 */

/*global Image, debug, format */

function ImageManager(imgs) {
    this.imgs = imgs;
}

ImageManager.load = function (id, path, onLoad, onError) {
    var img = new Image();
    img.onload = function () {
        debug('loaded image: %s', this.src);
        onLoad(img);
    };
    img.onerror = function () {
        onError(format('Error loading image: %s', this.src));
    };
    img.src = format('%s/%s.png', path, id);
};

ImageManager.prototype = {

    get: function (id) {
        return this.imgs[id];
    }
};
