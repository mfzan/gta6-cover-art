// Vice Cover Maker — a gta6-cover-art-01 entry (Node 22, standard
// library only).
//
// The app is this directory's app/ folder: plain static files a
// desktop browser loads offline (app/index.html and its ES modules,
// no library and no network request). It turns a person's photos and
// a caption into a three-panel GTA-style poster cover — hero panel
// plus two small panels, a sunset or neon colour grade, halftone
// dots, and bold outlined caption lettering — exported as a PNG in
// 1080 x 1080, 1080 x 1350 or 1920 x 1080.
//
// This program hands the app in: it copies app/ and screenshots/
// from beside this file to /output and writes /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open
// http://localhost:8080. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, checked here so a bad bundle never goes up:
// at most 4 screenshots, each at most 256 KiB; app/ at most 993
// files and 48 MiB in all; /output at most 1000 entries and 64 MiB.
const MAX_SHOTS = 4;
const MAX_SHOT_BYTES = 256 * 1024;
const MAX_APP_FILES = 993;
const MAX_APP_BYTES = 48 * 1024 * 1024;

const shotDir = join(here, 'screenshots');
if (!existsSync(shotDir)) throw new Error('screenshots/ is missing');
const shots = readdirSync(shotDir).filter((n) => !n.startsWith('.'));
if (shots.length < 3 || shots.length > MAX_SHOTS) {
  throw new Error(`screenshots/ holds ${shots.length} images, need 3 or 4`);
}
for (const name of shots) {
  const size = statSync(join(shotDir, name)).size;
  if (size > MAX_SHOT_BYTES) {
    throw new Error(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
  }
}

const appDir = join(here, 'app');
let appFiles = 0;
let appBytes = 0;
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else { appFiles++; appBytes += st.size; }
  }
})(appDir);
if (appFiles > MAX_APP_FILES || appBytes > MAX_APP_BYTES) {
  throw new Error(`app/ is ${appFiles} files / ${appBytes} bytes, over the gate caps`);
}

mkdirSync(out, { recursive: true });
cpSync(appDir, join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotDir, join(out, 'screenshots'), { recursive: true });

// The scorer's caps: only text_max_bytes shapes the bytes; the rest
// refuse an entry the scorer would refuse.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

// Confirm the handover is complete before the grader reads it.
const outShots = readdirSync(join(out, 'screenshots')).filter((n) => !n.startsWith('.'));
if (outShots.length !== shots.length) throw new Error('screenshots did not copy');
if (!existsSync(join(out, 'dossier.json'))) throw new Error('dossier.json was not written');
