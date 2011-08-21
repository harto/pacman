/*
 * An HTML5 Pac-Man clone.
 * https://www.github.com/harto/pacman
 *
 * Based on the game as described by The Pac-Man Dossier
 * (http://home.comcast.net/~jpittman2/pacman/pacmandossier.html)
 */

/*global $, Blinky, BonusDisplay, Clyde, DEBUG, Delay, DotCounter, DotGroup,
  EAST, ElroyCounter, Energiser, Ghost, Group, Header, InfoText, Inky,
  InlineScore, LifeDisplay, Maze, ModeSwitcher, NORTH, Pacman, Pinky,
  ReleaseTimer, ResourceManager, SCREEN_H, SCREEN_W, SOUTH, TILE_SIZE, Text,
  UPDATE_HZ, WEST, alert, broadcast, cookies, debug, format, highscore:true,
  initialisers, insert, invalidateScreen, level:true, lives:true, lookup,
  merge, objects:true, remove, resources:true, score:true, toTicks, wait,
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

var MODE_RUNNING  = 'running',
    MODE_WAITING  = 'waiting',
    MODE_DYING    = 'dying',
    MODE_LEVELUP  = 'levelup',
    MODE_FINISHED = 'finished';

var mode, paused, waitTimer;

function wait(secs, onResume) {
    waitTimer = (function (prevMode, prevTimer) {
        return new Delay(toTicks(secs), function () {
            mode = prevMode;
            waitTimer = prevTimer;
            onResume();
        });
    }(mode, waitTimer));
    mode = MODE_WAITING;
}

function respawn(starting) {
    invalidateScreen();
    mode = MODE_RUNNING;

    insert('modeSwitcher', new ModeSwitcher(level));
    insert('releaseTimer', new ReleaseTimer(level));
    var lifeDisplay = new LifeDisplay(starting ? lives : lives - 1);
    insert('lifeDisplay', lifeDisplay);

    function insertStartupText(id, props) {
        insert(id, new Text(merge(props, {
            size: TILE_SIZE,
            style: Text.STYLE_FIXED_WIDTH
        })));
    }

    insertStartupText('readyText', {
        txt: 'READY!',
        colour: 'yellow',
        x: 11 * TILE_SIZE,
        y: 20 * TILE_SIZE
    });

    function start() {
        insert('pacman', new Pacman());
        insert('blinky', new Blinky());
        insert('pinky', new Pinky());
        insert('inky', new Inky());
        insert('clyde', new Clyde());
        insert('elroyCounter', new ElroyCounter(level, lookup('dots').dotsRemaining()));
        broadcast('onRespawn');
        wait(starting ? 2 : 1, function () {
            remove('readyText');
        });
    }

    if (starting) {
        insertStartupText('playerOneText', {
            txt: 'PLAYER ONE',
            colour: 'cyan',
            x: 9 * TILE_SIZE,
            y: 14 * TILE_SIZE
        });
        wait(2, function () {
            lifeDisplay.setLives(lives - 1);
            remove('playerOneText');
            start();
        });
        resources.playSound('intro');
    } else {
        start();
    }
}

function levelUp(starting) {
    resources.killSounds();
    ++level;
    debug('starting level %s', level);

    insert('dots', new DotGroup());
    insert('dotCounter', new DotCounter(level));
    insert('bonusDisplay', new BonusDisplay(level));

    respawn(starting);
}

function addPoints(points) {
    score += points;
    highscore = Math.max(score, highscore);
    lookup('header').updateScore(score, highscore);
}

// Removes all entities that will be replaced on respawn.
function removeTransientEntities() {
    ['blinky', 'inky', 'pinky', 'clyde', 'bonus', 'bonusScore',
     'ghostScore', 'releaseTimer', 'modeSwitcher'].forEach(remove);
}

function levelComplete() {
    removeTransientEntities();
    remove('dots');
    lookup('pacman').wait();
    lookup('maze').flash(levelUp);
    mode = MODE_LEVELUP;
}

function processDotCollisions(pacman, dots) {
    var dot = dots.colliding(pacman);
    if (dot) {
        dots.remove(dot);
        broadcast('onDotEaten', [dot]);
        if (dot instanceof Energiser) {
            broadcast('onEnergiserEaten', [dot]);
        }
        resources.playSound('tick' + Math.floor(Math.random() * 4));
        addPoints(dot.value);
        if (dots.isEmpty()) {
            wait(1, levelComplete);
        }
    }
}

function processBonusCollision(pacman, bonus) {
    if (bonus && bonus.colliding(pacman)) {
        debug('bonus eaten');
        remove('bonus');
        addPoints(bonus.value);
        var bonusScore = new InlineScore(bonus.value, '#FBD', bonus.cx, bonus.cy);
        insert('bonusScore', bonusScore);
        bonusScore.delayEvent(toTicks(1), function () {
            remove('bonusScore');
        });
    }
}

function killPacman() {
    removeTransientEntities();
    lookup('pacman').kill();
    lookup('dotCounter').useGlobalCounter();
    mode = MODE_DYING;
}

function killGhosts(pacman, deadGhosts) {
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
    insert('ghostScore', new InlineScore(scoreValue, 'cyan', scoreCx, scoreCy));
    wait(0.5, function () {
        remove('ghostScore');
        deadGhosts.concat(pacman).forEach(function (o) {
            o.setVisible(true);
        });
    });
}

function processGhostCollisions(pacman, ghosts) {
    var collidingGhosts = ghosts.filter(function (g) {
        return g.colliding(pacman);
    });
    var deadGhosts = collidingGhosts.filter(function (g) {
        return g.is(Ghost.STATE_FRIGHTENED);
    });
    if (deadGhosts.length !== collidingGhosts.length) {
        wait(1, killPacman);
    } else if (deadGhosts.length) {
        killGhosts(pacman, deadGhosts);
    }
}

function lifeLost() {
    if (--lives) {
        respawn();
    } else {
        // game over
        var prevBest = getPref('highscore') || 0;
        setPref('highscore', Math.max(prevBest, highscore));
        mode = MODE_FINISHED;
    }
}

function update() {
    if (paused) {
        return;
    }

    if (mode === MODE_WAITING) {
        waitTimer.update();
        return;
    }

    objects.dispatch('update');

    var pacman = lookup('pacman');
    if (mode === MODE_RUNNING) {
        processDotCollisions(pacman, lookup('dots'));
        processBonusCollision(pacman, lookup('bonus'));
        processGhostCollisions(pacman, Ghost.all());
        var waitingGhost = lookup('dotCounter').waitingGhost();
        if (waitingGhost) {
            waitingGhost.release();
        }
    } else if (mode === MODE_DYING && pacman.dead) {
        lifeLost();
    }
}

var ctx;

function draw() {
    objects.dispatch('draw', [ctx]);
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
    if (mode !== MODE_FINISHED) {
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

    objects = new Group();
    insert('maze', new Maze());
    insert('header', new Header());
    if (DEBUG) {
        insert('stats', stats);
    }

    levelUp(true);
    loop();
}

var pauseTextId;

function togglePause() {
    paused = !paused;
    resources.togglePause(paused);
    if (paused) {
        insert('pauseText', new InfoText('Paused'));
    } else {
        remove('pauseText');
    }
}

function initKeyBindings() {
    function charCode(c) {
        return c.charCodeAt(0);
    }

    var keys = {
        left:          37, // left arrow
        right:         39, // right arrow
        up:            38, // up arrow
        down:          40, // down arrow

        togglePause:   charCode('P'),
        newGame:       charCode('N'),

        // development helpers
        kill:          charCode('K'),
        levelComplete: 107 // +
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
        case keys.levelComplete:
            levelComplete();
            break;
        default:
            throw new Error('unhandled: ' + keycodes[k]);
        }
    });

    $(window).keyup(function (e) {
        var pacman = lookup('pacman');
        var k = getKeyCode(e);
        if (pacman && pacman.turning === directions[k]) {
            pacman.turning = null;
        }
    });
}

$(function () {
    var canvas = $('canvas').get(0);
    ctx = canvas.getContext('2d');
    ctx.scale(canvas.width / SCREEN_W, canvas.height / SCREEN_H);

    function drawProgress(proportion) {
        var g = ctx;
        g.save();
        g.fillStyle = 'black';
        g.fillRect(0, 0, SCREEN_W, SCREEN_H);

        var cx = SCREEN_W / 2;

        var percentage = new Text({
            txt: format('%.1n%', proportion * 100),
            colour: 'white',
            style: Text.STYLE_NORMAL,
            size: TILE_SIZE,
            align: 'center',
            x: cx,
            y: SCREEN_H / 3
        });
        percentage.repaint(g);

        Pacman.draw(g, cx, SCREEN_H / 2, SCREEN_W / 8, 0, proportion, false);

        g.restore();
    }

    function init() {
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
    }

    ResourceManager.load({
        base: 'res',
        images: ['bg', 'bg-flash', 'blinky', 'pinky', 'inky',
                 'clyde', 'frightened', 'flashing', 'dead'],
        sounds: ['intro', 'tick0', 'tick1', 'tick2', 'tick3'],
        fonts: { stylesheet: 'fonts.css',
                 families: [Text.STYLE_FIXED_WIDTH] },

        onUpdate: drawProgress,
        onComplete: function (resourceManager) {
            resources = resourceManager;
            init();
        },
        onError: function (msg) {
            alert(msg);
            throw new Error(msg);
        }
    });
});
