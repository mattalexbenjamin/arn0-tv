# Arn0 TV Launcher (Custom Fork)

A fast, peaceful, and privacy-respecting dashboard for Samsung Tizen TVs: an ambient clock, live weather, an upcoming calendar stock ticker, a full Skylight-style 7-day family Dayboard, a row of your apps, a row of your consoles, and an idle screensaver — built with zero external runtime dependencies and tuned for locked 60 fps performance on TV hardware.

![The launcher on the "Milky Way" wallpaper, showing the clock, calendar ticker, apps row and consoles row](docs/preview.png)

*The browser preview, showing the ambient clock with weather, the scrolling calendar ticker, and Apple TV–style responsive tiles.*

---

## What's in this Fork

This fork builds upon the minimal foundation of Arn0 Launcher to add family scheduling, an Apple TV–inspired fluid interaction feel, and cross-platform developer tooling, all while preserving the original design philosophy: zero telemetry, zero bloat, remote-first control, and strictly measured performance on low-power TV hardware.

### Key Additions & Implementations

1. **Continuous 60 fps Event Stock Ticker (Home Screen)**
   - Displays upcoming events directly in the Home screen header beside the clock.
   - Smooth, hardware-accelerated horizontal marquee animation displaying the calendar color badge, relative day tag (`TODAY`, `TOMORROW`, `SAT`, etc.), formatted time, and event title.
   - Automatically pauses on hover or when navigating focus to the upcoming pill.
   - Pressing **OK** opens the full 7-day Dayboard view.

2. **Skylight-Style 7-Day Family Dayboard (`#calendar`)**
   - A dedicated full-screen family agenda overview inspired by Skylight and digital wall calendars.
   - **Multi-Calendar Filter Bar**: Toggle between "Everyone" and individual family members or calendar categories with color-coded dot badges.
   - **Week Navigation**: Quick buttons for Previous Week (◀), Jump to Today, and Next Week (▶).
   - **7-Day Grid**: Highlights the current day, displays day names, dates, and color-coded event chips with start times.
   - **Interactive Detail Shelf**: Navigating down opens a horizontal card list with full event descriptions, location, start/end duration, and calendar source tags.
   - **TV Remote Navigation**: Fully controllable via D-pad (◄ / ► to move between days or cards, ▲ / ▼ to jump between filters, grid, and detail shelf).

3. **Multi-Calendar iCal Integration (`src/js/calendar.js`)**
   - Direct support for Google Calendar, Apple iCloud, Outlook, Skylight, or any standard `.ics` / iCal subscription URLs.
   - **Intelligent Event Windowing**: Filters events to a 14-day past through 90-day future window during ICS parsing, preventing multi-year calendar archives from consuming memory or stalling the TV's CPU.
   - **Dual Caching**: Persists to `localStorage` for instant cold boots and uses an in-memory cache (`memCache`) to avoid synchronous JSON parsing during ticker animation and clock ticks.
   - **Dev Proxy**: `scripts/serve.mjs` includes an integrated proxy (`/api/calendar?url=...`) with redirect support (up to 4 hops) to bypass browser CORS during local desktop preview.

4. **Apple TV / tvOS Interaction Feel**
   - Snappy 160 ms `cubic-bezier(0.16, 1, 0.3, 1)` transforms on focused tiles, settings rows, and cards.
   - Eliminated animated `box-shadow` and full-screen view scaling to prevent GPU VRAM exhaustion and layout thrashing on Tizen's Mali GPU.
   - **Refined Synthesized Audio**: Apple TV–style Web Audio sound effects featuring smooth sine wave ticks with exponential decay, frequency-ramped confirm sounds (`select`), and boundary indicators (`edge`).

5. **Screensaver with "Up Next" Card Overlay**
   - Ambient 4K wallpaper screensaver featuring smooth drift panning and automatic wallpaper cycling.
   - Includes an **Up Next** calendar card positioned cleanly in the lower corner without colliding with the drifting clock, date, or weather indicators.
   - Dynamic burn-in protection: clock and weather periodically rotate corner positions.

6. **Cross-Platform Node.js Build System (`scripts/build.mjs`)**
   - Replaced shell/bash zip dependencies with a pure Node.js packaging script.
   - Builds compliant Tizen `.wgt` packages with POSIX forward slashes directly on Windows, macOS, and Linux via `npm run build`.

---

## Try the Interface (Desktop Preview)

Needs Node.js 20 or newer. No TV is involved, and nothing is installed on your system.

```sh
git clone https://github.com/<you>/arn0-tv.git
cd arn0-tv
npm run preview        # http://localhost:8080
```

Navigate with the keyboard:
- **Arrow Keys**: Navigate focus across apps, consoles, calendar items, and settings.
- **Enter / OK**: Select / launch / open details.
- **Esc / Backspace**: Back (returns to Home from any view).
- **R / G / Y / B**: TV remote colour keys (Red = All Apps, Green = Next Wallpaper, Yellow = System Apps toggle, Blue = Lab diagnostic screen).
- **Direct URLs**: `#calendar`, `#all`, `#settings`, or `#lab` open those screens directly in the preview.

The preview runs against [`src/js/tizen-mock.js`](src/js/tizen-mock.js), simulating Tizen APIs so all layout, remote navigation, calendar parsing, audio synthesis, and wallpaper cycles behave exactly like on TV.

---

## Configuration

### 1. Tracked Defaults (`src/js/config.js`)
Configures default apps, console inputs, HDMI switching behavior, and locale.

### 2. Local Overrides (`src/js/config.local.js`)
Anything specific to your household — personal calendar URLs, weather coordinates, devlog IP — belongs in `src/js/config.local.js`. This file is gitignored and merged one level deep over `config.js` at runtime, ensuring sensitive URLs stay out of version control while baking cleanly into both the desktop preview and the `.wgt` package.

Copy the example file to get started:
```sh
cp src/js/config.local.example.js src/js/config.local.js
```

Example `src/js/config.local.js`:

```javascript
window.LAUNCHER_LOCAL = {
    // Weather coordinates (Open-Meteo, no API key required)
    weather: {
        latitude: 40.71,
        longitude: -74.00,
        unit: 'fahrenheit' // 'fahrenheit' | 'celsius'
    },

    // Multi-calendar setup (Google Calendar, iCloud, Outlook, Skylight iCal feeds)
    calendars: [
        {
            name: 'Family',
            color: '#38bdf8', // Light blue
            url: 'https://calendar.google.com/calendar/ical/.../basic.ics'
        },
        {
            name: 'Personal',
            color: '#34d399', // Emerald green
            url: 'https://calendar.google.com/calendar/ical/.../basic.ics'
        },
        {
            name: 'Work',
            color: '#fbbf24', // Amber
            url: 'https://outlook.office365.com/owa/calendar/.../reachcalendar.ics'
        }
    ],

    // Navigation sound
    sound: {
        enabled: true,
        preset: 'apple' // 'apple' | 'soft' | 'warm' | 'bright'
    }
};
```

---

## Remote Control Guide

| Key | Home Screen | Dayboard Calendar (`#calendar`) |
| :--- | :--- | :--- |
| **▲ / ▼** | Move between Calendar/Settings header, Apps row, and Consoles row | Move between Filter Pills, Day Grid, and Detail Cards |
| **◄ / ►** | Move horizontally along app and console tiles | Move between days or detail cards |
| **OK / Enter** | Open focused app or switch HDMI input. On header: opens Dayboard Calendar | Select calendar filter, jump week, or inspect card |
| **Back / Esc** | No action on Home | Returns to Home screen |
| **Red** | Open **All Apps** grid | Open **All Apps** grid |
| **Green** | Cycle to next wallpaper | Cycle to next wallpaper |
| **Yellow** | In All Apps: toggle hidden system apps | In All Apps: toggle hidden system apps |
| **Blue** | Open **Lab** diagnostic probe | Open **Lab** diagnostic probe |

*Easter Egg*: Alternating Left and Right three times on Home (◀ ▶ ◀ ▶ ◀ ▶) launches the hidden 2D runner game.

---

## Put it on a TV

See **[docs/setup-tv.md](docs/setup-tv.md)** for detailed, step-by-step instructions on packaging, installing the widget, and optionally redirecting the TV's native Home button.

### Quick Build & Deploy
1. **Package the widget**:
   ```sh
   npm run build
   # Outputs -> dist/arn0-launcher.wgt
   ```
2. **Install to TV**:
   Using the Tizen Studio CLI:
   ```sh
   tizen install -n arn0-launcher.wgt -t <Your-TV-Target-Name> -- dist
   ```
   Or install via **Apps2Samsung** on your local network.

### Reference Hardware
- **Model**: Samsung Q70B (QE65Q70BATXXC, 2022)
- **OS**: Tizen 6.5 (Chromium 85, 4-core ARM Cortex-A72/A53, 2 GB RAM)
- **Target Resolution**: Native 1920×1080 stage

---

## Project Structure

```
src/
  config.xml                Tizen package manifest (app ID, privileges)
  index.html                Full DOM structure (Home, Calendar, All Apps, Settings, Screensaver)
  css/style.css             1920x1080 layout, typography, Apple TV animations, and hardware rules
  fonts/                    Bundled OFL webfonts (Manrope, Inter, Outfit, DM Sans)
  img/
    marks/                  Brand mark SVG sources
    tiles/                  Generated recoloured brand SVGs
    wallpapers/             Optimized 1080p wallpapers with pre-baked readability scrims
  js/
    appearance.js           Clock formatting, 12/24h toggle, date formatting
    apps.js                 Tizen application querying, filtering, and launching
    boot.js                 Initialization order and aspect-ratio scaling
    brands.js               Brand colors, marks, and matcher regexes
    calendar.js             iCal parser, multi-feed fetcher, in-memory cache, event windowing
    calendar-view.js        Skylight-style 7-day Dayboard view controller & D-pad navigation
    config.js               Default configuration
    config.local.example.js Template for gitignored local settings
    devlog.js               In-app development logger
    home.js                 Home screen controller, ticker animation, app row setup
    inputs.js               HDMI port detection and switching logic
    platform-probe.js       Tizen API capability inspector (Lab screen)
    prefs.js                Persistent TV preferences in localStorage
    render-probe.js         Real-time hardware FPS and frame-drop benchmark (Lab screen)
    runner-game.js          Hidden retro runner mini-game
    screensaver.js          Idle screensaver, wallpaper drift, Up Next card, and weather
    settings.js             TV settings menus
    sound.js                Low-latency Web Audio sound synthesizer (Apple TV preset)
    tizen-mock.js           Browser simulation mock for Tizen APIs
    ui.js                   Core view manager, focus tracker, remote key handler
    wallpaper.js            Wallpaper loader and transition manager
    wallpapers.js           Wallpaper catalog and metadata
    weather.js              Open-Meteo client and caching
scripts/
  build.mjs                 Cross-platform widget packager (pure Node.js)
  build-marks.mjs           Generates recoloured SVGs from brand marks
  devlog-server.mjs         Local server to receive logs from the TV (npm run devlog)
  prepare-wallpapers.mjs    Crops photos and bakes readability gradients at build time
  serve.mjs                 Desktop preview server with iCal CORS proxy (npm run preview)
docs/
  setup-tv.md               Complete Samsung TV installation and Home-button redirect guide
```

---

## TV Hardware Constraints & Architecture Rules

Performance on Samsung Tizen Smart TVs is heavily constrained by shared memory architectures and mobile GPUs. Through empirical measurements using the built-in Lab render probe, this project adheres to strict architectural rules:

1. **Only Animate Hardware-Composited `transform` and `opacity`**
   - Animating `box-shadow` forces multi-pass Gaussian blur rasterization on the CPU per frame, dropping frame rates from 60 fps to under 20 fps. Static blurred box shadows are hardware-cached and free; never include `box-shadow` in a CSS `transition`.
2. **Never Use CSS Masks on Continuous Animations**
   - CSS `mask-image` on an actively animating element (such as the Home event ticker) forces Chromium 85 to re-composite alpha mask buffers on every 16.6 ms frame.
3. **Bake Gradients at Build Time**
   - Live full-screen radial or linear gradients behind the UI drop frame rates to 4.6 fps. Readability scrims are baked directly into wallpaper JPEGs by `scripts/prepare-wallpapers.mjs`.
4. **Avoid `will-change` on Static Full-Screen Containers**
   - Pinned `will-change: transform` on static 1080p elements (`#stage`, `#bg`) forces persistent 32-bit GPU texture allocations (~16 MB uncompressed VRAM), starving the browser process. On native 1920×1080 displays, `#stage` receives no transform.
5. **In-Memory Cache & Time Bounds for iCal Feeds**
   - TV storage I/O is slow. Reading and stringifying multi-megabyte `localStorage` entries on every clock tick causes noticeable input lag. Feeds are windowed to -14 days / +90 days, parsed once, and cached in memory.

---

## Licence and Credits

- **Original Project**: MIT License by [arn0](https://github.com/arn0/arn0-tv).
- **Home Button Technique**: Follows research from [CleanFrame](https://github.com/nthnclrk/CleanFrame).
- **Weather**: Powered by [Open-Meteo](https://open-meteo.com/) (non-commercial terms).
- **Icons**: [Simple Icons](https://simpleicons.org/) (CC0) and [Custom Brand Icons](https://github.com/lukas-h/custom-brand-icons) (MIT).
- **Fonts**: Manrope, Inter, Outfit, DM Sans under the SIL Open Font License (OFL).
- **Wallpapers**: Curated from Unsplash (photographer credits display when cycling wallpapers with Green).

*This project is an independent custom fork and is not affiliated with Samsung Electronics, Google, Apple, or any streaming provider.*
