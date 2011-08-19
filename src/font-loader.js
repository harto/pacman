/*
 * Interface to Google WebFont Loader, per
 * http://code.google.com/apis/webfonts/docs/webfont_loader.html
 */

/*global $, debug, document, format, window */

var FontLoader = {

    load: function (base, stylesheet, families, onload, onerror) {

        window.WebFontConfig = {
            custom: {
                families: families,
                urls: [format('%s/%s', base, stylesheet)]
            },
            fontactive: function (family, _) {
                //debug('active: %s', family);
                onload(family);
            },
            fontinactive: function (family, _) {
                //debug('inactive: %s', family);
                onerror(family);
            }
        };

        $('head').append(
            $(document.createElement('script')).attr(
                'src', 'http://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js'));
    }
};
