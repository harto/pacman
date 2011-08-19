/*
 * Manages one-off and repeating events. Each event is associated with an entity
 * such that removing that entity will clear its events. The top-level event
 * manager is the global variable `events'.
 */

/*global Delay, assert, values */

function EventManager() {
    this._reset();
}

EventManager.prototype = {

    _reset: function () {
        this.events = {};
        this.nextEventId = 0;
    },

    // Associates a delayed fn with src that executes after given number of
    // ticks. An optional number of repeats may be provided. The source object
    // is `this' when the function is executed.
    delay: function (src, ticks, fn, repeats) {
        assert(src);
        assert(ticks);
        assert(fn instanceof Function);

        var id = this.nextEventId++;
        var manager = this;
        var event = new Delay(ticks, function () {
            fn.call(src);
            if (this._repeats === undefined || --this._repeats === 0) {
                manager.cancel(id);
            } else {
                this.reset();
            }
        });
        event._repeats = repeats;
        event._running = true;
        event._src = src;

        this.events[id] = event;
        return id;
    },

    repeat: function (src, ticks, fn, repeats) {
        return this.delay(src, ticks, fn, repeats || Infinity);
    },

    reset: function (eventId) {
        this.events[eventId].reset();
    },

    _eventIds: function (src) {
        var events = this.events;
        return keys(events).filter(function (id) {
            return events[id]._src === src;
        });
    },

    // Suspends an event and optionally resumes after elapsed ticks
    suspend: function (eventId, ticks) {
        this.events[eventId]._running = false;
        if (ticks) {
            this.delay(this, ticks, function () {
                this.resume(eventId);
            });
        }
    },

    suspendAll: function (src, ticks) {
        this._eventIds(src).forEach(function (eventId) {
            this.suspend(eventId, ticks);
        }, this);
    },

    resume: function (eventId) {
        this.events[eventId]._running = true;
    },

    resumeAll: function (src) {
        this._eventIds(src).forEach(this.resume, this);
    },

    cancel: function (eventId) {
        delete this.events[eventId];
    },

    cancelAll: function (src) {
        if (src) {
            this._eventIds(src).forEach(this.cancel, this);
        } else {
            this._reset();
        }
    },

    update: function () {
        values(this.events).filter(function (event) {
            return event._running;
        }).forEach(function (event) {
            event.update();
        });
    }
};
