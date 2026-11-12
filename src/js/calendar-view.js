/*
 * Skylight-Style Dayboard View controller.
 *
 * Provides a 7-day family agenda overview with:
 * - D-pad TV remote navigation (◄ ► between days, ▲ ▼ between filters & event tray).
 * - Multi-calendar filter pills (Everyone / Person 1 / Person 2).
 * - Day columns highlighting "Today" and listing color-coded event chips.
 * - Bottom detail tray displaying full time range, calendar badge, and location.
 */
(function () {
    'use strict';

    function $(id) { return UI.$(id); }
    function el(tag, cls, txt) { return UI.el(tag, cls, txt); }

    var state = {
        weekOffset: 0,
        activeFilter: null, // null = Everyone
        selectedDayIndex: new Date().getDay(), // 0..6
        selectedEvent: null
    };

    function renderFilters() {
        var container = $('cal-filters');
        if (!container) return;
        container.innerHTML = '';

        var calendars = window.Calendar ? window.Calendar.getCalendars() : [];

        // "Everyone" pill
        var allPill = el('button', 'cal-filter-pill' + (state.activeFilter === null ? ' active' : ''));
        allPill.innerHTML = '<span class="pill-dot" style="background:#ffffff"></span><span>Everyone</span>';
        allPill._item = { kind: 'filter', id: null };
        allPill.onclick = function () { onActivate(this._item); };
        container.appendChild(allPill);

        calendars.forEach(function (c) {
            var pill = el('button', 'cal-filter-pill' + (state.activeFilter === c.id ? ' active' : ''));
            pill.innerHTML = '<span class="pill-dot" style="background:' + c.color + '"></span><span>' + c.name + '</span>';
            pill._item = { kind: 'filter', id: c.id };
            pill.onclick = function () { onActivate(this._item); };
            container.appendChild(pill);
        });

        // Prev, Today, Next buttons
        var navGroup = el('div', 'cal-nav-group');
        var prevBtn = el('button', 'cal-nav-btn', '◀');
        prevBtn._item = { kind: 'nav', action: 'prev' };
        prevBtn.onclick = function () { onActivate(this._item); };

        var todayBtn = el('button', 'cal-nav-btn' + (state.weekOffset === 0 ? ' current' : ''), 'Today');
        todayBtn._item = { kind: 'nav', action: 'today' };
        todayBtn.onclick = function () { onActivate(this._item); };

        var nextBtn = el('button', 'cal-nav-btn', '▶');
        nextBtn._item = { kind: 'nav', action: 'next' };
        nextBtn.onclick = function () { onActivate(this._item); };

        navGroup.appendChild(prevBtn);
        navGroup.appendChild(todayBtn);
        navGroup.appendChild(nextBtn);
        container.appendChild(navGroup);
    }

    function renderDetail(day, event) {
        var shelf = $('cal-detail-shelf');
        if (!shelf) return;
        shelf.innerHTML = '';

        if (!day) return;

        var header = el('div', 'detail-header');
        var dayTitle = el('span', 'detail-day-title', day.fullDayName + ', ' + day.monthName + ' ' + day.dateNum);
        var countTag = el('span', 'detail-count-tag', (day.events.length) + (day.events.length === 1 ? ' event' : ' events'));
        header.appendChild(dayTitle);
        header.appendChild(countTag);
        shelf.appendChild(header);

        var cardsList = el('div', 'detail-cards-list');

        if (day.events.length === 0) {
            var empty = el('div', 'detail-empty', 'No scheduled events for this day');
            cardsList.appendChild(empty);
        } else {
            day.events.forEach(function (ev) {
                var card = el('div', 'detail-card' + (event === ev ? ' focused-event' : ''));
                var stripe = el('div', 'card-stripe');
                stripe.style.background = ev.calColor;
                card.appendChild(stripe);

                var body = el('div', 'card-body');
                var topRow = el('div', 'card-top');
                var summary = el('div', 'card-summary', ev.summary);
                topRow.appendChild(summary);

                var badge = el('span', 'card-cal-badge', ev.calName);
                badge.style.borderColor = ev.calColor;
                badge.style.color = ev.calColor;
                topRow.appendChild(badge);
                body.appendChild(topRow);

                var metaRow = el('div', 'card-meta');
                var time = el('span', 'card-time', ev.timeRange);
                metaRow.appendChild(time);

                if (ev.location) {
                    var locSep = el('span', 'meta-sep', '·');
                    var loc = el('span', 'card-location', ev.location);
                    metaRow.appendChild(locSep);
                    metaRow.appendChild(loc);
                }
                body.appendChild(metaRow);

                card.appendChild(body);
                card._item = { kind: 'detail-event', event: ev };
                card.onclick = function () { onActivate(this._item); };
                cardsList.appendChild(card);
            });
        }

        shelf.appendChild(cardsList);
    }

    function renderDayboard() {
        if (!window.Calendar) return;
        var week = window.Calendar.getWeek(state.weekOffset, state.activeFilter);
        if (!week) return;

        $('cal-header-title').textContent = 'The week ahead';
        $('cal-header-subtitle').textContent = week.headerMonth;

        renderFilters();

        var board = $('cal-dayboard');
        board.innerHTML = '';

        week.days.forEach(function (day, idx) {
            var isSelected = (idx === state.selectedDayIndex);
            var col = el('div', 'day-col' + (isSelected ? ' selected' : '') + (day.isToday ? ' is-today' : ''));
            col._item = { kind: 'day', dayIndex: idx, day: day };
            col.onclick = function () { onActivate(this._item); };

            var colHead = el('div', 'col-head');
            var dayLabel = el('div', 'col-day-name', day.dayName);
            var dateBadge = el('div', 'col-date-num', '' + day.dateNum);
            colHead.appendChild(dayLabel);
            colHead.appendChild(dateBadge);
            col.appendChild(colHead);

            var eventStack = el('div', 'col-events');
            if (day.events.length === 0) {
                var clearText = el('div', 'col-clear', 'Clear');
                eventStack.appendChild(clearText);
            } else {
                day.events.slice(0, 4).forEach(function (ev) {
                    var chip = el('div', 'event-chip');
                    chip.style.borderLeftColor = ev.calColor;
                    var title = el('div', 'chip-title', ev.summary);
                    var time = el('div', 'chip-time', ev.time);
                    chip.appendChild(title);
                    chip.appendChild(time);
                    eventStack.appendChild(chip);
                });
                if (day.events.length > 4) {
                    var more = el('div', 'chip-more', '+' + (day.events.length - 4) + ' more');
                    eventStack.appendChild(more);
                }
            }
            col.appendChild(eventStack);
            board.appendChild(col);
        });

        var activeDay = week.days[state.selectedDayIndex] || week.days[0];
        renderDetail(activeDay, state.selectedEvent);
    }

    function onActivate(item) {
        if (!item) return;
        if (item.kind === 'filter') {
            state.activeFilter = item.id;
            renderDayboard();
            UI.refresh();
        } else if (item.kind === 'nav') {
            if (item.action === 'prev') state.weekOffset--;
            else if (item.action === 'next') state.weekOffset++;
            else if (item.action === 'today') {
                state.weekOffset = 0;
                state.selectedDayIndex = new Date().getDay();
            }
            renderDayboard();
            UI.refresh();
        } else if (item.kind === 'day') {
            state.selectedDayIndex = item.dayIndex;
            state.selectedEvent = (item.day.events && item.day.events[0]) || null;
            renderDayboard();
            UI.refresh();
        }
    }

    function init() {
        UI.register('calendar', {
            el: $('calendar'),
            hints: [['◄ ►', 'Day'], ['OK', 'Select'], ['Back', 'Home']],
            rows: function () {
                var filterRow = Array.prototype.slice.call($('cal-filters').querySelectorAll('button'));
                var dayCols = UI.children($('cal-dayboard'));
                var detailRow = Array.prototype.slice.call($('cal-detail-shelf').querySelectorAll('.detail-card'));
                return [filterRow, dayCols, detailRow];
            },
            startRow: 1,
            onShow: function () {
                renderDayboard();
            },
            onFocus: function (target) {
                if (target && target._item && target._item.kind === 'day') {
                    state.selectedDayIndex = target._item.dayIndex;
                    var week = window.Calendar ? window.Calendar.getWeek(state.weekOffset, state.activeFilter) : null;
                    if (week && week.days[state.selectedDayIndex]) {
                        var cols = $('cal-dayboard').children;
                        for (var i = 0; i < cols.length; i++) {
                            cols[i].classList.toggle('selected', i === state.selectedDayIndex);
                        }
                        renderDetail(week.days[state.selectedDayIndex], null);
                    }
                }
            },
            activate: onActivate,
            onBack: function () {
                UI.show('home');
                return true;
            }
        });

        if (window.Calendar) {
            window.Calendar.onUpdate(function () {
                if (UI.isVisible('calendar')) renderDayboard();
            });
        }
    }

    window.CalendarView = {
        init: init,
        render: renderDayboard
    };
})();
