/*
 * An off-screen graphics buffer.
 */

/*global $, DEBUG */

function GraphicsBuffer(w, h) {
    var canvas = $('<canvas></canvas>').attr({ width: w, height: h });
    if (!DEBUG) {
        canvas.hide();
    }
    $('body').append(canvas);
    return canvas.get(0);
}
