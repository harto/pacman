/*
 * Gutter panel displaying remaining number of lives
 */

/*global Entity, Pacman, SCREEN_H, GraphicsBuffer, TILE_SIZE, enqueueInitialiser */

function LifeDisplay(lives) {
    this.setLives(lives);
}

LifeDisplay.GRID_SIZE = 2 * TILE_SIZE;
LifeDisplay.ICON_SIZE = Math.floor(1.4 * TILE_SIZE);

LifeDisplay.prototype = new Entity({

    setLives: function (lives) {
        this.invalidate();

        this.lives = lives;

        var gridSize = LifeDisplay.GRID_SIZE;
        this.x = TILE_SIZE * 2;
        this.y = SCREEN_H - gridSize;
        this.w = gridSize * lives;
        this.h = gridSize;
    },

    repaint: function (g) {
        g.save();

        var iconSize = LifeDisplay.ICON_SIZE,
            gridSize = LifeDisplay.GRID_SIZE,
            lives = this.lives,
            x,
            y = this.y + gridSize / 2 - iconSize / 2;
        for (var i = 0; i < lives; i++) {
            x = this.x + i * gridSize + gridSize / 2 - iconSize / 2;
            g.drawImage(LifeDisplay.ICON,
                        0, 0, iconSize, iconSize,
                        x, y, iconSize, iconSize);
        }

        g.restore();
    }
});

enqueueInitialiser(function () {
    var size = LifeDisplay.ICON_SIZE;
    var icon = new GraphicsBuffer(size, size);
    var r = size / 2;
    Pacman.draw(icon.getContext('2d'), r, r, r, Math.PI, 0.8, true);
    LifeDisplay.ICON = icon;
});
