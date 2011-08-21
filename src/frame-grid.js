/*
 * A graphics buffer containing a grid of equally-sized frames that may be
 * addressed by row and column index.
 */

function FrameGrid(img, fw, fh) {
    this.img = img;
    this.fw = fw;
    this.fh = fh;
    this.cols = img.width / fw;
    this.rows = img.height / fh;
}

FrameGrid.prototype.draw = function (g, x, y, col, row) {
    var w = this.fw, h = this.fh;
    g.drawImage(this.img, col * w, row * h, w, h, x, y, w, h);
};
