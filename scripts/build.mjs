import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'src');
const dist = resolve(root, 'dist');
const wgt = resolve(dist, 'arn0-launcher.wgt');

// 1. Icon
if (!existsSync(resolve(src, 'icon.png'))) {
    execFileSync(process.execPath, [resolve(root, 'scripts/make-icon.mjs')], { stdio: 'inherit' });
}

// 2. Config local stub if absent
const configLocal = resolve(src, 'js/config.local.js');
if (!existsSync(configLocal)) {
    writeFileSync(configLocal, '/* No local overrides. See config.local.example.js. */\n');
}

// 3. Brand tiles
execFileSync(process.execPath, [resolve(root, 'scripts/build-marks.mjs')], { stdio: 'inherit' });

// 4. Create dist directory
mkdirSync(dist, { recursive: true });
const zipPath = resolve(dist, 'arn0-launcher.zip');
if (existsSync(wgt)) rmSync(wgt);
if (existsSync(zipPath)) rmSync(zipPath);

// 5. Package .wgt (Standard PKZIP format with End of Central Directory)
const isWindows = process.platform === 'win32';

if (isWindows) {
    const ps1 = resolve(root, 'scripts/zip.ps1');
    execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}" -SourceDir "${src}" -OutputFile "${wgt}"`,
        { stdio: 'inherit' }
    );
} else {
    try {
        execSync(
            `zip -q -r -X "${wgt}" . -x '*.DS_Store' -x '.*' -x 'img/marks/*' -x 'img/easter-egg/*'`,
            { cwd: src, stdio: 'ignore' }
        );
    } catch (e) {
        execSync(
            `zip -q -r "${wgt}" .`,
            { cwd: src, stdio: 'ignore' }
        );
    }
}

if (existsSync(wgt)) {
    console.log(`Successfully built dist/arn0-launcher.wgt`);
} else {
    console.error('Failed to build .wgt package');
    process.exit(1);
}

