---
name: whetstone
argument-hint: "[ <skill to improve> | <run to resume> | init <skill> | list ]"
description: "Overnight, eval-gated skill improver. Works a fixed backlog of feedback items through a green floor and per-item discrimination-gated frozen checks on an isolated branch. Use when improving a skill against a feedback backlog. Triggers on 'improve skill', 'fix skill feedback', 'run whetstone', 'whetstone <skill>'."
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Workflow
  - AskUserQuestion
  - Task
---

$ARGUMENTS

<arguments>
`$ARGUMENTS` is auto-detected across four modes:

1. **empty / `list`**: Run `node <skill-dir>/scripts/list-improvements.cjs` (`--all` for finished). Launch nothing.
2. **`init <skill>`**: Run `node <skill-dir>/scripts/scaffold-readiness.cjs --name <skill>` to scaffold floor tests and backlog, then stop.
3. **matches `.improve/state/<arg>.json`**: Resume the specified run slug from its persisted ledger.
4. **arbitrary skill name**: Derive `<skill>`, create run slug `<run> = <skill>-$(date -u +%Y%m%d-%H%M%S)`, run setup (step 2), confirm, and launch.

Artifact namespace:
```text
.improve/
  config/<run>.json    # Approved config: skill, editable, locked, floor, items, budgets (step 2)
  state/<run>.json     # Durable ledger: items, baseline, humanOnly (references/loop-runtime.md)
  <run>.js             # Conductor Workflow script (step 2)
  reports/<run>.md     # Final report: verdicts, kept, reverted, unresolved (step 4)
feedback/<skill>.jsonl # Shared input backlog keyed by skill
```

Main repository retains config and state. Edits occur exclusively on branch `improve/<run>` inside `.worktrees/improve-<run>`.
</arguments>

<execution-model>
Whetstone iterates against a **fixed backlog** (repeat-until-backlog-done, binary keep-or-revert):

- **Conductor (`.improve/<run>.js`)**: Pure JS runtime. Iterates backlog items and decides keep/revert deterministically. Must not perform filesystem, Git, or network I/O.
- **Workers (subagents)**: Full-tool units. Execute worktree setup, floor and check runs, skill edits, Git commits, and ledger checkpoints.

Detailed constraints reside in `references/loop-runtime.md`.
</execution-model>

<procedure>

<step n="1" name="Resolve $ARGUMENTS">
- **empty / `list`**: Display active runs via `list-improvements.cjs`.
- **`init <skill>`**: Scaffold readiness suite and exit.
- **state file exists (`.improve/state/<arg>.json`)**: Resume via step 3.
- **new run**: Establish run slug `<run>`, execute step 2, and launch upon confirmation.
</step>

<step n="2" name="Setup — draft, discriminate, freeze checks, confirm, and launch">
Reference `references/checks.md` for check drafting rules, discrimination gates, and floor requirements.

1. **Read backlog**: Load `feedback/<skill>.jsonl`. Partition into verifiable items and human-only concerns.
2. **Draft failing checks**: Dispatch `agentbox-test-writer` to author runnable `*.test.mjs` checks under `<skill>/evals/` for verifiable concerns.
3. **Discrimination gate**: Prove each check fails on unmodified baseline (`node <skill-dir>/scripts/check-baseline.cjs "<check>"` must report `DISCRIMINATING`). Reject or strengthen non-discriminating checks.
4. **Measure baseline floor**: Run `<skillPath>/evals/run.mjs` on baseline; floor must pass (exit 0).
5. **Confirm with user**: Present drafted checks, human-only items, and execution caps via `AskUserQuestion`.
6. **Freeze config (`.improve/config/<run>.json`)**:
   ```jsonc
   {
     "skill": "<skill>", "skillPath": "<skillPath>",
     "editable": "<skillPath>/**",
     "locked": ["<skillPath>/evals/**", "feedback/<skill>.jsonl"],
     "floor": { "cmd": "node <skillPath>/evals/run.mjs" },
     "items": [ { "id": "...", "type": "concern", "text": "...", "acceptanceCheck": "node <skillPath>/evals/<id>.test.mjs" } ],
     "budgets": { "agentCapSec": 600, "checkRetries": 2, "total": { "items": 1 } },
     "baseline": "origin/main"
   }
   ```
7. **Generate loop conductor**:
   ```bash
   node <skill-dir>/scripts/scaffold-improve.cjs --name <run>
   ```
8. **Launch fresh**: Stamp ledger state and trigger Workflow:
   ```bash
   node -e "const fs=require('fs');fs.mkdirSync('.improve/state',{recursive:true});const f='.improve/state/<run>.json';if(!fs.existsSync(f))fs.writeFileSync(f,JSON.stringify({name:'<run>',skill:'<skill>',status:'running',startedAt:new Date().toISOString()},null,2))"
   ```
   ```javascript
   Workflow({ scriptPath: ".improve/<run>.js", args: { config: <config JSON> } })
   ```
</step>

<step n="3" name="Launch (resume)">
Resume execution passing persisted state and baseline metrics:
```javascript
Workflow({
  scriptPath: ".improve/<run>.js",
  args: {
    config: <config/<run>.json>,
    items: <state.items>,
    baseline: <state.baseline>
  }
})
```
</step>

<step n="4" name="Finalize and report">
Stamp completion state and generate report:
```bash
node -e "const f='.improve/state/<run>.json';const s=JSON.parse(require('fs').readFileSync(f,'utf8'));s.status='complete';s.finishedAt=new Date().toISOString();require('fs').writeFileSync(f,JSON.stringify(s,null,2))"
node <skill-dir>/scripts/improve-report.cjs <run>
```
If >= 1 item was KEPT:
1. Push branch: `git -C .worktrees/improve-<run> push -u origin improve/<run>`.
2. Open pull request into the baseline branch with `.improve/reports/<run>.md` as body.
3. Return pull request URL and diff pointer to user.
</step>

</procedure>

<gotchas>
Detailed rules live in `references/loop-runtime.md` and `references/checks.md`:
- **Correctness floor**: A fix is KEPT if and only if baseline floor passes, the frozen check passes, and surface lock holds.
- **Surface lock**: Changed paths must match `editable` and avoid `locked` (`evals/**` and `feedback/*.jsonl`). Locked modifications trigger immediate revert.
- **Deterministic conductor**: The conductor script executes pure JS only; all I/O and process execution occur in workers.
</gotchas>

<resources>
- `scripts/scaffold-improve.cjs`: Generates loop conductor script from approved config.
- `scripts/improve-report.cjs <name>`: Compiles summary report across processed items.
- `scripts/list-improvements.cjs`: Displays active and historical improvement runs.
- `scripts/check-baseline.cjs`: Validates that drafted checks fail on baseline (discrimination gate).
- `scripts/scaffold-readiness.cjs`: Initializes floor tests and feedback backlog for a target skill.
- `references/checks.md`: Guidelines for check authoring, discrimination gating, and floor validation.
- `references/loop-runtime.md`: Specifications for ledger schema, keep/revert decisions, and surface locks.
</resources>
