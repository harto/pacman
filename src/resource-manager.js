/*
 * Top-level resource manager.
 */

/*global SoundManager */

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
