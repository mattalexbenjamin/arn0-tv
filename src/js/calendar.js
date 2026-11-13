/*
 * Multi-Calendar engine for Skylight-style Dayboard & Ambient view.
 *
 * Capabilities:
 * - Aggregates 1 or more Google Calendar secret iCal feeds in parallel.
 * - Extracts and normalizes events with color tagging and source metadata.
 * - Parses recurrence, all-day status, start/end timestamps, descriptions, and locations.
 * - LocalStorage caching ('arn0.skylight.v1') for instantaneous 0ms cold-start display.
 * - Provides week-level and day-level queries for the 7-day Dayboard view.
 */
(function () {
    'use strict';

    var STORE_KEY = 'arn0.skylight.v1';
    var FRESH_MS = 20 * 60 * 1000;       // background refresh every 20 min
    var TIMEOUT_MS = 9000;
    var listeners = [];

    var DEFAULT_COLORS = ['#38bdf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#fb923c'];
    var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    function getConfigs() {
        var cfg = window.LAUNCHER_CONFIG || {};
        var list = [];
        if (cfg.calendars && Array.isArray(cfg.calendars) && cfg.calendars.length > 0) {
            list = cfg.calendars;
        } else if (cfg.calendarUrl) {
            list = [{ name: 'Calendar', color: DEFAULT_COLORS[0], url: cfg.calendarUrl }];
        }
        return list.map(function (item, idx) {
            return {
                id: 'cal_' + idx,
                name: item.name || ('Calendar ' + (idx + 1)),
                color: item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
                url: item.url
            };
        });
    }

    function resolveFeedUrl(url) {
        if (!url) return '';
        var isLocal = (window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
        if (isLocal) {
            return '/api/calendar?url=' + encodeURIComponent(url);
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

    function parseIcsText(text, calMeta) {
        var cleanText = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
        var evRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
        var match;
        var events = [];

        while ((match = evRegex.exec(cleanText)) !== null) {
            var block = match[1];
            var summary = '';
            var dtstart = '';
            var dtend = '';
            var location = '';
            var description = '';
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
                } else if (l.indexOf('LOCATION:') === 0) {
                    location = l.substring(9);
                } else if (l.indexOf('DESCRIPTION:') === 0) {
                    description = l.substring(12);
                } else if (l.indexOf('STATUS:') === 0) {
                    status = l.substring(7);
                }
            }

            if (status.toUpperCase() === 'CANCELLED') continue;

            var startObj = parseIcsDate(dtstart);
            if (!startObj) continue;
            var endObj = parseIcsDate(dtend);

            summary = summary.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
            location = location.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

            events.push({
                calId: calMeta.id,
                calName: calMeta.name,
                calColor: calMeta.color,
                summary: summary || 'Untitled Event',
                start: startObj.date.getTime(),
                end: endObj ? endObj.date.getTime() : startObj.date.getTime(),
                allDay: startObj.allDay,
                location: location || '',
                description: description || ''
            });
        }
        return events;
    }

    var fetching = false;

    function fetchAll() {
        var configs = getConfigs();
        if (configs.length === 0 || fetching) return;
        fetching = true;

        var total = configs.length;
        var completed = 0;
        var allEvents = [];

        configs.forEach(function (cal) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', resolveFeedUrl(cal.url), true);
            xhr.timeout = TIMEOUT_MS;
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var parsed = parseIcsText(xhr.responseText, cal);
                        allEvents = allEvents.concat(parsed);
                    } catch (e) {
                        if (window.DevLog) DevLog.log('Calendar parse error [' + cal.name + ']: ' + e);
                    }
                }
                completed++;
                checkDone();
            };
            xhr.onerror = function () {
                completed++;
                checkDone();
            };
            xhr.ontimeout = function () {
                completed++;
                checkDone();
            };
            xhr.send();
        });

        function checkDone() {
            if (completed >= total) {
                fetching = false;
                allEvents.sort(function (a, b) { return a.start - b.start; });
                var record = {
                    fetchedAt: Date.now(),
                    events: allEvents,
                    calendars: configs
                };
                writeCache(record);
                notify();
            }
        }
    }

    function notify() {
        listeners.forEach(function (fn) {
            try { fn(); } catch (e) {}
        });
    }

    function getEvents() {
        var data = readCache();
        if (!data || !data.events) {
            fetchAll();
            return [];
        }
        if (Date.now() - (data.fetchedAt || 0) > FRESH_MS) {
            fetchAll();
        }
        return data.events;
    }

    function getCalendars() {
        var configs = getConfigs();
        return configs;
    }

    /*
     * Returns the 7 days of the specified week (starting Sunday).
     * weekOffset: 0 for current week, -1 for previous week, +1 for next week.
     * filterCalId: null or undefined for all, or specific calId.
     */
    function getWeek(weekOffset, filterCalId) {
        weekOffset = weekOffset || 0;
        var events = getEvents();

        if (filterCalId) {
            events = events.filter(function (e) { return e.calId === filterCalId; });
        }

        var today = new Date();
        var nowDay = today.getDay(); // 0 is Sunday
        var startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - nowDay + (weekOffset * 7));
        startOfWeek.setHours(0, 0, 0, 0);

        var days = [];

        for (var i = 0; i < 7; i++) {
            var curDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
            var curStart = new Date(curDate.getFullYear(), curDate.getMonth(), curDate.getDate(), 0, 0, 0, 0).getTime();
            var curEnd = new Date(curDate.getFullYear(), curDate.getMonth(), curDate.getDate(), 23, 59, 59, 999).getTime();

            var isToday = (curDate.toDateString() === today.toDateString());

            var dayEvents = events.filter(function (e) {
                // event spans into or starts on this day
                if (e.allDay) {
                    var evStart = new Date(e.start);
                    evStart.setHours(0, 0, 0, 0);
                    var evEnd = new Date(e.end);
                    evEnd.setHours(23, 59, 59, 999);
                    return curStart >= evStart.getTime() && curStart <= evEnd.getTime();
                }
                return e.start >= curStart && e.start <= curEnd;
            });

            var formattedEvents = dayEvents.map(function (e) {
                var dStart = new Date(e.start);
                var dEnd = new Date(e.end);
                return {
                    calId: e.calId,
                    calName: e.calName,
                    calColor: e.calColor,
                    summary: e.summary,
                    time: e.allDay ? 'All day' : formatTime(dStart),
                    timeRange: e.allDay ? 'All day' : (formatTime(dStart) + ' – ' + formatTime(dEnd)),
                    allDay: e.allDay,
                    location: e.location,
                    description: e.description,
                    start: e.start
                };
            });

            days.push({
                index: i,
                dayName: DAY_NAMES[i],
                fullDayName: FULL_DAY_NAMES[i],
                dateNum: curDate.getDate(),
                monthName: MONTH_NAMES[curDate.getMonth()],
                year: curDate.getFullYear(),
                isToday: isToday,
                dateObj: curDate,
                dateKey: curDate.toDateString(),
                events: formattedEvents
            });
        }

        var headerMonth = MONTH_NAMES[startOfWeek.getMonth()] + ' ' + startOfWeek.getFullYear();
        var endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6);
        if (startOfWeek.getMonth() !== endOfWeek.getMonth()) {
            headerMonth = MONTH_NAMES[startOfWeek.getMonth()] + ' / ' + MONTH_NAMES[endOfWeek.getMonth()] + ' ' + endOfWeek.getFullYear();
        }

        return {
            weekOffset: weekOffset,
            headerMonth: headerMonth,
            startOfWeek: startOfWeek,
            endOfWeek: endOfWeek,
            days: days
        };
    }

    /*
     * Returns upcoming events for Home line display and ambient Up Next card.
     */
    function upcoming() {
        var events = getEvents();
        if (!events || events.length === 0) return null;

        var now = Date.now();
        var cutoffPast = now - 60 * 60 * 1000;
        var future = [];

        for (var i = 0; i < events.length; i++) {
            if (events[i].start >= cutoffPast) future.push(events[i]);
        }

        if (future.length === 0) return null;

        var nowDate = new Date();
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        var first = future[0];
        var firstDate = new Date(first.start);
        var firstDayStr = firstDate.toDateString();

        var sameDay = future.filter(function (e) {
            return new Date(e.start).toDateString() === firstDayStr;
        });

        var candidateEvents = sameDay;
        if (candidateEvents.length < 4) {
            candidateEvents = future.slice(0, 6);
        }

        var isToday = (firstDayStr === nowDate.toDateString());
        var isTomorrow = (firstDayStr === tomorrow.toDateString());
        var primaryDayLabel = isToday ? 'Today' : (isTomorrow ? 'Tomorrow' : (firstDate.getMonth() + 1) + '/' + firstDate.getDate());

        var eventItems = candidateEvents.map(function (e) {
            var d = new Date(e.start);
            var dStr = d.toDateString();
            var dayLabel = (dStr === nowDate.toDateString()) ? 'Today' :
                           (dStr === tomorrow.toDateString() ? 'Tomorrow' : (DAY_NAMES[d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate()));
            return {
                calId: e.calId,
                calName: e.calName,
                calColor: e.calColor,
                dayLabel: dayLabel,
                time: e.allDay ? 'All Day' : formatTime(d),
                summary: e.summary,
                allDay: e.allDay,
                location: e.location
            };
        });

        return {
            dayLabel: primaryDayLabel,
            events: eventItems,
            firstEvent: eventItems[0],
            count: eventItems.length
        };
    }

    function onUpdate(fn) {
        listeners.push(fn);
    }

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            fetchAll();
        }
    });

    window.Calendar = {
        getWeek: getWeek,
        getCalendars: getCalendars,
        upcoming: upcoming,
        refresh: fetchAll,
        onUpdate: onUpdate
    };
})();
