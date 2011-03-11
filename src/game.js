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
         SCREEN_W, SCREEN_H, UPDATE_HZ, TEXT_HEIGHT,
         NORTH, SOUTH, EAST, WEST,
         invalidateScreen, invalidated: true, debug, Ghost,
         score: true, lives: true, level: true,
         maze, pacman, blinky, inky, pinky, clyde */

var entities = [maze, pacman, blinky, pinky, inky, clyde],
    ctx,

    // game states
    STATE_RUNNING = 'RUNNING',
    STATE_LEVELUP = 'LEVELUP',
    STATE_FINISHED = 'FINISHED',

    state,
    paused;

function draw() {
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
    maze.reset();
    pacman.reset();
    Ghost.resetAll();

    invalidateScreen();
}

function update() {
    if (state === STATE_RUNNING) {
        entities.forEach(function (a) {
            a.update();
        });
        if (maze.isEmpty()) {
            state = STATE_LEVELUP;
            return;
        }

        Ghost.release();
        Ghost.updateMode();
    } else if (state === STATE_LEVELUP) {
        // FIXME: delay
        levelUp();
    // } else if (state === State.REINSERT) {
    //     if (new Date() - timeOfDeath >= Ball.REINSERT_DELAY) {
    //         ball.reset();
    //         state = State.RUNNING;
    //     }
    }
}

var UPDATE_DELAY = 1000 / UPDATE_HZ,
    timer;

function loop() {
    if (!paused) {
        update();
    }
    draw();

    if (state !== STATE_FINISHED) {
        timer = window.setTimeout(loop, UPDATE_DELAY);
    }
}

/// initialisation

function newGame() {
    window.clearTimeout(timer);

    score = 0;
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
    ctx.font = 'bold ' + TEXT_HEIGHT + 'px Helvetica, Arial, sans-serif';

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

