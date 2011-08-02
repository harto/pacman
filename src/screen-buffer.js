/*
 * An off-screen graphics buffer.
 */

/*global $, DEBUG */

function ScreenBuffer(w, h) {
    var canvas = $('<canvas></canvas>').attr({ width: w, height: h });
    if (!DEBUG) {
        canvas.hide();
    }
    $('body').append(canvas);
    return canvas.get(0);
}
