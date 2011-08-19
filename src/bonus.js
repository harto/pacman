/*
 * Bonus/fruit
 */

/*global Entity, Maze, TILE_SIZE, objects, bind, debug, lookup, toTicks */

function Bonus(symbol, value) {
    // FIXME: do something with symbol
    this.symbol = symbol;
    this.w = this.h = TILE_SIZE;
    this.value = value;
}

Bonus.prototype = new Entity({

    repaint: function (g) {
        // FIXME
        g.save();
        g.fillStyle = 'white';
        g.fillRect(this.x, this.y, this.w, this.h);
        g.restore();
    },

    insert: function () {
        this.centreAt(Maze.BONUS_X, Maze.BONUS_Y);
        var secs = 9 + Math.random();
        debug('displaying bonus for %.3ns', secs);
        objects.set('bonus', this);
        this.timeout = lookup('events').delay(this, toTicks(secs), function () {
            debug('bonus timeout');
            objects.remove('bonus');
        });
    },

    remove: function () {
        objects.remove('bonus');
        lookup('events').cancel(this.timeout);
    },

    colliding: function (pacman) {
        return pacman.col === this.col && pacman.row === this.row ? this : null;
    }
});

Bonus.forLevel = function (level) {
    return level === 1 ? new Bonus('cherry', 100) :
           level === 2 ? new Bonus('strawberry', 300) :
           level <= 4 ? new Bonus('peach', 500) :
           level <= 6 ? new Bonus('apple', 700) :
           level <= 8 ? new Bonus('grape', 700) :
           level <= 10 ? new Bonus('galaxian', 2000) :
           level <= 12 ? new Bonus('bell', 3000) :
           new Bonus('key', 5000);
};
