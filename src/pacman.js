/*
 * The Pac-Man actor.
 */

/*jslint bitwise:false */
/*global Actor, EAST, Ghost, GraphicsBuffer, MAX_SPEED, Maze, NORTH, SOUTH,
  SpriteMap, TILE_CENTRE, TILE_SIZE, WEST, bind, enqueueInitialiser, level,
  lookup, noop, ordinal, toDx, toDy */

function Pacman() {
    this.direction = WEST;

    this.frameIndex = 0;
    this.animStepInc = 1;

    this.w = this.h = Pacman.SIZE;
    this.centreAt(Maze.PACMAN_X, Maze.PACMAN_Y);

    this.z = 1;
}

// Draws a Pac-Man figure to the given context.
//  - g: graphics context
//  - x: centre x-coord
//  - y: centre y-coord
//  - radius: radius
//  - fraction: proportion to draw [0, 1]
//  - startAngle: angle at which mouth points
//  - offsetHinge: true to offset hinge toward back of head
Pacman.draw = function (g, x, y, radius, fraction, startAngle, offsetHinge) {
    g.save();
    g.beginPath();
    // offset hinge towards back of head
    var centreOffset = radius / 5;
    var xOffset = (startAngle === 0 ? -1 :
                   startAngle === Math.PI ? 1 :
                   0) * centreOffset;
    var yOffset = (startAngle === Math.PI / 2 ? -1 :
                   startAngle === 3 * Math.PI / 2 ? 1 :
                   0) * centreOffset;
    g.moveTo(x + xOffset, y + yOffset);
    var start = startAngle || 0;
    var angle = Math.PI - fraction * Math.PI;
    g.arc(x, y, radius, start + angle, start + (angle === 0 ? 2 * Math.PI : -angle));
    g.moveTo(x + xOffset, y + yOffset);
    g.closePath();
    g.fillStyle = 'yellow';
    g.fill();
    g.restore();
};

Pacman.SIZE = Math.floor(1.5 * TILE_SIZE);
Pacman.ANIM_STEPS = 12;
Pacman.MAX_ANIM_STEP = Math.floor(Pacman.ANIM_STEPS * 1 / 3);

// programmatically pre-render frames
enqueueInitialiser(function () {
    var w = Pacman.SIZE,
        h = Pacman.SIZE,
        // iterate through directions in increasing-degrees order
        directions = [EAST, SOUTH, WEST, NORTH],
        steps = Pacman.ANIM_STEPS,
        buf = new GraphicsBuffer(w * steps, h * directions.length),
        g = buf.getContext('2d'),
        radius = w / 2,
        direction, angle, startAngle, x, y, col, row;
    for (row = 0; row < directions.length; row++) {
        direction = directions[row];
        startAngle = row * Math.PI / 2;
        y = ordinal(direction) * h + radius;
        for (col = 0; col < steps; col++) {
            Pacman.draw(g, col * w + radius, y, radius,
                        (steps - col) / steps, startAngle, true);
        }
    }
    Pacman.SPRITES = new SpriteMap(buf, w, h);
});

Pacman.prototype = new Actor({

    dotEaten: function (d) {
        // stub update() for duration of dot delay
        this.update = noop;
        lookup('events').delay(d.delay, bind(this, function () {
            delete this.update;
        }));
    },

    energiserEaten: function (e) {
        this.dotEaten(e);
    },

    repaint: function (g) {
        Pacman.SPRITES.draw(g, this.x, this.y, this.frameIndex, ordinal(this.direction));
    },

    update: function () {
        if (this.dying) {
            // TODO: death sequence
            this.dead = true;
            return;
        }

        var newDirection = this.turning || this.direction;
        if (this.move(newDirection)) {
            this.direction = newDirection;
        } else if (this.direction !== newDirection) {
            this.move(this.direction);
        }
    },

    calcSpeed: function () {
        var frightened = Ghost.all(Ghost.STATE_FRIGHTENED).length;
        return (frightened ? (level === 1 ? 0.9 :
                              level < 5 ? 0.95 :
                              1) :
                             (level === 1 ? 0.8 :
                              level < 5 || level > 20 ? 0.9 :
                              1)) * MAX_SPEED;
    },

    move: function (direction) {
        var dx = 0,
            dy = 0,
            lx = this.lx,
            ly = this.ly,
            speed = this.calcSpeed();

        // Move in the given direction iff before tile centrepoint or
        // an adjacent tile lies beyond.
        //
        // FIXME: consider accumulated sub-pixel movement

        dx = toDx(direction) * speed;
        dy = toDy(direction) * speed;

        if (Actor.exitingTile(direction, lx + dx, ly + dy) &&
            !(direction & Maze.exitsFrom(this.col, this.row))) {
            return false;
        }

        // cornering
        if (dx) {
            dy = (ly > TILE_CENTRE ? -1 : ly < TILE_CENTRE ? 1 : 0) * speed;
        } else if (dy) {
            dx = (lx > TILE_CENTRE ? -1 : lx < TILE_CENTRE ? 1 : 0) * speed;
        }

        this.moveBy(dx, dy);
        // update animation cycle
        this.frameIndex += this.animStepInc;
        if (this.frameIndex === 0 || this.frameIndex === Pacman.MAX_ANIM_STEP) {
            this.animStepInc *= -1;
        }
        return true;
    },

    kill: function () {
        this.dead = true;
    },

    toString: function () {
        return 'pacman';
    }
});
