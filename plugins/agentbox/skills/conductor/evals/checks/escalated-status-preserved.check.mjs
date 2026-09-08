// ACCEPTANCE CHECK: escalated-status-preserved
// Validates that escalated status is preserved on resume and finalize,
// and not clobbered with unconditional 'failed'.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(HERE, '..', '..');

const SKILL_MD = process.env.SKILL_MD_OVERRIDE || resolve(SKILL_DIR, 'SKILL.md');
const RUN_PLANNING = process.env.RUN_PLANNING_OVERRIDE || resolve(SKILL_DIR, 'references/run-planning.md');

if (!existsSync(SKILL_MD)) {
  console.error(`PRECONDITION FAILED: SKILL.md not found at ${SKILL_MD}`);
  process.exit(2);
}
if (!existsSync(RUN_PLANNING)) {
  console.error(`PRECONDITION FAILED: run-planning.md not found at ${RUN_PLANNING}`);
  process.exit(2);
}

const skillMdContent = readFileSync(SKILL_MD, 'utf8');
const runPlanningContent = readFileSync(RUN_PLANNING, 'utf8');

const results = [];
const ok = (pass, label) => { results.push({ pass, label }); console.log(`${pass ? 'PASS' : 'FAIL'}: ${label}`); };

// 1. SKILL.md Step 1 contains dedicated row for escalated status
const hasEscalatedRow = skillMdContent.includes(
  '| a state file, `escalated` | review unmet criteria / failure reason; prompt user for decision via `AskUserQuestion`, then **resume** → step 4 (do NOT regenerate) |'
);
ok(hasEscalatedRow, '1. SKILL.md Step 1 dedicates explicit row to escalated status advising AskUserQuestion');

// 2. SKILL.md Step 1 running/failed row forbids --force
const hasRunningFailedRow = skillMdContent.includes(
  '| a state file, `running`/`failed` | **resume** → step 4 (do NOT regenerate with `--force`: script fingerprint must match state) |'
);
ok(hasRunningFailedRow, '2. SKILL.md Step 1 running/failed row forbids --force to maintain script fingerprint');

// 3. SKILL.md Step 5 preserves escalated status
const hasPreserveEscalated = skillMdContent.includes(
  "preserve `status: 'escalated'` if already persisted by the conductor"
);
ok(hasPreserveEscalated, '3. SKILL.md Step 5 instructs preserving persisted escalated status');

// 4. SKILL.md Step 5 stamps failed only if running
const hasStampFailedOnlyIfRunning = skillMdContent.includes(
  "stamp `failed` only if the persisted status is still `running`"
);
ok(hasStampFailedOnlyIfRunning, '4. SKILL.md Step 5 instructs stamping failed only if persisted status is still running');

// 5. run-planning.md error handler conditionally stamps failed
const hasConditionalStatusFailed = runPlanningContent.includes(
  "if(s.status==='running')s.status='failed'"
);
ok(hasConditionalStatusFailed, "5. run-planning.md finalize command conditionally sets status='failed' only when status is running");

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error(`\nFAIL: ${failed.length} of ${results.length} assertions failed`);
  process.exit(1);
}
console.log(`\ncheck GREEN: escalated status preservation verified (${results.length}/${results.length})`);
process.exit(0);
