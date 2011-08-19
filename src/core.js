/*
 * Base classes, constants, globals and utility functions.
 */

/*jslint bitwise: false */
/*global console, dispatch, format */

var SCALE = 2,

    TILE_SIZE = 8 * SCALE,
    TILE_CENTRE = TILE_SIZE / 2,
    COLS = 28,
    ROWS = 36,
    UPDATE_HZ = 60,

    SCREEN_W = COLS * TILE_SIZE,
    SCREEN_H = ROWS * TILE_SIZE,

    MAX_SPEED = SCALE,

    DEBUG = true,

    NORTH = 1 << 0,
    SOUTH = 1 << 1,
    EAST =  1 << 2,
    WEST =  1 << 3,

    // forward declarations

    objects,   // top-level entity group
    events,    // event manager
    resources, // resource manager
    lives,
    level;

/// miscellany

function toCol(x) {
    return Math.floor(x / TILE_SIZE);
}

var toRow = toCol;

function toDx(direction) {
    return direction === WEST ? -1 : direction === EAST ? 1 : 0;
}

function toDy(direction) {
    return direction === NORTH ? -1 : direction === SOUTH ? 1 : 0;
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function reverse(direction) {
    return direction === NORTH ? SOUTH :
           direction === SOUTH ? NORTH :
           direction === EAST ? WEST :
           EAST;
}

function toTicks(seconds) {
    return Math.round(seconds * UPDATE_HZ);
}

function toSeconds(ticks) {
    return ticks / UPDATE_HZ;
}

// Returns the ordinal of constants defined as increasing powers of 2.
function ordinal(constant) {
    return Math.log(constant) / Math.log(2);
}

function debug(/*msg, args*/) {
    if (DEBUG) {
        console.log(format.apply(this, arguments));
    }
}

function insert(id, o) {
    objects.set(id, o);
}

function lookup(id) {
    return objects.get(id);
}

function suspend(id) {
    objects.suspend(id);
    events.suspendAll(lookup(id));
}

function resume(id) {
    objects.resume(id);
    events.resumeAll(lookup(id));
}

function remove(id) {
    var o = objects.remove(id);
    if (o) {
        events.cancelAll(o);
    }
}

function broadcast(event, args) {
    return dispatch(objects, event, args);
}

function invalidateRegion(x, y, w, h) {
    broadcast('invalidateRegion', [x, y, w, h]);
}

// once-off initialisation

var initialisers = [];

function enqueueInitialiser(f) {
    initialisers.push(f);
}
