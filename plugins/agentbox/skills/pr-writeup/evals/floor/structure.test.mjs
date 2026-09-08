// FLOOR (characterization) — PASSES on the committed baseline. Locked (evals/**).
// Pins the pr-writeup report contract: validate.mjs accepts a well-formed page and
// rejects each way it can break (leftover placeholder, duplicate title, missing
// mandatory section, orphan TOC sublink, focus badge gap, empty tests checklist).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const VALIDATE = join(HERE, '..', '..', 'assets', 'validate.mjs');
const FIX = (n) => join(HERE, '..', 'fixtures', n);

function validateExit(fixture) {
  try { execFileSync('node', [VALIDATE, FIX(fixture)], { stdio: 'pipe' }); return 0; }
  catch (e) { return typeof e.status === 'number' ? e.status : 1; }
}

let failures = 0;
const ok = (cond, msg) => { if (cond) console.log(`PASS floor: ${msg}`); else { console.error(`FAIL floor: ${msg}`); failures++; } };

ok(validateExit('clean.html') === 0, 'a well-formed pr-writeup passes (exit 0)');
ok(validateExit('placeholder-left.html') === 1, 'a leftover {{placeholder}} is flagged (exit 1)');
ok(validateExit('duplicate-title.html') === 1, 'a duplicate title is flagged (exit 1)');
ok(validateExit('missing-mandatory-section.html') === 1, 'a missing mandatory section is flagged (exit 1)');
ok(validateExit('toc-sublink-orphan.html') === 1, 'an orphan TOC sublink is flagged (exit 1)');
ok(validateExit('focus-badge-gap.html') === 1, 'a gapped focus-badge sequence is flagged (exit 1)');
ok(validateExit('empty-tests.html') === 1, 'an empty test plan checklist is flagged (exit 1)');

if (failures) { console.error(`\n${failures} floor check(s) FAILED`); process.exit(1); }
console.log('\nfloor: pr-writeup report contract characterization green.');
