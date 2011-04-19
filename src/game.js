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
         NORTH, SOUTH, EAST, WEST, invalidated: true, debug, format,
         invalidateRegion, invalidateScreen, eventRaise, eventSubscribe,
         lives: true, level: true, Ghost, maze, Energiser, Bonus, bonusDisplay,
         pacman, ghosts */

var scoreboard = {
    x: 6 * TILE_SIZE,
    y: TILE_SIZE,
    w: 0, // updated when score changes
    h: TEXT_HEIGHT,

    update: function () {},

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
    },

    objectEaten: function (o) {
        this.score += o.value;
        invalidateRegion(this.x, this.y, this.w, this.h);
        this.invalidated = true;
    }
};
scoreboard.dotEaten = scoreboard.objectEaten;
scoreboard.energiserEaten = scoreboard.objectEaten;
scoreboard.bonusEaten = scoreboard.objectEaten;
eventSubscribe(scoreboard);

var stats = {
    UPDATE_INTERVAL_MS: 1000,

    nFrames: 0,
    totalFrameTime: 0,
    totalInvalidated: 0,
    prevUpdate: new Date().getTime(),

    init: function () {
        this.panel = $('<pre id="stats"></pre>');
        $('#cruft').append(this.panel);
        this.inited = true;
    },

    display: function (fps, avgFrameTime, avgInvalidated) {
        this.panel.html(format('fps: %s\n' +
                               'avgFrameTime: %3.2fms\n' +
                               'avgInvalidated: %3.2f',
                               fps, avgFrameTime, avgInvalidated));
    },

    repaint: function () {},

    update: function () {
        var now = new Date().getTime();
        if (now - this.prevUpdate >= this.UPDATE_INTERVAL_MS) {
            if (!this.inited) {
                this.init();
            }
            this.prevUpdate = now;

            var fps = this.nFrames;
            this.nFrames = 0;

            var avgFrameTime = this.totalFrameTime / fps;
            this.totalFrameTime = 0;

            var avgInvalidated = this.totalInvalidated / fps;
            this.totalInvalidated = 0;

            this.display(fps, avgFrameTime, avgInvalidated);
        } else {
            ++this.nFrames;
        }
    }
};

var entities = [maze, scoreboard, bonusDisplay, pacman];
entities.push.apply(entities, ghosts.all);
if (DEBUG) {
    entities.push(stats);
}

function resetActors() {
    pacman.reset();
    ghosts.reset();
    invalidateScreen();
}

function levelUp() {
    ++level;
    debug('starting level %s', level);
    maze.reset();
    pacman.speed = (level === 1 ? 0.8 :
                    level < 5 || level > 20 ? 0.9 :
                    1);
    bonusDisplay.add(Bonus.forLevel(level));
    resetActors();
}

var state, paused;

function update() {
    if (!paused) {
        state();
    }
}

function enterState(s) {
    state = s;
}

var State = {

    STARTING: function () {
        // TODO: music etc
        enterState(State.RUNNING);
    },

    RUNNING: function () {
        entities.forEach(function (e) {
            e.update();
        });

        ghosts.maybeReleaseOne();
        ghosts.maybeUpdateMode();

        // collision check edibles
        var dot = maze.dotAt(pacman.col, pacman.row);
        if (dot) {
            raiseEvent(dot instanceof Energiser ? 'energiserEaten' : 'dotEaten', dot);
            // if (maze.nDots === 74 || maze.nDots === 174) {
            //     entities.push(Bonus.forLevel(level));
            // }
        }

        // collision check ghosts
        ghosts.all.filter(function (g) {
            return !g.is(Ghost.STATE_DEAD) &&
                   g.col === pacman.col &&
                   g.row === pacman.row;
        }).forEach(function (g) {
            (g.is(Ghost.STATE_FRIGHTENED) ? g : pacman).kill();
        });

        if (maze.nDots === 0) {
            enterState(State.LEVELUP);
        } else if (pacman.dying) {
            enterState(State.DYING);
        }
    },

    LEVELUP: function () {
        // FIXME: flashing maze, delay
        levelUp();
        enterState(State.RUNNING);
    },

    DYING: function () {
        if (!pacman.dead) {
            // continue dying
            // FIXME: separate method on pacman?
            pacman.update();
        } else {
            if (--lives) {
                resetActors();
                ghosts.useGlobalCounter = true;
            }
            enterState(lives ? State.REVIVING : State.FINISHED);
        }
    },

    REVIVING: function () {
        // FIXME: is this any different from starting a level?
        enterState(State.RUNNING);
    }
};

var ctx;

function draw() {
    stats.totalInvalidated += invalidated.length;
    entities.forEach(function (e) {
        e.repaint(ctx, invalidated);
    });
    invalidated = [];

    // FIXME: this looks bad
    if (paused || state === State.FINISHED) {
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

var UPDATE_DELAY = 1000 / UPDATE_HZ,
    timer,
    lastLoopTime = new Date(),
    frameCount = 0,
    lastFrameTime = new Date();

function loop() {
    var now = new Date();

    update();
    draw();

    var elapsed = new Date() - now;
    stats.totalFrameTime += elapsed;
    if (state !== State.FINISHED) {
        timer = window.setTimeout(loop, Math.max(0, UPDATE_DELAY - elapsed));
    }
}

/// initialisation

function newGame() {
    window.clearTimeout(timer);

    bonusDisplay.reset();
    scoreboard.score = 0;
    level = 0;
    lives = 3;

    levelUp();
    enterState(State.STARTING);
    paused = false;

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
        maze.loaded(img);
        newGame();
    };
    img.src = 'res/' + maze.img;
});

