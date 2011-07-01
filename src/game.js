/*
 * An HTML5 Pac-Man clone.
 * https://www.github.com/harto/pacman
 *
 * Based on the game as described by The Pac-Man Dossier
 * (http://home.comcast.net/~jpittman2/pacman/pacmandossier.html)
 *
 * Requires: jQuery 1.4.2
 */

/*global $, Bonus, BonusDisplay, DEBUG, Delay, EAST, Energiser, Entity,
  EntityGroup, Ghost, Maze, NORTH, Pacman, SCREEN_H, SCREEN_W, SOUTH,
  TILE_SIZE, UPDATE_HZ, WEST, alert, all:true, broadcast, debug, drawPacman,
  events, format, ghosts, initialisers, level:true, lives:true, loadResources,
  resources:true, toTicks, window */

var TEXT_HEIGHT = TILE_SIZE;
var score;

function Scoreboard() {
    this.w = 0; // updated when score changes
}

Scoreboard.prototype = new Entity({

    x: 6 * TILE_SIZE,
    y: TILE_SIZE,
    h: TEXT_HEIGHT,

    repaint: function (g) {
        g.save();
        g.fillStyle = 'white';
        g.textAlign = 'left';
        g.textBaseline = 'top';
        g.setFontSize(TEXT_HEIGHT);
        // track width to allow invalidation on next update
        this.w = g.measureText(score).width;
        g.fillText(score, this.x, this.y);
        g.restore();
    },

    objectEaten: function (o) {
        score += o.value;
        this.invalidate();
    }
});
Scoreboard.prototype.dotEaten =
    Scoreboard.prototype.energiserEaten =
    Scoreboard.prototype.bonusEaten =
    Scoreboard.prototype.objectEaten;

var stats = {

    UPDATE_INTERVAL_MS: 1000,
    nTicks: 0,
    totalTickTime: 0,
    totalInvalidated: 0,
    prevUpdate: new Date().getTime(),

    init: function () {
        this.panel = $('<pre id="stats"></pre>');
        $('#cruft').append(this.panel);
        this.inited = true;
    },

    update: function () {
        var now = new Date().getTime();
        if (now - this.prevUpdate >= this.UPDATE_INTERVAL_MS) {
            if (!this.inited) {
                this.init();
            }
            this.prevUpdate = now;

            var fps = this.nTicks;
            this.nTicks = 0;

            var avgTick = this.totalTickTime / fps;
            this.totalTickTime = 0;

            this.panel.html(format('fps: %n\navgTick: %3.2nms',
                                   fps, avgTick));

        } else {
            ++this.nTicks;
        }
    }
};

function resetActors() {
    all.set('pacman', new Pacman());
    // FIXME
    ghosts.reset();
    broadcast('invalidateRegion', 0, 0, SCREEN_W, SCREEN_H);
}

function levelUp() {
    ++level;
    debug('starting level %s', level);

    all = new EntityGroup();
    all.set('maze', new Maze(),
            'scoreboard', new Scoreboard(),
            'bonusDisplay', new BonusDisplay(level),
            'ghosts', ghosts);
    if (DEBUG) {
        all.set('stats', stats);
    }

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

var State, nTicksRemaining, prevState;

function InlineText(txt, cx, cy) {
    this.txt = txt;
    this.cx = cx;
    this.cy = cy;
}
InlineText.prototype = new Entity({
    h: 5,
    repaint: function (g) {
        g.save();
        g.setFontSize(this.h);
        if (this.x === undefined) {
            // can't position until we know text width
            this.w = g.measureText(this.txt).width;
            this.centreAt(this.cx, this.cy);
        }
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = 'white';
        g.fillText(this.txt, this.cx, this.cy);
        g.restore();
    }
});

function InfoText(txt) {
    this.txt = txt;
}
InfoText.prototype = new Entity({
    pad: TEXT_HEIGHT / 2,
    repaint: function (g) {
        g.save();
        g.setFontSize(TEXT_HEIGHT);
        if (this.x === undefined) {
            this.w = g.measureText(this.txt).width + 2 * this.pad;
            this.x = (SCREEN_W - this.w) / 2;
        }
        // frame
        g.fillStyle = 'white';
        g.fillRect(this.x, this.y, this.w, this.h);
        // text
        g.fillStyle = 'black';
        g.textAlign = 'left';
        g.textBaseline = 'top';
        g.fillText(this.txt, this.x + this.pad, this.y + this.pad);
        g.restore();
    }
});
InfoText.prototype.h = TEXT_HEIGHT + 2 * InfoText.prototype.pad;
InfoText.prototype.y = (SCREEN_H - InfoText.prototype.h) / 2;

var waitTimer;

function wait(ticks, fn) {
    if (waitTimer) {
        // prevent deadlock
        return;
    }
    prevState = state;
    enterState(State.WAITING);
    waitTimer = new Delay(ticks, function () {
        enterState(prevState);
        if (fn) {
            fn();
        }
        waitTimer = null;
    });
}

State = {

    RUNNING: function () {
        events.update();
        broadcast('update');

        var pacman = all.get('pacman'),
            maze = all.get('maze');

        // collision check edibles
        var item = maze.itemAt(pacman.col, pacman.row);
        if (item) {
            broadcast(item.eatenEvent, item);
        }

        // collision check ghosts
        // FIXME
        ghosts.all().filter(function (g) {
            return !g.is(Ghost.STATE_DEAD) &&
                   g.col === pacman.col &&
                   g.row === pacman.row;
        }).forEach(function (g) {
            if (g.is(Ghost.STATE_FRIGHTENED)) {
                all.set('score', new InlineText(200, g.cx, g.cy));
                pacman.setVisible(false);
                g.setVisible(false);
                wait(toTicks(0.5), function () {
                    all.remove('score');
                    g.kill();
                    pacman.setVisible(true);
                    g.setVisible(true);
                });
            } else {
                pacman.kill();
            }
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
        var pacman = all.get('pacman');
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
    },

    WAITING: function () {
        waitTimer.update();
    }
};

var ctx;

function draw() {
    broadcast('draw', ctx);
}

var UPDATE_DELAY = 1000 / UPDATE_HZ,
    timer,
    lastLoopTime = new Date(),
    lastFrameTime = new Date();

function loop() {
    var now = new Date();

    update();
    draw();

    var elapsed = new Date() - now;
    stats.totalTickTime += elapsed;
    if (state !== State.FINISHED) {
        timer = window.setTimeout(loop, Math.max(0, UPDATE_DELAY - elapsed));
    }
}

/// initialisation

function newGame() {
    window.clearTimeout(timer);

    level = 0;
    lives = 3;
    score = 0;
    paused = false;

    levelUp();
    resources.playSound('intro');
    wait(toTicks(4), function () {
        enterState(State.RUNNING);
    });
    loop();
}

var pauseText = new InfoText('Paused');

function togglePause() {
    paused = !paused;
    resources.togglePause(paused);
    if (paused) {
        all.set('pauseText', pauseText);
    } else {
        all.remove('pauseText');
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

        // development helpers
        kill:        charCode('K'),
        levelUp:     107  // +
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
            var pacman = all.get('pacman');
            if (pacman) {
                pacman.turning = directions[k];
            }
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
        case keys.levelUp:
            levelUp();
            break;
        default:
            throw new Error('unhandled: ' + keycodes[k]);
        }
    });

    $(window).keyup(function (e) {
        var pacman = all.get('pacman');
        if (pacman) {
            var k = getKeyCode(e);
            if (pacman.turning === directions[k]) {
                pacman.turning = null;
            }
        }
    });

    loadResources({
        base: 'res',
        images: ['bg', 'blinky', 'pinky', 'inky', 'clyde', 'frightened', 'flashing', 'dead'],
        sounds: ['intro'],

        onUpdate: function (completed) {
            var g = ctx;
            g.save();
            g.fillStyle = 'black';
            g.fillRect(0, 0, SCREEN_W, SCREEN_H);

            var ox = SCREEN_W / 2,
                oy = SCREEN_H / 2;

            g.fillStyle = 'white';
            g.font = '6px Helvetica';
            g.textAlign = 'center';
            g.fillText(format('%.1n%', completed * 100), ox, SCREEN_H / 3);

            drawPacman(g, ox, oy, SCREEN_W / 8, completed);
            g.restore();
        },

        onComplete: function (resourceManager) {
            // TODO: fade indicator
            resources = resourceManager;
            initialisers.forEach(function (f) {
                f();
            });
            newGame();
        },

        onError: function (msg) {
            alert(msg);
            throw new Error(msg);
        }
    });
});
