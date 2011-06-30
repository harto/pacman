/*
 * Miscellaneous project-independent utilities
 */

// format a number (fmt = '3.1', '.4', etc)
function formatNumber(num, fmt) {
    num += '';
    if (!fmt) {
        return num;
    }
    var numParts = num.split('.'), dec = numParts[0], frac = numParts[1] || '',
        fmtParts = fmt.split('.'), nDec = fmtParts[0], nFrac = fmtParts[1];
    if (nFrac === undefined) {
        return dec.substring(0, nDec);
    } else {
        while (frac.length < nFrac) {
            frac += '0';
        }
        return (nDec === '' ? dec : dec.substring(0, nDec)) + '.' +
               frac.substring(0, nFrac);
    }
}

// printf-style formatting
function format(msg/*, args*/) {
    var args = Array.prototype.slice.call(arguments, 1);
    return (msg + '').replace(/%(s|[0-9]?\.?[0-9]?n)/g, function (_, code) {
        var arg = args.shift();
        switch (code.charAt(code.length - 1)) {
        case 's':
            return arg;
        case 'n':
            return formatNumber(arg, code.substring(0, code.length - 1));
        default:
            throw new Error('bad format code: ' + code);
        }
    });
}

function noop() {}

function bind(o, f) {
    return function (/*...*/) {
        f.apply(o, arguments);
    };
}

function alias(o, fName) {
    var f = o[fName];
    return f ? bind(o, f) : noop;
}

function keys(o) {
    var ks = [];
    for (var k in o) {
        if (o.hasOwnProperty(k)) {
            ks.push(k);
        }
    }
    return ks;
}

function values(o) {
    return keys(o).map(function (k) {
        return o[k];
    }, this);
}

function copy(from, to) {
    keys(from).forEach(function (k) {
        to[k] = from[k];
    });
}

// Math extensions

Math.sign = function (x) {
    return x < 0 ? -1 : x > 0 ? 1 : 0;
};

// remove fractional part of number
Math.trunc = function (x) {
    return Math.sign(x) * Math.floor(Math.abs(x));
};

// Array extensions

// remove element from array in linear time
Array.prototype.remove = function (o) {
    var i = this.indexOf(o);
    if (i !== -1) {
        this.splice(i, 1);
    }
}

// return first element matching pred in linear time
Array.prototype.first = function (pred) {
    for (var i = 0; i < this.length; i++) {
        var x = this[i];
        if (pred(x)) {
            return x;
        }
    }
}
