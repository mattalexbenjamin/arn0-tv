/* App listing, filtering and launching on top of tizen.application. */
(function () {
    'use strict';

    // Samsung's `show` flag still lets many services through (e.g. ep-dataservice-app).
    // Store apps have ids like "AbCdEfGhIj.Name"; a few consumer apps ship preinstalled with system ids.
    var STORE_ID = /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/;
    var NUMERIC_ID = /^\d{9,13}$/;
    var PRELOADED = [
        'org.tizen.netflix-app', 'org.tizen.primevideo', 'org.tizen.apple.apple-music',
        'org.tizen.browser', 'com.samsung.tv.aria-video', 'com.samsung.tv.cobalt-yt',
        '3201412000524', '3201512006785', '3201901017640', '3201606009684',
        '3201601007250', '3201907018809', '3202008021877'
    ];
    var INTERNAL = [
        'adplatform.ADPlayer', 'WykOS4t4F0.cmsWebApp', '25emanual3.emanual',
        'ZODRT12q2l.WebAccountExtension', 'ByJlgt0XeD.CastSettingsApp', 'tv6pbVMQFF.PrivacyChoices',
        '2022ePop01.SmartTV', 'w2VwCK465D.OTApp', 'J9fZJDMi1v.SecurityCenter'
    ];
    var NOISE = /service|worker|preview|promotion|plugin|launcher|test|sdk|^ep[ -]|factory|daemon|dummy|agent|e-?manual|account|adplayer|privacy|security/i;

    function withTimeout(promise, ms, what) {
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () { reject(new Error(what + ': the TV did not respond')); }, ms);
            promise.then(function (v) { clearTimeout(timer); resolve(v); },
                function (e) { clearTimeout(timer); reject(e); });
        });
    }

    function selfAppId() {
        try {
            return tizen.application.getCurrentApplication().appInfo.id;
        } catch (e) {
            return null;
        }
    }

    function getInstalledApps() {
        return withTimeout(new Promise(function (resolve, reject) {
            tizen.application.getAppsInfo(resolve, reject);
        }), 8000, 'App list');
    }

    function launch(appId) {
        return withTimeout(new Promise(function (resolve, reject) {
            tizen.application.launch(appId, resolve, reject);
        }), 8000, 'Launch');
    }

    function launchWithFallback(item, apps) {
        var ids = [];
        if (item.id) ids.push(item.id);
        if (Array.isArray(item.ids)) {
            item.ids.forEach(function (id) {
                if (ids.indexOf(id) < 0) ids.push(id);
            });
        }
        if (apps && item.label) {
            var target = (item.label || '').trim().toLowerCase();
            apps.forEach(function (a) {
                if ((a.name || '').trim().toLowerCase() === target && ids.indexOf(a.id) < 0) {
                    ids.push(a.id);
                }
            });
        }

        function tryNext(index) {
            if (index >= ids.length) {
                return Promise.reject(new Error('App not found on TV: ' + (item.label || item.id)));
            }
            return launch(ids[index]).catch(function (err) {
                if (index + 1 < ids.length) {
                    return tryNext(index + 1);
                }
                throw err;
            });
        }

        return tryNext(0);
    }

    function isConsumer(app) {
        if (PRELOADED.indexOf(app.id) >= 0) return true;
        if (!app.show || INTERNAL.indexOf(app.id) >= 0) return false;
        if (!STORE_ID.test(app.id) && !NUMERIC_ID.test(app.id) && !/^com\.[a-z0-9_-]+\.[a-z0-9_.-]+$/i.test(app.id)) return false;
        return !NOISE.test(app.name + ' ' + app.id);
    }

    // Everything launchable with a name, minus ourselves. Curated entries match against this,
    // so any app can still be pinned by id even if the consumer filter hides it.
    function launchable(apps) {
        var self = selfAppId();
        var seen = {};
        return apps.filter(function (a) {
            if (!a.name || a.id === self || seen[a.id]) return false;
            seen[a.id] = true;
            return true;
        });
    }

    function curated(apps, cfg) {
        var used = {};
        var out = [];
        (cfg.apps || []).forEach(function (entry) {
            var re = entry.match ? new RegExp(entry.match, 'i') : null;
            var ids = [];
            if (entry.id) ids.push(entry.id);
            if (Array.isArray(entry.ids)) ids = ids.concat(entry.ids);

            var candidates = apps.filter(function (a) {
                if (used[a.id]) return false;
                if (ids.indexOf(a.id) >= 0) return true;
                return !!(re && (re.test(a.id) || re.test(a.name)));
            });

            // Prioritize candidates:
            // 1. Matches one of entry.ids
            // 2. Exact name match with entry.label
            // 3. Consumer app over internal/service
            candidates.sort(function (a, b) {
                var aInIds = ids.indexOf(a.id) >= 0 ? 1 : 0;
                var bInIds = ids.indexOf(b.id) >= 0 ? 1 : 0;
                if (aInIds !== bInIds) return bInIds - aInIds;

                var aExact = (a.name || '').trim().toLowerCase() === (entry.label || '').trim().toLowerCase() ? 1 : 0;
                var bExact = (b.name || '').trim().toLowerCase() === (entry.label || '').trim().toLowerCase() ? 1 : 0;
                if (aExact !== bExact) return bExact - aExact;

                var aCons = isConsumer(a) ? 1 : 0;
                var bCons = isConsumer(b) ? 1 : 0;
                return bCons - aCons;
            });

            var app = candidates[0];
            if (app) {
                used[app.id] = true;
                out.push(toItem(app, entry));
            }
        });
        return out;
    }

    function allSorted(apps, showEverything) {
        return apps
            .filter(function (a) { return showEverything ? a.show : isConsumer(a); })
            .map(function (a) { return toItem(a, {}); })
            .sort(function (x, y) { return x.label.localeCompare(y.label); });
    }

    // Store names often carry a tagline: "Spotify - Music and Podcasts", "TF1+ : Streaming, …"
    function shortName(name) {
        return name.split(/\s+[-:|–]\s+/)[0].trim() || name;
    }

    function toItem(app, entry) {
        return {
            kind: 'app',
            id: app.id,
            ids: entry.ids || (entry.id ? [entry.id] : []),
            label: entry.label || shortName(app.name),
            brand: entry.brand ? findBrand(entry.brand) : findBrand(app),
            iconPath: app.iconPath || ''
        };
    }

    function describe(app) {
        return {
            id: app.id, name: app.name, show: app.show, packageId: app.packageId,
            categories: app.categories ? Array.prototype.slice.call(app.categories) : [],
            iconPath: app.iconPath, version: app.version, consumer: isConsumer(app)
        };
    }

    window.Apps = {
        getInstalledApps: getInstalledApps,
        launchable: launchable,
        curated: curated,
        allSorted: allSorted,
        describe: describe,
        launch: launch,
        launchWithFallback: launchWithFallback,
        withTimeout: withTimeout
    };
})();
