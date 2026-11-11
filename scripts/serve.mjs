// Serves src/ for desktop preview. Arrow keys + Enter navigate, Esc/Backspace = Back.
import { createServer } from 'node:http';
import { readFile, writeFile, access } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'src');

// index.html always loads the gitignored local overrides; make sure there is something to load.
const localConfig = join(root, 'js', 'config.local.js');
try {
    await access(localConfig);
} catch {
    await writeFile(localConfig, '/* No local overrides. See config.local.example.js. */\n');
}
const port = Number(process.env.PORT) || 8080;
const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml'
};

createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);

    // Development proxy for Google Calendar iCal to bypass desktop browser CORS:
    if (path === '/api/calendar') {
        const https = await import('node:https');
        const calUrl = 'https://calendar.google.com/calendar/ical/vnjok0el4dkicvbv6nc1afijes%40group.calendar.google.com/private-941ae3036bc9c1b3d819209bb26d3750/basic.ics';
        https.get(calUrl, (cRes) => {
            res.writeHead(cRes.statusCode, {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-store'
            });
            cRes.pipe(res);
        }).on('error', () => {
            res.writeHead(502).end('Calendar fetch error');
        });
        return;
    }

    const file = normalize(join(root, path === '/' ? 'index.html' : path));
    if (!file.startsWith(root)) {
        res.writeHead(403).end();
        return;
    }
    try {
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(body);
    } catch {
        res.writeHead(404).end('Not found');
    }
}).listen(port, '127.0.0.1', () => {
    console.log(`Preview: http://localhost:${port}`);
});
