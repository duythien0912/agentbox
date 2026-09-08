// FLOOR (characterization) — PASSES on the committed baseline. Locked (evals/**).
// Pins the codewalk report contract: validate.mjs accepts a well-formed page and
// rejects each way it can break (leftover placeholder, duplicate title, TOC order
// mismatch, step gap, multiple critical steps, missing loc anchor).
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

ok(validateExit('clean.html') === 0, 'a well-formed codewalk passes (exit 0)');
ok(validateExit('placeholder-left.html') === 1, 'a leftover {{placeholder}} is flagged (exit 1)');
ok(validateExit('two-titles.html') === 1, 'a duplicate title is flagged (exit 1)');
ok(validateExit('toc-order-mismatch.html') === 1, 'a TOC/section order mismatch is flagged (exit 1)');
ok(validateExit('step-gap.html') === 1, 'a gapped step-badge sequence is flagged (exit 1)');
ok(validateExit('two-critical-steps.html') === 1, 'more than one critical step is flagged (exit 1)');
ok(validateExit('missing-loc.html') === 1, 'a missing or invalid loc anchor is flagged (exit 1)');

if (failures) { console.error(`\n${failures} floor check(s) FAILED`); process.exit(1); }
console.log('\nfloor: codewalk report contract characterization green.');
