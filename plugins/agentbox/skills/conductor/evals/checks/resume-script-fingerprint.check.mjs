// ACCEPTANCE CHECK: resume-script-fingerprint
// Generates two workflows with different flags (--phases Work vs --phases Analyze,Implement).
// Asserts distinct fingerprints, and asserts that resuming with mismatched fingerprint throws mismatch error.
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { generate, parses, runBody } from './body-harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(HERE, '..', '..');
const REPO = resolve(SKILL_DIR, '..', '..', '..', '..');
const GEN = process.env.GEN_OVERRIDE || resolve(SKILL_DIR, 'scripts', 'scaffold-workflow.cjs');
const TMP = mkdtempSync(join(tmpdir(), 'resume-fp-check-'));

const promptsFile = join(TMP, 'prompts.json');
writeFileSync(promptsFile, JSON.stringify({
  Work: 'Do work',
  Analyze: 'Analyze task',
  Implement: 'Implement task',
}));

const results = [];
const ok = (pass, label) => { results.push({ pass, label }); console.log(`${pass ? 'PASS' : 'FAIL'}: ${label}`); };
const bail = (code, msg) => { console.error(msg); rmSync(TMP, { recursive: true, force: true }); process.exit(code); };

let runA, runB;
try {
  runA = generate({ gen: GEN, repo: REPO, tmp: TMP, name: 'wfa', argv: ['--phases', 'Work', '--prompts-file', promptsFile] });
  runB = generate({ gen: GEN, repo: REPO, tmp: TMP, name: 'wfb', argv: ['--phases', 'Analyze,Implement', '--prompts-file', promptsFile] });
} catch (e) {
  bail(2, `PRECONDITION FAILED: generation threw — ${e.message}`);
}

if (runA.code !== 0 || !parses(runA.file) || runB.code !== 0 || !parses(runB.file)) {
  bail(2, `PRECONDITION FAILED: generation failed or does not parse\nA: ${runA.code} B: ${runB.code}`);
}
console.log('PASS: 0. precondition — both workflows generate and parse cleanly');

const srcA = readFileSync(runA.file, 'utf8');
const srcB = readFileSync(runB.file, 'utf8');

const fpMatchA = srcA.match(/const SCRIPT_FINGERPRINT = '([a-f0-9]{64})'/);
const fpMatchB = srcB.match(/const SCRIPT_FINGERPRINT = '([a-f0-9]{64})'/);

ok(!!fpMatchA && !!fpMatchA[1], '1. workflow A defines SCRIPT_FINGERPRINT constant');
ok(!!fpMatchB && !!fpMatchB[1], '2. workflow B defines SCRIPT_FINGERPRINT constant');

const fpA = fpMatchA ? fpMatchA[1] : '';
const fpB = fpMatchB ? fpMatchB[1] : '';

ok(fpA !== fpB && fpA.length === 64 && fpB.length === 64, '3. distinct workflow configurations yield distinct 64-char sha256 fingerprints');

// Execute workflow A fresh to inspect checkpoint payload
const freshExec = await runBody(srcA, () => undefined, {});
ok(!freshExec.error, '4. fresh run of workflow A completes without error');

const cp = freshExec.checkpoints.find((c) => c.label.startsWith('checkpoint:'));
ok(!!cp && cp.payload.scriptFingerprint === fpA, '5. checkpoint state payload includes scriptFingerprint matching SCRIPT_FINGERPRINT');
// Resume workflow A with matching fingerprint -> succeeds
const matchResume = await runBody(srcA, () => undefined, { scriptFingerprint: fpA, phasesDone: ['Setup'] });
ok(!matchResume.error, '6. resume with matching scriptFingerprint succeeds');

// Resume workflow A with mismatched fingerprint -> throws
const mismatchResume = await runBody(srcA, () => undefined, { scriptFingerprint: fpB, phasesDone: ['Setup'] });
const isMismatchErr = !!mismatchResume.error && /Resume script fingerprint mismatch/.test(mismatchResume.error.message);
ok(isMismatchErr, '7. resume with mismatched scriptFingerprint throws descriptive mismatch error');

rmSync(TMP, { recursive: true, force: true });

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error(`\nFAIL: ${failed.length} of ${results.length} assertions failed`);
  process.exit(1);
}
console.log(`\ncheck GREEN: script fingerprinting and resume mismatch validation passed (${results.length}/${results.length})`);
process.exit(0);
