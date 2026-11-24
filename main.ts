// Solmar Bay — the entry program for the gta6-01 bounty.
// It hands the game over: everything under game/ (the playable city, plain
// static files a desktop browser loads offline) and screenshots/ go to the
// output directory, and dossier.json is written beside them for the judge.
// Node 22, standard library only; run it with MAKEFUN_OUTPUT_DIR set to
// preview the output outside the grader, e.g.:
//   MAKEFUN_OUTPUT_DIR=/tmp/gta6-out node main.ts
// Serve the game locally while building it with `node serve.ts`.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(root, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's own gates: at most four screenshots of
// 256 KiB each, at most 993 files and 48 MiB under game/, and a 1000-byte
// cap on any path under game/. Anything over is refused outright.
// Screenshots are the judge's first look: 1-start is the cover.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Solmar Bay entry written to ${outputDir}`);
