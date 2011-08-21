/*
 * An object that can be updated and which manages its own events.
 */

/*global Delay, assert, bind, copy, noop */

function Entity(props) {
    copy(props, this);
}

Entity.prototype = {

    delayEvent: function (ticks, fn, repeats) {
        assert(ticks > 0);
        assert(fn instanceof Function);
        assert(repeats === undefined || repeats > 0);

        var self = this;
        var event = new Delay(ticks, function () {
            fn.call(self);
            if (repeats === undefined || --repeats === 0) {
                self.cancelEvent(event);
            } else {
                event.reset();
            }
        });

        if (!this._events) {
            this._events = [];
        }
        this._events.push(event);
        return event;
    },

    repeatEvent: function (ticks, fn, repeats) {
        return this.delayEvent(ticks, fn, repeats || Infinity);
    },

    cancelEvent: function (event) {
        if (event) {
            this._events.remove(event);
        }
    },

    wait: function (ticks) {
        this._wait = new Delay(ticks || Infinity, bind(this, function () {
            this.resume();
        }));
    },

    resume: function () {
        delete this._wait;
    },

    update: function () {
        if (this._wait) {
            this._wait.update();
        }

        // check again; might be time to resume
        if (!this._wait) {
            this.doUpdate();
            if (this._events) {
                this._events.forEach(function (event) {
                    event.update();
                });
            }
        }
    },

    doUpdate: noop
};
