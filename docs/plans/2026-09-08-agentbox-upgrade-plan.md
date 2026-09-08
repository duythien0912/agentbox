# agentbox Comprehensive Upgrade & Implementation Plan

## 1. Executive Summary & Audit Findings
A full-repo audit of `agentbox` (18 skills, 10 agents, dual-layer marketplace) confirmed that while the fast floor regression gate and 6 generator nets pass, critical gaps undermine long-term reliability and discoverability:
1. **Eval Gaps**: 4 shipped skills (`codewalk`, `pr-writeup`, `c4-model`, `deep-understanding`) lack Tier 2 evals entirely, leaving them ungated and unimprovable by `whetstone`. 4 other skills (`plan-deck`, `feedback`, `skill-lint`, `whetstone`) lack `checks-manifest.json`.
2. **Prompt Bloat & Lint Violations**: `skill-lint` reports 15 findings, dominated by oversized skills without progressive disclosure: `lanes` (2,443 words), `whetstone` (2,088 words), and `loom` (1,708 words), significantly exceeding the 1,200-word budget.
3. **Feedback Staleness & Conductor Defects**: `feedback/conductor.jsonl` contains 8 operational defects (including resume state detachment and DoD escalated status clobbering), while other feedback files retain stale items already merged.
4. **Manifest & Discovery Drift**: Plugin manifests (`marketplace.json`, `plugin.json`) and `README.md` are out of sync with shipped reality (missing `plan-check`, `feedback`, and 3 orchestrator agents), and `prospector` retains deprecated skill-training scaffolding.

---

## 2. Parallel Workstream Architecture & Priority Matrix

Per implementation decision, the plan is structured into **4 Independent Parallel Workstreams** with **Phase 3 (Conductor Runtime Defect Fixes & Feedback Hygiene)** elevated to **Top Priority (Workstream 1)**:

```text
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               PARALLEL EXECUTION ARCHITECTURE                                        │
├────────────────────────────────────────┬──────────────────────────────────────────────────────────────┤
│ Workstream 1 (P0 - TOP PRIORITY)       │ Workstream 2 (P0 - Parallel Foundation)                      │
│ Conductor Runtime Fixes & Feedback     │ Tier 2 Eval Floors & Manifest Governance                     │
│ • SCRIPT_FINGERPRINT in generator/state│ • codewalk validator + fixtures + floor                     │
│ • Escalated status preservation        │ • pr-writeup validator + fixtures + floor                    │
│ • conductorBody quote stripping fix    │ • c4-model + deep-understanding static floors                │
│ • 2 Frozen checks with mutations       │ • checks-manifest.json registration across 4 skills          │
│ • Prune 5 feedback/*.jsonl queues      │                                                              │
├────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Workstream 3 (P1 - Parallel Stream)    │ Workstream 4 (P1 - Parallel Stream)                          │
│ Progressive Disclosure & Skill-Lint    │ Loop Consolidation & Marketplace Sync                        │
│ • lanes/references/ extraction         │ • prospector skill-train scaffolding retirement              │
│ • loom/references/pre-flight.md        │ • Move skill-train.md to whetstone references                │
│ • plan-check Markdown table refactor   │ • Sync marketplace.json & plugin.json descriptions          │
│ • feedback trigger frontmatter fix     │ • Update README.md (plan-check, feedback, 3 agents)          │
└────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FINAL UNIFIED VERIFICATION GATE                                     │
│  evals-all.mjs --fast (18/18 floors) ── 6 Generator Nets ── prove-checks (RED mutations) ── lint     │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Workstream Specifications

### Workstream 1: Conductor Runtime Fixes & Feedback Hygiene (P0 - TOP PRIORITY)
*Target skills: `conductor`, feedback queues*

#### 1.1 Conductor Script Fingerprinting (`resume-script-fingerprint`)
- **Problem**: When a run resumes via `args = { phasesDone, results }`, `scaffold-workflow.cjs` (lines 1072–1094) only validates that `phasesDone` is a contiguous prefix of `phaseOrder`. If flags or phase definitions change between runs, stale results apply to a divergent script DAG.
- **Architectural Invariant**: The Conductor Layer must remain 100% pure JS (strictly no `fs`, `git`, `require`, `Date.now()`, `Math.random()`, `crypto`). All cryptographic operations occur exclusively in the Node.js generator script (`scaffold-workflow.cjs`) at scaffold time.
- **Implementation Steps**:
  1. In `plugins/agentbox/skills/conductor/scripts/scaffold-workflow.cjs` (around line 990):
     Compute SHA-256 hash across the workflow configuration payload:
     ```javascript
     const crypto = require('crypto');
     const fingerprintPayload = JSON.stringify({
       phases: phaseOrder,
       usePlanFanout,
       modelMode,
       modelThink,
       modelWork,
       withDod: !!withDod,
       dodCriteria: dodCriteria || null,
       withTicket: !!withTicket,
       withPr: !!withPr,
       mergeGates: !!mergeGates,
       withWriteup: !!withWriteup,
       frontend: frontend || null,
       reviewPanel: !!reviewPanel,
       cycle: !!cycle,
       enforceCode: !!enforceCode,
       enforceTests: !!enforceTests,
       enforceDocs: !!enforceDocs,
     });
     const SCRIPT_FINGERPRINT = crypto.createHash('sha256').update(fingerprintPayload).digest('hex');
     ```
  2. Embed into emitted conductor source (around line 1024):
     ```javascript
     const SCRIPT_FINGERPRINT = '${SCRIPT_FINGERPRINT}'
     ```
  3. Include in `statePayload` (around line 1103):
     ```javascript
     scriptFingerprint: SCRIPT_FINGERPRINT,
     ```
  4. Include in terminal return (around line 1155):
     ```javascript
     scriptFingerprint: SCRIPT_FINGERPRINT,
     ```
  5. Add pure-JS string validation in resume entry guard (lines 1072–1094):
     ```javascript
     if (args && args.scriptFingerprint && args.scriptFingerprint !== SCRIPT_FINGERPRINT) {
       throw new Error(`Resume script fingerprint mismatch: state was generated with fingerprint '${args.scriptFingerprint}', but current script has '${SCRIPT_FINGERPRINT}'. The workflow structure or flags were modified. Start a fresh run or restore the matching script.`);
     }
     ```

#### 1.2 Escalated Status Preservation (`escalated-status-preserved`)
- **Problem**: When `DoDGate` reaches `status: 'escalated'` and throws for human adjudication, the finalize script in `references/run-planning.md` unconditionally stamps `s.status = 'failed'`, destroying the escalation marker.
- **Implementation Steps**:
  1. In `plugins/agentbox/skills/conductor/SKILL.md` (Step 1, lines 41–44):
     Update resume table:
     ```markdown
     | a state file, `escalated` | review unmet criteria / failure reason; prompt user for decision via `AskUserQuestion`, then **resume** → step 4 (do NOT regenerate) |
     | a state file, `running`/`failed` | **resume** → step 4 (do NOT regenerate with `--force`: script fingerprint must match state) |
     | a state file, `complete` | say so (offer `workflow-report.cjs <name>`); fresh run only if they meant one |
     ```
  2. In `plugins/agentbox/skills/conductor/SKILL.md` (Step 5, lines 168–174):
     Update finalize logic:
     ```markdown
     When the Workflow returns, stamp `status` + `finishedAt` (the conductor cannot) — if it threw,
     preserve `status: 'escalated'` if already persisted by the conductor (e.g. DoDGate failure or
     postmortem); stamp `failed` only if the persisted status is still `running`. Stamp `complete` on
     clean success, or `partial` when `results.coverage` holds notes.
     ```
  3. In `plugins/agentbox/skills/conductor/references/run-planning.md` (line 165):
     Update error handling bash command:
     ```bash
     node -e "const f='.workflows/state/<name>.json';const s=JSON.parse(require('fs').readFileSync(f,'utf8'));if(s.status==='running')s.status='failed';s.finishedAt=new Date().toISOString();require('fs').writeFileSync(f,JSON.stringify(s,null,2))"
     ```

#### 1.3 Conductor Net String Scan Fix (`purity-scan-quotes`)
- **Problem**: In `plugins/agentbox/skills/conductor/scripts/test-scaffold.cjs`, `conductorBody` only strips backticks (`` `...` ``), causing shell commands inside single/double quoted strings (e.g., DoD checks using `node -e "require('fs')..."`) to trigger false positives on `require(` or `fs.`.
- **Implementation**:
  Update `conductorBody` in `test-scaffold.cjs`:
  ```javascript
  function conductorBody(src) {
    const body = src.slice(src.indexOf('const NAME'));
    return body
      .replace(/`(?:[^`\\]|\\.)*`/g, '""')
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, '""');
  }
  ```
  Refresh golden snapshots via `node plugins/agentbox/skills/conductor/scripts/test-scaffold.cjs --update-snapshots`.

#### 1.4 Frozen Acceptance Checks & Mutation Proofs
Create 2 checks registered in `plugins/agentbox/skills/conductor/evals/checks-manifest.json`:
1. `plugins/agentbox/skills/conductor/evals/checks/resume-script-fingerprint.check.mjs`:
   - Generates two workflows with different flags (`--phases Work` vs `--phases Analyze,Implement`).
   - Asserts distinct fingerprints.
   - Tests that resuming with mismatched fingerprint throws mismatch error.
   - Mutations: replaces `args.scriptFingerprint !== SCRIPT_FINGERPRINT` with `false`, and removes `scriptFingerprint` from state payload.
2. `plugins/agentbox/skills/conductor/evals/checks/escalated-status-preserved.check.mjs`:
   - Validates `SKILL.md` Step 1 and Step 5 text anchors.
   - Validates `references/run-planning.md:165` contains conditional `if(s.status==='running')s.status='failed'`.
   - Mutations: replaces conditional with unconditional `s.status='failed'`, and removes escalated row from `SKILL.md`.

#### 1.5 Feedback Queue Pruning
- `feedback/conductor.jsonl`: Prune 1 resolved item (`independent-fanout-never-chosen`), keep 7 open.
- `feedback/prospector.jsonl`: Prune all 5 resolved items (`repeat-metric-measurement`, `escape-plateau-local-optima`, `live-wallclock-token-budget`, `richer-propose-failure-feedback`, `document-budget-scope`). File becomes empty.
- `feedback/sequence-diagram.jsonl`: Prune 6 resolved items, keep 2 subjective (`steplist-order-faithfulness`, `crit-step-significance`).
- `feedback/component-diagram.jsonl`: Prune 6 resolved items, keep 2 subjective (`crit-meaningful-placement`, `boundary-grouping-quality`).
- `feedback/flowchart.jsonl`: Prune 2 resolved items (`node-nonascii`, `pan-zoom-fullscreen`), keep 4 controls.

---

### Workstream 2: Tier 2 Eval Floors & Manifest Governance (P0 - Parallel Foundation)
*Target skills: `codewalk`, `pr-writeup`, `c4-model`, `deep-understanding`, `plan-deck`, `feedback`, `skill-lint`, `whetstone`*

#### 2.1 `codewalk` Validator, Fixtures & Floor
- **Headless Validator**: `plugins/agentbox/skills/codewalk/assets/validate.mjs`
  - Invariants:
    1. Zero leftover `{{...}}` tokens (`/\{\{[^}]+\}\}/g === null`).
    2. Exactly one `<h1 class="title">` (or `<h1 class="flow-title">`).
    3. TOC `<a href="#id">` matches `<section id="id">` bi-directionally and in page order.
    4. Step number badges (`.step .num`) form an unbroken sequence `1..N`.
    5. Critical highlight quota: `<= 1` critical step (`.step.critical`) and `<= 1` critical node (`.node.critical`).
    6. File:Line anchors: Every `.step` contains `<p class="loc">` matching `/[^\s:]+:\d+(?:[-–]\d+)?/`.
    7. Code excerpt: Every `.step` contains `<details class="snip">` with `<summary>` and `<pre>`.
- **Fixtures** (`plugins/agentbox/skills/codewalk/evals/fixtures/`):
  - `clean.html` (exit 0)
  - `placeholder-left.html` (exit 1)
  - `two-titles.html` (exit 1)
  - `toc-order-mismatch.html` (exit 1)
  - `step-gap.html` (exit 1)
  - `two-critical-steps.html` (exit 1)
  - `missing-loc.html` (exit 1)
- **Floor Runner & Manifest**:
  - `plugins/agentbox/skills/codewalk/evals/run.mjs`
  - `plugins/agentbox/skills/codewalk/evals/floor/structure.test.mjs`
  - `plugins/agentbox/skills/codewalk/evals/checks-manifest.json` (`{"checks": {}}`).

#### 2.2 `pr-writeup` Validator, Fixtures & Floor
- **Headless Validator**: `plugins/agentbox/skills/pr-writeup/assets/validate.mjs`
  - Invariants:
    1. Zero leftover `{{...}}` placeholders.
    2. Exactly one `<h1 class="title">`.
    3. Mandatory sections present: `#tldr`, `#files`, `#tests`.
    4. Top-level TOC links match `<section id="...">` bi-directionally; sublinks (`a.sub`) target existing element IDs.
    5. File cards (`section#files .file`): `>= 1` card, each with `<span class="path">`, `<p class="role">`, and badge (`new`, `mod`, `del`).
    6. Focus items: Sequence `1..N` with `<p class="ref">`.
    7. Test checklist: Contains `<ul class="checks">` with `>= 1` checklist item (`<li class="(done|todo|na)">`).
- **Fixtures** (`plugins/agentbox/skills/pr-writeup/evals/fixtures/`):
  - `clean.html` (exit 0)
  - `placeholder-left.html` (exit 1)
  - `duplicate-title.html` (exit 1)
  - `missing-mandatory-section.html` (exit 1)
  - `toc-sublink-orphan.html` (exit 1)
  - `focus-badge-gap.html` (exit 1)
  - `empty-tests.html` (exit 1)
- **Floor Runner & Manifest**:
  - `plugins/agentbox/skills/pr-writeup/evals/run.mjs`
  - `plugins/agentbox/skills/pr-writeup/evals/floor/structure.test.mjs`
  - `plugins/agentbox/skills/pr-writeup/evals/checks-manifest.json` (`{"checks": {}}`).

#### 2.3 `c4-model` & `deep-understanding` Static Floors
- **`c4-model`** (`plugins/agentbox/skills/c4-model/evals/`):
  - `run.mjs`
  - `floor/00-structure.test.mjs`: Asserts frontmatter triggers (`C4 diagram`, `likec4`), pinned Docker image `IMAGE="ghcr.io/likec4/likec4:1.58.0"` in `scripts/likec4.sh`, and `references/dsl.md` presence.
  - `floor/01-dsl-contract.test.mjs`: Tests static LikeC4 syntax invariants (ordering `specification` -> `model` -> `views`, mandatory `view index`, valid element/relation syntax).
  - `checks-manifest.json` (`{"checks": {}}`).
- **`deep-understanding`** (`plugins/agentbox/skills/deep-understanding/evals/`):
  - `run.mjs`
  - `floor/00-structure.test.mjs`: Asserts frontmatter triggers (`teach me`, `quiz me`), 6 required workflow phases, and anti-patterns documentation.
  - `floor/01-assets-contract.test.mjs`: Asserts 3-stage checklist structure in `assets/understanding-checklist.md` and quiz/mastery rules in `references/teaching-playbook.md`.
  - `checks-manifest.json` (`{"checks": {}}`).

#### 2.4 Manifest Registration for Floor-Only Skills
Add `evals/checks-manifest.json` (`{"checks": {}}`) to:
- `plugins/agentbox/skills/plan-deck/evals/checks-manifest.json`
- `plugins/agentbox/skills/feedback/evals/checks-manifest.json`
- `plugins/agentbox/skills/skill-lint/evals/checks-manifest.json`
- `plugins/agentbox/skills/whetstone/evals/checks-manifest.json`

---

### Workstream 3: Progressive Disclosure & Skill-Lint Cleanliness (P1)
*Target skills: `lanes`, `loom`, `plan-check`, `feedback`*

#### 3.1 `lanes` Refactor (2,443 words -> < 1,200 words)
- Create `plugins/agentbox/skills/lanes/references/`:
  - `recovery.md`: Extract Section 6 (process inspection `T`/`R`/`S`, `ps`/`lsof` recipes, signal suspension mechanics, dead-lane recovery matrices). Replace in `SKILL.md` with a concise state transition table and reference link.
  - `dod-and-gates.md`: Extract Sections 7 & 8 (`orch-lane.sh gate`, `gate-guard.sh`, `dod-freeze.mjs`). Replace in `SKILL.md` with a 4-line invocation summary and reference link.

#### 3.2 `loom` Refactor (1,708 words -> < 1,200 words)
- Create `plugins/agentbox/skills/loom/references/pre-flight.md`:
  - Extract Section 3 (DoD freezing details, browser-based editor instructions).
  - Replace in `loom/SKILL.md` with a 3-bullet execution summary linking to `pre-flight.md`.

#### 3.3 `plan-check` & `feedback` Remediation
- **`plan-check`**: Refactor prose blocks in lines 52–115 into Markdown decision tables.
- **`feedback`**: Update frontmatter description in `plugins/agentbox/skills/feedback/SKILL.md`:
  ```yaml
  description: "User-invoked only: file scrubbed, whetstone-ready feedback about a agentbox skill as a GitHub issue on duythien0912/agentbox. Triggers ONLY when user explicitly runs /feedback or agentbox:feedback. Never auto-invoked."
  ```

---

### Workstream 4: Loop Consolidation & Marketplace Sync (P1)
*Target skills: `prospector`, manifests, docs*

#### 4.1 Scope `prospector` to Objective Code Scalars
- Delete deprecated generator: `plugins/agentbox/skills/prospector/scripts/scaffold-skilltrain-config.cjs`.
- Move `plugins/agentbox/skills/prospector/references/skill-train.md` to `plugins/agentbox/skills/whetstone/references/scored-tasks.md`.
- Update `prospector/SKILL.md`: Remove `skill <name>` routing branch from arguments auto-detection; update description to focus on code scalars (perf, latency, memory, binary size).
- Update generator test net: `plugins/agentbox/skills/prospector/scripts/test-optimize.cjs`.

#### 4.2 Manifest & Documentation Synchronization
- Update `.claude-plugin/marketplace.json` and `plugins/agentbox/.claude-plugin/plugin.json`:
  ```json
  "description": "agentbox — comprehensive developer toolkit featuring 18 skills and 10 agents for architectural diagramming (C4, sequence, flowchart), automated code walkthroughs, durable orchestration (conductor, loom, lanes), and eval-gated optimization (prospector, whetstone, arena)."
  ```
- Update `README.md`:
  - Add `plan-check` and `feedback` to Skills table.
  - Add `agentbox-planner`, `agentbox-verifier`, `agentbox-builder` to Agents table.

---

## 4. Verification & Gate Protocol

| Order | Verification Gate | Command | Deterministic Success Criteria |
| :---: | :--- | :--- | :--- |
| **1** | **Regression Gate** | `node scripts/evals-all.mjs --fast` | `ran 18 floor(s), >= 101 check(s)` with 0 failures. |
| **2** | **Generator Nets** | `node scripts/evals-all.mjs` | All 6 generator test nets (`conductor`, `prospector`, `whetstone`, `loom`, `arena`, `skill-lint`) exit 0. |
| **3** | **Check Mutations** | `node scripts/prove-checks.mjs --skill conductor` | Conductor checks report `DISCRIMINATING` (RED on mutation). |
| **4** | **Skill Lint Audit** | `node plugins/agentbox/skills/skill-lint/scripts/analyze.cjs` | All 18 skills <= 1,200 words; 0 fatal warnings. |
| **5** | **Plugin Validation** | `claude plugin validate .` | Exits 0, valid marketplace & plugin schema. |

---

## 5. Risk Assessment & Invariants
1. **Conductor Layer Pure JS**: Generated conductor scripts must never import Node builtins (`fs`, `crypto`, `child_process`) or use non-deterministic functions (`Date.now`, `Math.random`). `test-scaffold.cjs` string-scans enforce this.
2. **Frozen Check Integrity**: No skill modifications land without a discriminating check and a green floor. Checks must be unproven before implementation and proven red under mutation.
3. **Rollback Boundaries**: Workstreams operate on disjoint files. Git branch/worktree isolation ensures any workstream failure can be backed out without contaminating parallel streams.