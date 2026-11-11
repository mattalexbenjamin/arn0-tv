/*
 * Calendar integration via iCal (.ics) feed.
 *
 * Designed to be zero-bloat, lightweight (< 3 KB), and zero-friction:
 * - Direct HTTP fetch of private iCal feed.
 * - Simple native parser extracting upcoming events for today and tomorrow.
 * - Persisted in localStorage ('arn0.calendar.v1') for 0ms instantaneous display on startup.
 * - Non-blocking asynchronous background refresh.
 */
(function () {
    'use strict';

    var STORE_KEY = 'arn0.calendar.v1';
    var FRESH_MS = 20 * 60 * 1000;       // refresh every 20 minutes
    var TIMEOUT_MS = 9000;
    var listeners = [];

    function cfgUrl() {
        var url = (window.LAUNCHER_CONFIG && window.LAUNCHER_CONFIG.calendarUrl) || null;
        if (!url) return null;
        // In browser preview (localhost), route through local dev proxy to bypass desktop CORS:
        if (window.location && window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return '/api/calendar';
        }
        return url;
    }

    function readCache() {
        try {
            var raw = localStorage.getItem(STORE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function writeCache(data) {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(data));
        } catch (e) {}
    }

    /*
     * Parses iCal date strings:
     * - 20261111 (all-day date)
     * - 20261111T140000Z (UTC datetime)
     * - 20261111T140000 (local datetime)
     */
    function parseIcsDate(val) {
        if (!val) return null;
        val = val.trim();
        if (val.length === 8) {
            var y = parseInt(val.substr(0, 4), 10);
            var m = parseInt(val.substr(4, 2), 10) - 1;
            var d = parseInt(val.substr(6, 2), 10);
            return { date: new Date(y, m, d), allDay: true };
        }
        if (val.indexOf('T') !== -1) {
            var isUtc = val.slice(-1) === 'Z';
            var clean = val.replace('Z', '');
            var parts = clean.split('T');
            var y2 = parseInt(parts[0].substr(0, 4), 10);
            var m2 = parseInt(parts[0].substr(4, 2), 10) - 1;
            var d2 = parseInt(parts[0].substr(6, 2), 10);
            var hh = parseInt(parts[1].substr(0, 2), 10);
            var mm = parseInt(parts[1].substr(2, 2), 10);
            var ss = parseInt(parts[1].substr(4, 2), 10);
            if (isUtc) {
                return { date: new Date(Date.UTC(y2, m2, d2, hh, mm, ss)), allDay: false };
            }
            return { date: new Date(y2, m2, d2, hh, mm, ss), allDay: false };
        }
        return null;
    }

    function formatTime(d) {
        var hours = d.getHours();
        var mins = d.getMinutes();
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0) hours = 12;
        var minsStr = mins < 10 ? '0' + mins : '' + mins;
        return hours + ':' + minsStr + ' ' + ampm;
    }

    function parseIcsText(text) {
        // Unfold wrapped lines in iCal standard
        var cleanText = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
        var evRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
        var match;
        var events = [];

        while ((match = evRegex.exec(cleanText)) !== null) {
            var block = match[1];
            var summary = '';
            var dtstart = '';
            var dtend = '';
            var status = '';

            var lines = block.split(/\r\n|\n|\r/);
            for (var i = 0; i < lines.length; i++) {
                var l = lines[i];
                if (l.indexOf('SUMMARY:') === 0) {
                    summary = l.substring(8);
                } else if (l.indexOf('DTSTART') === 0) {
                    dtstart = l.substring(l.indexOf(':') + 1);
                } else if (l.indexOf('DTEND') === 0) {
                    dtend = l.substring(l.indexOf(':') + 1);
                } else if (l.indexOf('STATUS:') === 0) {
                    status = l.substring(7);
                }
            }

            if (status.toUpperCase() === 'CANCELLED') continue;

            var startObj = parseIcsDate(dtstart);
            if (!startObj) continue;

            // Unescape special chars
            summary = summary.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

            events.push({
                summary: summary || 'Untitled Event',
                start: startObj.date.getTime(),
                allDay: startObj.allDay
            });
        }

        events.sort(function (a, b) { return a.start - b.start; });
        return events;
    }

    var fetching = false;

    function fetchFeed() {
        var url = cfgUrl();
        if (!url || fetching) return;
        fetching = true;

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = TIMEOUT_MS;
        xhr.onload = function () {
            fetching = false;
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var parsed = parseIcsText(xhr.responseText);
                    var record = {
                        fetchedAt: Date.now(),
                        events: parsed
                    };
                    writeCache(record);
                    notify();
                } catch (e) {
                    if (window.DevLog) DevLog.log('Calendar parse error: ' + e);
                }
            }
        };
        xhr.onerror = function () {
            fetching = false;
        };
        xhr.ontimeout = function () {
            fetching = false;
        };
        xhr.send();
    }

    function notify() {
        listeners.forEach(function (fn) {
            try { fn(); } catch (e) {}
        });
    }

    /*
     * Returns upcoming events.
     * Groups events occurring on the same upcoming day so you see all of them (e.g. 2+ events on that day).
     */
    function upcoming() {
        var data = readCache();
        if (!data || !data.events) {
            fetchFeed();
            return null;
        }

        // Trigger background refresh if stale
        if (Date.now() - (data.fetchedAt || 0) > FRESH_MS) {
            fetchFeed();
        }

        var now = Date.now();
        var cutoffPast = now - 60 * 60 * 1000; // include events started up to 1 hr ago
        var futureEvents = [];

        for (var i = 0; i < data.events.length; i++) {
            var ev = data.events[i];
            if (ev.start >= cutoffPast) {
                futureEvents.push(ev);
            }
        }

        if (futureEvents.length === 0) return null;

        var first = futureEvents[0];
        var firstDate = new Date(first.start);
        var firstDayStr = firstDate.toDateString();

        // Collect all events on that same day
        var sameDay = futureEvents.filter(function (e) {
            return new Date(e.start).toDateString() === firstDayStr;
        });

        var nowDate = new Date();
        var isToday = (firstDayStr === nowDate.toDateString());
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        var isTomorrow = (firstDayStr === tomorrow.toDateString());

        var dayLabel = isToday ? 'Today' : (isTomorrow ? 'Tomorrow' : (firstDate.getMonth() + 1) + '/' + firstDate.getDate());

        var eventItems = sameDay.map(function (e) {
            var d = new Date(e.start);
            var time = e.allDay ? 'All Day' : formatTime(d);
            return {
                time: time,
                summary: e.summary,
                allDay: e.allDay
            };
        });

        return {
            dayLabel: dayLabel,
            events: eventItems,
            count: eventItems.length
        };
    }

    function onUpdate(fn) {
        listeners.push(fn);
    }

    // Auto-refresh when TV comes back from sleep/another app
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            fetchFeed();
        }
    });

    window.Calendar = {
        upcoming: upcoming,
        refresh: fetchFeed,
        onUpdate: onUpdate
    };
})();

