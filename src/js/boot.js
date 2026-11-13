/* Start-up order: UI core, Settings views, then Home (which shows itself). */
(function () {
    'use strict';

    function fitScreen() {
        var w = window.innerWidth || document.documentElement.clientWidth || (window.screen && window.screen.width) || 1920;
        var h = window.innerHeight || document.documentElement.clientHeight || (window.screen && window.screen.height) || 1080;
        document.documentElement.classList.add('preview');
        var scale = Math.min(w / 1920, h / 1080);
        var tx = Math.round((w - 1920 * scale) / 2);
        var ty = Math.round((h - 1080 * scale) / 2);
        var stage = document.getElementById('stage');
        if (stage) {
            if (scale === 1 && tx === 0 && ty === 0) {
                stage.style.transformOrigin = '';
                stage.style.transform = '';
            } else {
                stage.style.transformOrigin = '0 0';
                stage.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
            }
        }
    }

    fitScreen();
    window.addEventListener('resize', fitScreen);

    UI.init();
    Settings.init();
    Screensaver.init();
    Weather.start();
    if (window.Calendar) Calendar.init();
    if (window.CalendarView) CalendarView.init();
    Home.init();

    // Preview only: open a screen directly, e.g. http://localhost:8080/#settings
    var view = location.hash.slice(1);
    if (window.__TIZEN_MOCK__ && view) {
        try {
            UI.show(view);
        } catch (e) {
            // Unknown screen name: stay on Home.
        }
    }
})();
