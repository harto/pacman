/*
 * An HTML5 Pac-Man clone.
 * https://www.github.com/harto/pacman
 *
 * Based on the game as described by The Pac-Man Dossier
 * (http://home.comcast.net/~jpittman2/pacman/pacmandossier.html)
 */

/*global $, Blinky, BonusDisplay, Clyde, DEBUG, Delay, DotCounter, DotGroup,
  EAST, EventManager, Ghost, Group, Header, InfoText, Inky, InlineScore,
  LifeDisplay, Maze, ModeSwitcher, NORTH, Pacman, Pinky, ReleaseTimer,
  SCREEN_H, SCREEN_W, SOUTH, TILE_SIZE, Text, UPDATE_HZ, WEST, alert, all:true,
  broadcast, cookies, debug, format, highscore:true, initialisers, level:true,
  lives:true, loadResources, lookup, resources:true, score:true, toTicks, wait,
  window */

function getPref(key) {
    return cookies.read(key);
}

function setPref(key, value) {
    var expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    cookies.set(key, value, { expires: expiry });
}

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
    all.set('lifeDisplay', new LifeDisplay(lives));

    broadcast('start');
    broadcast('invalidateRegion', [0, 0, SCREEN_W, SCREEN_H]);
}

function levelUp() {
    resources.killSounds();
    ++level;
    debug('starting level %s', level);

    all = new Group();

    all.set('maze', new Maze());
    all.set('header', new Header());
    all.set('dots', new DotGroup());
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

function addPoints(points) {
    score += points;
    highscore = Math.max(score, highscore);
    broadcast('scoreChanged');
}

function processCollisions() {
    var pacman = lookup('pacman');
    var points = 0;

    var dots = lookup('dots');
    var dot = dots.colliding(pacman);
    if (dot) {
        dots.remove(dot);
        broadcast(dot.eatenEvent, [dot]);
        resources.playSound('tick' + Math.floor(Math.random() * 4));
        addPoints(dot.value);
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
        var bonusScore = new InlineScore(bonus.value, '#FBD', bonus.cx, bonus.cy);
        bonusScore.showFor(toTicks(1));
        addPoints(bonus.value);
    }

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
    } else if (deadGhosts.length) {
        pacman.setVisible(false);
        var scoreValue, scoreCx, scoreCy;
        var nFrightened = Ghost.all(Ghost.STATE_FRIGHTENED).length;
        deadGhosts.forEach(function (g) {
            debug('%s: dying', g);
            g.kill();
            g.setVisible(false);
            scoreValue = Ghost.calcGhostScore(nFrightened--);
            scoreCx = g.cx;
            scoreCy = g.cy;
            addPoints(scoreValue);
        });
        var scoreText = new InlineScore(scoreValue, 'cyan', scoreCx, scoreCy);
        scoreText.insert();

        wait(toTicks(0.5), function () {
            scoreText.remove();
            pacman.setVisible(true);
            deadGhosts.forEach(function (g) {
                g.setVisible(true);
            });
        });
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
        // TODO: death animation
        if (--lives) {
            reset();
            enterMode(Mode.REVIVING);
        } else {
            // game over
            var prevBest = getPref('highscore') || 0;
            setPref('highscore', Math.max(prevBest, highscore));

            enterMode(Mode.FINISHED);
        }
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
    var delay = toTicks(resources.soundsEnabled() ? 4 : 1);
    resources.playSound('intro');
    wait(delay, function () {
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

function initKeyBindings() {
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
            lookup('pacman').turning = directions[k];
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
        var k = getKeyCode(e);
        if (pacman.turning === directions[k]) {
            pacman.turning = null;
        }
    });
}

$(function () {
    var canvas = $('canvas').get(0);
    ctx = canvas.getContext('2d');
    ctx.scale(canvas.width / SCREEN_W, canvas.height / SCREEN_H);

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

            var percentage = new Text({
                txt: format('%.1n%', completed * 100),
                colour: 'white',
                style: '"Helvetica Neue", Helvetica, sans-serif',
                size: TILE_SIZE,
                align: 'center',
                x: ox,
                y: SCREEN_H / 3
            });
            percentage.repaint(g);

            Pacman.draw(g, ox, oy, SCREEN_W / 8, completed);
            g.restore();
        },

        onComplete: function (resourceManager) {
            // TODO: fade indicator
            resources = resourceManager;

            // check for previous sound preference
            var soundsEnabled = getPref('sound.enabled') !== 'false';
            resources.enableSounds(soundsEnabled);

            var soundToggle = $('#enableSounds');
            soundToggle.attr('disabled', false);
            soundToggle.attr('checked', resources.soundsEnabled());
            soundToggle.click(function (e) {
                resources.enableSounds(this.checked);
                setPref('sound.enabled', this.checked);
            });

            initialisers.forEach(function (f) {
                f();
            });

            highscore = getPref('highscore') || 0;
            initKeyBindings();
            newGame();
        },

        onError: function (msg) {
            alert(msg);
            throw new Error(msg);
        }
    });
});
