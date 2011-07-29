/*
 * An HTML5 Pac-Man clone.
 * https://www.github.com/harto/pacman
 *
 * Based on the game as described by The Pac-Man Dossier
 * (http://home.comcast.net/~jpittman2/pacman/pacmandossier.html)
 */

/*global $, Blinky, BonusDisplay, Clyde, DEBUG, Delay, DotCounter, DotGroup,
  EAST, Entity, EventManager, Ghost, Group, Inky, InlineScore, Maze,
  ModeSwitcher, NORTH, Pacman, Pinky, ReleaseTimer, SCREEN_H, SCREEN_W, SOUTH,
  TILE_SIZE, UPDATE_HZ, WEST, alert, all:true, bind, broadcast, debug,
  drawPacman, format, initialisers, level:true, lives:true, loadResources,
  lookup, resources:true, toTicks, wait, window */

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

function InfoText(txt) {
    this.txt = txt;
}

InfoText.prototype = new Entity({
    pad: TEXT_HEIGHT / 2,
    z: 3,
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

/// in-game score indicator

function InlineScore(score, cx, cy) {
    this.score = score;
    this.cx = cx;
    this.cy = cy;
}

InlineScore.prototype = new Entity({

    h: TILE_SIZE / 2,

    insert: function () {
        this.id = all.add(this);
        this.invalidate();
    },

    remove: function () {
        all.remove(this.id);
        this.invalidate();
    },

    showFor: function (ticks) {
        this.insert();
        all.get('events').delay(ticks, bind(this, function () {
            this.remove();
        }));
    },

    repaint: function (g) {
        g.save();
        g.setFontSize(this.h);
        if (!this.w) {
            // can't position until we know text width
            this.w = g.measureText(this.score).width;
            this.centreAt(this.cx, this.cy);
        }
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = 'white';
        g.fillText(this.score, this.cx, this.cy);
        g.restore();
    },

    toString: function () {
        return 'InlineScore';
    }
});

var stats = {

    UPDATE_INTERVAL_MS: 1000,
    nTicks: 0,
    totalTickTime: 0,
    totalInvalidated: 0,
    prevUpdate: new Date().getTime(),

    init: function () {
        this.panel = $('<pre id="stats"></pre>');
        this.panel.css({ position: 'fixed', right: 0, top: 0 });
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

function reset() {
    all.set('events', new EventManager());
    all.set('pacman', new Pacman());
    all.set('blinky', new Blinky());
    all.set('pinky', new Pinky());
    all.set('inky', new Inky());
    all.set('clyde', new Clyde());
    all.set('modeSwitcher', new ModeSwitcher(level));
    all.set('releaseTimer', new ReleaseTimer(level));

    broadcast('start');
    broadcast('invalidateRegion', [0, 0, SCREEN_W, SCREEN_H]);
}

function levelUp() {
    ++level;
    debug('starting level %s', level);

    all = new Group();

    all.set('maze', new Maze());
    all.set('dots', new DotGroup());
    all.set('scoreboard', new Scoreboard());
    all.set('bonusDisplay', new BonusDisplay(level));
    all.set('dotCounter', new DotCounter(level));
    if (DEBUG) {
        all.set('stats', stats);
    }

    reset();
}

var mode, paused;

function update() {
    if (!paused) {
        mode();
    }
}

function enterMode(m) {
    mode = m;
}

var Mode, prevMode, waitTimer;

function wait(ticks, onResume) {
    prevMode = mode;
    enterMode(Mode.WAITING);
    waitTimer = new Delay(ticks, function () {
        enterMode(prevMode);
        if (onResume) {
            onResume();
        }
        waitTimer = null;
    });
}

function processCollisions() {
    var pacman = lookup('pacman');

    var collidingGhosts = Ghost.all().filter(function (g) {
        return g.colliding(pacman);
    });
    var deadGhosts = collidingGhosts.filter(function (g) {
        return g.is(Ghost.STATE_FRIGHTENED);
    });
    if (deadGhosts.length !== collidingGhosts.length) {
        pacman.kill();
        broadcast('pacmanKilled');
        enterMode(Mode.DYING);
        return;
    } else if (deadGhosts.length) {
        pacman.setVisible(false);
        var scoreValue, scoreCx, scoreCy;
        deadGhosts.forEach(function (g) {
            debug('%s: dying', g);
            g.kill();
            g.setVisible(false);
            // FIXME: increase according to # ghosts eaten
            scoreValue = 200;
            scoreCx = g.cx;
            scoreCy = g.cy;
        });
        // FIXME: show correct score, add to total
        var score = new InlineScore(scoreValue, scoreCx, scoreCy);
        score.insert();

        wait(toTicks(0.5), function () {
            score.remove();
            pacman.setVisible(true);
            deadGhosts.forEach(function (g) {
                g.setVisible(true);
            });
        });
    }

    var dots = lookup('dots');
    var dot = dots.colliding(pacman);
    if (dot) {
        dots.remove(dot);
        broadcast(dot.eatenEvent, [dot]);
        resources.playSound('tick' + Math.floor(Math.random() * 4));
        if (dots.isEmpty()) {
            enterMode(Mode.LEVELUP);
            return;
        }
    }

    var bonus = lookup('bonus');
    if (bonus && bonus.colliding(pacman)) {
        debug('bonus eaten');
        broadcast('bonusEaten', [bonus]);
        bonus.remove();
        var bonusScore = new InlineScore(bonus.value, bonus.cx, bonus.cy);
        bonusScore.showFor(toTicks(1));
    }
}

Mode = {

    RUNNING: function () {
        broadcast('update');
        processCollisions();
    },

    LEVELUP: function () {
        // FIXME: flashing maze, delay
        levelUp();
        enterMode(Mode.RUNNING);
    },

    DYING: function () {
        var pacman = lookup('pacman');
        // if (!pacman.dead) {
        //     // continue dying
        //     // FIXME: separate method on pacman?
        //     pacman.update();
        // } else {
            if (--lives) {
                reset();
            }
            enterMode(lives ? Mode.REVIVING : Mode.FINISHED);
        // }
    },

    REVIVING: function () {
        // FIXME: is this any different from starting a level?
        enterMode(Mode.RUNNING);
    },

    WAITING: function () {
        waitTimer.update();
    }
};

var ctx;

function draw() {
    broadcast('draw', [ctx]);
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
    if (mode !== Mode.FINISHED) {
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
        enterMode(Mode.RUNNING);
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
    pauseText.invalidate();
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
            var pacman = lookup('pacman');
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
        var pacman = lookup('pacman');
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
        sounds: ['intro', 'tick0', 'tick1', 'tick2', 'tick3'],

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

            var soundToggle = $('#enableSounds');
            soundToggle.attr('disabled', false);
            soundToggle.attr('checked', resources.soundsEnabled());
            soundToggle.click(function (e) {
                resources.enableSounds(this.checked);
            });

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
