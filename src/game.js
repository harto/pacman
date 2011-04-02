/*
 * An HTML5 Pac-Man clone.
 * https://www.github.com/harto/pacman
 *
 * Based on the game as described by The Pac-Man Dossier
 * (http://home.comcast.net/~jpittman2/pacman/pacmandossier.html)
 *
 * Requires: jQuery 1.4.2
 */

/*global $, window, Image,
         SCREEN_W, SCREEN_H, UPDATE_HZ, TEXT_HEIGHT, DEBUG, TILE_SIZE,
         NORTH, SOUTH, EAST, WEST,
         invalidateRegion, invalidateScreen, invalidated: true,
         debug, format, lives: true, level: true,
         Ghost, Maze, Energiser, pacman, blinky, inky, pinky, clyde */

var scoreboard = {
    x: 6 * TILE_SIZE,
    y: TILE_SIZE,
    w: 0, // updated when score changes
    h: TEXT_HEIGHT,

    update: function () {
        if (this.prevScore !== this.score) {
            this.invalidated = true;
            invalidateRegion(this.x, this.y, this.w, this.h);
        }
        this.prevScore = this.score;
    },

    repaint: function (g) {
        if (this.invalidated) {
            this.invalidated = false;
            g.save();
            g.fillStyle = 'white';
            g.textAlign = 'left';
            g.textBaseline = 'top';
            g.setFontSize(TEXT_HEIGHT);
            // track width to allow invalidation on next update
            this.w = g.measureText(this.score).width;
            g.fillText(this.score, this.x, this.y);
            g.restore();
        }
    }
};

var entities = [Maze, scoreboard, pacman, blinky, pinky, inky, clyde],
    ctx,

    // game states
    STATE_STARTING = 'STARTING',
    STATE_RUNNING  = 'RUNNING',
    STATE_LEVELUP  = 'LEVELUP',
    STATE_DEAD     = 'DEAD',
    STATE_REVIVING = 'REVIVING',
    STATE_FINISHED = 'FINISHED',

    state,
    paused;

var stats = {
    UPDATE_INTERVAL_MS: 1000,

    nFrames: 0,
    totalFrameTime: 0,
    totalInvalidated: 0,
    prevUpdate: new Date().getTime(),

    repaint: function () {},

    update: function () {
        var now = new Date().getTime();
        if (now - this.prevUpdate >= this.UPDATE_INTERVAL_MS) {
            this.prevUpdate = now;

            var fps = this.nFrames;
            this.nFrames = 0;

            var avgFrameTime = this.totalFrameTime / fps;
            this.totalFrameTime = 0;

            var avgInvalidated = this.totalInvalidated / fps;
            this.totalInvalidated = 0;

            var title = $('title');
            title.html(title.html().replace(
                / \[.+|$/,
                format(' [fps: %s, avgFrameTime: %3.2fms, avgInvalidated: %3.2f]',
                       fps, avgFrameTime, avgInvalidated)));
        } else {
            ++this.nFrames;
        }
    }
};

if (DEBUG) {
    entities.push(stats);
}

function drawText(g, txt, x, y) {
    var padding = 2;
    var height = TEXT_HEIGHT / 2;
    g.save();
    g.setFontSize(height);
    g.fillStyle = 'black';
    g.fillRect(x, y, g.measureText(txt).width + 2 * padding, height + 2 * padding);
    g.fillStyle = 'white';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText(txt, x + padding, y + padding);
    g.restore();
}

function draw() {
    stats.totalInvalidated += invalidated.length;
    entities.forEach(function (e) {
        e.repaint(ctx, invalidated);
    });
    invalidated = [];

    if (paused || state === STATE_FINISHED) {
        // FIXME
        var text = paused ? '<Paused>' : 'Press <N> to restart';
        var padding = TEXT_HEIGHT / 2;
        var w = ctx.measureText(text).width + 2 * padding;
        var h = TEXT_HEIGHT + 2 * padding;
        var x = (SCREEN_W - w) / 2;
        var y = (SCREEN_H - h) / 1.5;

        ctx.fillStyle = 'white';
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';
        ctx.verticalAlign = 'top';
        ctx.fillText(text, x + padding, y + padding);
    }
}

function levelUp() {
    ++level;
    Maze.reset();
    pacman.reset();
    pacman.speed = (level === 1 ? 0.8 :
                    level < 5 || level > 20 ? 0.9 :
                    1);
    Ghost.resetAll();
    invalidateScreen();
}

var actors = Ghost.all.concat(pacman);

function update() {
    if (state === STATE_RUNNING) {
        entities.forEach(function (e) {
            e.update();
        });

        // collision check dots, fruit
        var dot = Maze.dotAt(pacman.col, pacman.row);
        if (dot) {
            scoreboard.score += dot.value;
            Maze.remove(dot);
            pacman.eat(dot);
            Ghost.decrementDotCounter();
            if (dot instanceof Energiser) {
                Ghost.frightenAll();
            }
        }

        var dead;

        // collision check ghosts
        Ghost.living().filter(function (g) {
            return g.col === pacman.col && g.row === pacman.row;
        }).forEach(function (g) {
            if (g.killable()) {
                g.kill();
            } else {
                //dead = true;
            }
        });

        Ghost.maybeRelease();
        Ghost.maybeUpdateMode();

        if (dead) {
            state = STATE_DEAD;
        } else if (Maze.isEmpty()) {
            state = STATE_LEVELUP;
        }
    } else if (state === STATE_LEVELUP) {
        // FIXME: delay
        levelUp();
        state = STATE_RUNNING;
    // } else if (state === State.REINSERT) {
    //     if (new Date() - timeOfDeath >= Ball.REINSERT_DELAY) {
    //         ball.reset();
    //         state = State.RUNNING;
    //     }
    }
}

var UPDATE_DELAY = 1000 / UPDATE_HZ,
    timer,
    lastLoopTime = new Date(),
    frameCount = 0,
    lastFrameTime = new Date();

function loop() {
    var now = new Date();

    if (!paused) {
        update();
    }
    draw();

    var elapsed = new Date() - now;
    stats.totalFrameTime += elapsed;
    if (state !== STATE_FINISHED) {
        timer = window.setTimeout(loop, Math.max(0, UPDATE_DELAY - elapsed));
    }
}

/// initialisation

function newGame() {
    window.clearTimeout(timer);

    scoreboard.score = 0;
    level = 0;
    lives = 2;
    state = STATE_RUNNING;
    paused = false;

    levelUp();

    loop();
}

function togglePause() {
    paused = !paused;
    if (!paused) {
        invalidateScreen();
    }
}

$(function () {
    var canvas = $('canvas').get(0);

    ctx = canvas.getContext('2d');

    ctx.scale(canvas.width / SCREEN_W, canvas.height / SCREEN_H);
    ctx.setFontSize = function (size) {
        ctx.font = 'bold ' + size + 'px Helvetica, Arial, sans-serif';
    };
    ctx.setFontSize(TEXT_HEIGHT);

    function charCode(c) {
        return c.charCodeAt(0);
    }

    var keys = {
        left:        37, // left arrow
        right:       39, // right arrow
        up:          38, // up arrow
        down:        40, // down arrow

        togglePause: charCode('P'),
        newGame:     charCode('N'),
        kill:        charCode('K')
    };

    // reverse-lookup
    var keycodes = {};
    for (var k in keys) {
        if (keys.hasOwnProperty(k)) {
            keycodes[keys[k]] = k;
        }
    }

    function getKeyCode(e) {
        var k = e.which;
        if (!keycodes[k] || e.ctrlKey || e.metaKey) {
            return null;
        }
        e.preventDefault();
        return k;
    }

    var directions = {};
    directions[keys.up] = NORTH;
    directions[keys.down] = SOUTH;
    directions[keys.right] = EAST;
    directions[keys.left] = WEST;

    $(window).keydown(function (e) {
        var k = getKeyCode(e);
        if (!k) {
            return;
        }

        switch (k) {
        case keys.left:
        case keys.right:
        case keys.up:
        case keys.down:
            pacman.turning = directions[k];
            break;
        case keys.togglePause:
            togglePause();
            break;
        case keys.newGame:
            newGame();
            break;
        case keys.kill:
            window.clearTimeout(timer);
            break;
        default:
            throw new Error('unhandled: ' + keycodes[k]);
        }
    });

    $(window).keyup(function (e) {
        var k = getKeyCode(e);
        if (pacman.turning === directions[k]) {
            pacman.turning = null;
        }
    });

    // FIXME: include error handling, progress bar
    var img = new Image();
    img.onload = function () {
        Maze.loaded(img);
        newGame();
    };
    img.src = 'res/' + Maze.img;
});

