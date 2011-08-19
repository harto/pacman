/*
 * The Pac-Man actor.
 */

/*jslint bitwise:false */
/*global Actor, EAST, Ghost, GraphicsBuffer, MAX_SPEED, Maze, NORTH, SOUTH,
  SpriteMap, TILE_CENTRE, TILE_SIZE, WEST, enqueueInitialiser, events, level,
  noop, ordinal, toDx, toDy, toTicks */

function Pacman() {
    this.direction = WEST;

    this.frameIndex = 0;
    this.frameInc = 1;

    this.w = this.h = Pacman.SIZE;
    this.centreAt(Maze.PACMAN_X, Maze.PACMAN_Y);

    this.z = 1;
}

// Draws a Pac-Man figure to the given context.
//  - g: graphics context
//  - x: centre x-coord
//  - y: centre y-coord
//  - radius: radius
//  - startAngle: angle at which mouth points
//  - proportion: proportion to draw [0, 1]
//  - offsetHinge: true to offset hinge toward back of head
Pacman.draw = function (g, x, y, radius, startAngle, proportion, offsetHinge) {
    if (!proportion) {
        return;
    }
    g.save();
    g.beginPath();
    // offset hinge towards back of head
    var centreOffset = offsetHinge ? radius / 4 : 0;
    var xOffset = (startAngle === 0 ? -1 :
                   startAngle === Math.PI ? 1 :
                   0) * centreOffset;
    var yOffset = (startAngle === Math.PI / 2 ? -1 :
                   startAngle === 3 * Math.PI / 2 ? 1 :
                   0) * centreOffset;
    g.moveTo(x + xOffset, y + yOffset);
    var start = startAngle || 0;
    var angle = Math.PI - proportion * Math.PI;
    g.arc(x, y, radius, start + angle, start + (angle === 0 ? 2 * Math.PI : -angle));
    g.moveTo(x + xOffset, y + yOffset);
    g.closePath();
    g.fillStyle = 'yellow';
    g.fill();
    g.restore();
};

Pacman.SIZE = Math.floor(1.5 * TILE_SIZE);

// Programmatically pre-render frames
enqueueInitialiser(function () {
    // Two sprite maps are produced: one for regular maze movement and one for
    // the death sequence. The animation runs faster during regular maze
    // movement (i.e. contains fewer frames) and only limits mouth angle to
    // 40% of the maximum.

    function createSpriteMap(steps, stepProportion) {
        var size = Pacman.SIZE,
            // iterate through directions in increasing-angle order
            directions = [EAST, SOUTH, WEST, NORTH],
            buf = new GraphicsBuffer(size * steps, size * directions.length),
            g = buf.getContext('2d'),
            radius = size / 2;

        directions.forEach(function (direction, row) {
            var startAngle = row * Math.PI / 2;
            //var stepProportion = minProportion / steps;
            var y = ordinal(direction) * size + radius;
            for (var col = 0; col < steps; col++) {
                Pacman.draw(g, col * size + radius, y, radius,
                            startAngle,
                            1 - col * stepProportion,
                            true);
            }
        });

        return new SpriteMap(buf, size, size);
    }

    var steps = toTicks(0.08);
    Pacman.SPRITES = createSpriteMap(steps, 0.4 / steps);
    steps = toTicks(1);
    Pacman.SPRITES_DYING = createSpriteMap(steps, 1 / steps);

    // TODO: create dead 'blink'
});

Pacman.prototype = new Actor({

    dotEaten: function (d) {
        // stub update() for duration of dot delay
        this.update = noop;
        events.delay(this, d.delay, function () {
            delete this.update;
        });
    },

    energiserEaten: function (e) {
        this.dotEaten(e);
    },

    repaint: function (g) {
        var self = this;
        function drawSprite(map, col) {
            map.draw(g, self.x, self.y, col, ordinal(self.direction));
        }

        if (this.dying) {
            var nFrames = Pacman.SPRITES_DYING.cols;
            if (this.deathTicks < nFrames) {
                drawSprite(Pacman.SPRITES_DYING, this.deathTicks);
            } else if (this.deathTicks < nFrames + toTicks(0.2)) {
                // hide momentarily
            }
        } else {
            drawSprite(Pacman.SPRITES, this.frameIndex);
        }
    },

    // replaces update on kill
    deathSequence: function () {
        if (this.deathTicks++ > Pacman.SPRITES_DYING.cols + toTicks(0.5)) {
            this.dead = true;
        }
        this.invalidate();
    },

    update: function () {
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
        var speed = this.calcSpeed();

        // cornering - centre on axis of movement
        var dx = toDx(direction) * speed;
        var dy = toDy(direction) * speed;
        if (toDx(direction)) {
            dy = (this.ly > TILE_CENTRE ? -1 : this.ly < TILE_CENTRE ? 1 : 0) * speed;
        } else if (toDy(direction)) {
            dx = (this.lx > TILE_CENTRE ? -1 : this.lx < TILE_CENTRE ? 1 : 0) * speed;
        }

        var move = this.calcMove(dx, dy);

        // Move in the given direction iff before tile centrepoint or
        // an adjacent tile lies beyond.
        if (this.movesPastTileCentre(move, direction) &&
            !(direction & Maze.exitsFrom(this.col, this.row))) {
            return false;
        }

        this.applyMove(move);
        // update animation cycle
        this.frameIndex += this.frameInc;
        if (this.frameIndex === 0 || this.frameIndex === Pacman.SPRITES.cols - 1) {
            this.frameInc *= -1;
        }
        return true;
    },

    kill: function () {
        this.dying = true;
        this.deathTicks = 0;
        this.update = this.deathSequence;
    },

    toString: function () {
        return 'pacman';
    }
});
