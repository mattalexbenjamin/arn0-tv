# Skylight Family Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed a lightweight, TV remote-navigable Skylight-style family calendar ("Dayboard") into Arn0 Launcher supporting multiple Google Calendar feeds, custom color tags, and an ambient "Up Next" idle card.

**Architecture:** Extend `calendar.js` to fetch and parse multiple Google Calendar iCal feeds concurrently into a unified event index tagged by source and color. Build a dedicated zero-bloat vanilla DOM view (`#calendar` registered in `UI`) providing a 7-day column Dayboard with D-pad focus traversal, day highlight pills, and an expanded event detail tray. Embed an ambient "Up Next" preview card into the launcher's clock/idle screen.

**Tech Stack:** Vanilla JavaScript (ES5/ES6 baseline compatible with Tizen Chromium 85), CSS Grid/Flexbox, iCalendar (`.ics`) RFC 5545 parser, HTML5 DOM.

**Spec:** Reddit reference implementation: `r/appletv/comments/1xuhitc/i_built_a_free_skylightstyle_family_calendar_that/` and user provided mockups.

## Global Constraints

- Zero external JS libraries (no React, Vue, moment.js, date-fns, or FullCalendar); total new JavaScript must remain under 20 KB.
- Full compatibility with Samsung Tizen Chromium 85 (no `aspect-ratio`, no `color-mix()`, no `:has()`).
- 60 fps remote D-pad navigation across columns and event pills using `UI.register`.
- Multi-calendar feeds loaded asynchronously and cached in `localStorage` (`arn0.skylight.v1`) for instant (0ms) render on startup.
- Impeccable UI craftsmanship: luminous focus halos, micro-press depressions, tabular numbers, subtle frosted glass acrylics, and color-coded event accents.

## Review Focus

1. **Overlapping and all-day events:** All-day events must display cleanly at the top of day columns without displacing timed events.
2. **Network failure or slow feed:** If one or all calendar feeds fail or timeout, the UI must gracefully display cached events or an unobtrusive offline state rather than breaking the view.
3. **Remote D-pad navigation:** Navigating left/right across day columns and up/down between header filter pills and event lists must never lose focus or trap the cursor.
4. **Timezone consistency:** All events across multiple calendars must correctly align to the TV's configured local timezone (e.g. America/New_York).
5. **Back button behavior:** Pressing remote `Back` / `Esc` inside the Calendar view must smoothly return focus to the Home screen without re-fetching or flickering.

---

### Task 1: Multi-Calendar Configuration & Feed Aggregator

**Files:**
- Modify: `src/js/config.js`
- Modify: `src/js/config.local.js`
- Modify: `src/js/calendar.js`
- Modify: `scripts/serve.mjs`

- [ ] **Step 1: Define multi-calendar data structure in config**
  Update `config.js` and `config.local.js` to accept `calendars: [{ name, color, url }]` while maintaining backward compatibility with legacy single `calendarUrl`.

- [ ] **Step 2: Update local development proxy in `scripts/serve.mjs`**
  Enhance `/api/calendar` in `scripts/serve.mjs` to accept `?url=<encoded_url>` query parameter so that any number of Google Calendar iCal feeds can be tested in local browser preview without CORS blocks.

- [ ] **Step 3: Implement parallel feed fetching and normalized event aggregation in `src/js/calendar.js`**
  Refactor `calendar.js` to fetch all configured calendars in parallel, parse each `VEVENT`, tag each entry with `calendarName` and `color`, merge them, sort chronologically, and cache them in `localStorage['arn0.skylight.v1']`.

- [ ] **Step 4: Expose range queries in `Calendar` API**
  Add `Calendar.getRange(startDate, endDate, activeCalendarFilter)` and `Calendar.getWeek(startDate, activeCalendarFilter)` returning 7-day day structures with sorted event lists.

- [ ] **Step 5: Verify multi-calendar parsing with node test script**
  Run an automated Node script that parses both single and multi-calendar feeds and confirms output structure.

- [ ] **Step 6: Commit changes**
  `git commit -m "feat(calendar): support multi-calendar aggregation and range queries"`

---

### Task 2: Skylight "Dayboard" HTML Structure & DOM Architecture

**Files:**
- Modify: `src/index.html`
- Modify: `src/js/home.js`

- [ ] **Step 1: Add `#calendar` view container in `src/index.html`**
  Create `<section id="calendar" class="view page hidden">` containing:
  - Top header: Title ("The week ahead" / Month Year), filter pills container (`#cal-filters`), and week navigation buttons (`< Today >`).
  - Main Dayboard grid: `#cal-dayboard` with 7 day columns (`Sun` through `Sat`).
  - Active day detail shelf: `#cal-detail-shelf` showing selected day's expanded event cards.

- [ ] **Step 2: Make Home screen UPCOMING badge interactive**
  Update `#home-cal` in `src/index.html` and `src/js/home.js` so clicking or selecting the upcoming pill with remote `Enter` triggers `UI.show('calendar')`. Add remote hint `['▲', 'Calendar']` or clickable action.

- [ ] **Step 3: Register `calendar` view in `UI.register`**
  In `src/js/calendar-view.js` (or `home.js`), register view `'calendar'` with remote D-pad rows:
  - Row 0: Filter pills & week navigation (`Today`, `Prev`, `Next`).
  - Row 1: The 7 day columns.
  - Row 2: Selected day event cards.
  - Back key returns to `'home'`.

- [ ] **Step 4: Commit changes**
  `git commit -m "feat(calendar): add Dayboard HTML view and register in UI router"`

---

### Task 3: Dayboard UI Craftsmanship & Impeccable Styling

**Files:**
- Modify: `src/css/style.css`

- [ ] **Step 1: Dayboard layout & columns grid**
  Style `#cal-dayboard` using CSS Grid with 7 columns. Each column styled as a sculpted frosted acrylic card with day header (e.g. `TUE 10`), rounded status highlight for Today, and scrollable event chip stack.

- [ ] **Step 2: Event chips & color-coded indicator bars**
  Style individual event chips with vertical left color strips corresponding to their calendar/member color, clean typography (`14px`/`16px` font weight 600, tabular times, and event summary).

- [ ] **Step 3: Luminous focus halos & micro-press interactions**
  Add high-contrast focus rings (`box-shadow: 0 0 0 2.5px rgba(255,255,255,0.95), 0 16px 36px rgba(0,0,0,0.6)`) and active `.pressed` animations matching the rest of the impeccable launcher theme.

- [ ] **Step 4: Selected day detail tray**
  Style the bottom detail tray showing full title, calendar badge, start/end time range, and location with zero overflow or awkward wrapping.

- [ ] **Step 5: Verify visual hierarchy in desktop preview**
  Inspect layout at 1920x1080 resolution to verify contrast, safe zones, and typography.

- [ ] **Step 6: Commit changes**
  `git commit -m "style(calendar): implement Skylight Dayboard aesthetic and TV focus styles"`

---

### Task 4: Ambient "Up Next" Card on Idle / Screensaver

**Files:**
- Modify: `src/js/screensaver.js`
- Modify: `src/css/style.css`
- Modify: `src/index.html`

- [ ] **Step 1: Add ambient "Up Next" floating card to screensaver DOM**
  Insert `#ss-up-next` card into `#screensaver` in `src/index.html` with badge (`UP NEXT`), event title, calendar/source tag, and time.

- [ ] **Step 2: Bind live calendar updates to screensaver**
  In `src/js/screensaver.js`, populate `#ss-up-next` with the next upcoming event from `Calendar.upcoming()` whenever screensaver awakens or photo changes.

- [ ] **Step 3: Style floating ambient card**
  Style with dark translucent frosted glass (`rgba(15, 18, 25, 0.85)`), crisp typography, color bar, and subtle burn-in drift along with the clock.

- [ ] **Step 4: Commit changes**
  `git commit -m "feat(screensaver): add ambient Up Next card to idle screen"`

---

### Task 5: Build, Package & TV Verification

**Files:**
- Modify: `dist/arn0-launcher.wgt`

- [ ] **Step 1: Run complete build**
  Execute `npm run build` using `scripts/build.mjs` and `scripts/zip.ps1`.

- [ ] **Step 2: Verify package contents and POSIX forward slashes**
  Check that all new files (`calendar-view.js` or updated files) are cleanly packaged inside `dist/arn0-launcher.wgt`.

- [ ] **Step 3: Test navigation and rendering in preview server**
  Verify D-pad controls (Arrow keys + Enter + Esc) in browser preview (`http://localhost:8080`).

- [ ] **Step 4: Final commit and push**
  `git push origin main`

