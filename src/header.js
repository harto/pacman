/*
 * Text bits and pieces appearing in the header area
 */

/*global Group, TILE_SIZE, Text, objects, highscore, merge, score, toTicks */

function Header() {
    var props = {
        style: Text.STYLE_FIXED_WIDTH,
        size: TILE_SIZE
    };
    this.set('1up', new Text(merge(props, {
        txt: '1UP',
        x: 4 * TILE_SIZE,
        y: 0
    })));
    this.add(new Text(merge(props, {
        txt: 'HIGH SCORE',
        x: 9 * TILE_SIZE,
        y: 0
    })));
    this.set('score', new Text(merge(props, {
        txt: score,
        align: 'right',
        x: 7 * TILE_SIZE,
        y: TILE_SIZE
    })));
    this.set('highscore', new Text(merge(props, {
        txt: highscore,
        align: 'right',
        x: 17 * TILE_SIZE,
        y: TILE_SIZE
    })));
}

Header.prototype = new Group({

    start: function () {
        var oneup = this.get('1up');
        objects.get('events').repeat(toTicks(0.25), function () {
            oneup.setVisible(!oneup.isVisible());
        });
    },

    scoreChanged: function () {
        this.get('score').setText(score);
        this.get('highscore').setText(highscore);
    }
});
