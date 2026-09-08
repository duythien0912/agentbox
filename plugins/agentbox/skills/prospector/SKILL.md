---
name: prospector
argument-hint: "[ <goal to start> | <name to resume> | list ]"
description: "Sequential keep-or-discard optimization loop for code scalars (latency, throughput, memory, binary size). Auto-proposes metric and gate, tests in isolated worktrees, and retains improvements on a review branch. Use when optimizing code scalars. Triggers on 'make X faster', 'optimize X', 'hill-climb X', 'reduce bundle size', 'lower latency'."
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Workflow
  - AskUserQuestion
---

$ARGUMENTS

<arguments>
`$ARGUMENTS` is auto-detected across three modes:

1. **empty / `list`**: Run `node <skill-dir>/scripts/list-optimizations.cjs` (`--all` for completed). Launch nothing.
2. **matches `.optimize/state/<arg>.json`**: Resume the specified run slug from its persisted ledger.
3. **arbitrary goal**: Derive a unique run name `<name> = <goalslug>-$(date -u +%Y%m%d-%H%M%S)`, auto-propose config (step 1b), confirm with user, and launch.

Artifact namespace:
```text
.optimize/
  config/<name>.json   # Approved config: metric, gate, surface, budgets
  state/<name>.json    # Durable ledger: generations, baseline, best
  <name>.js            # Conductor Workflow script
  reports/<name>.md    # Final report: baseline -> best, iterations, tokens
```

State and config persist in main repo. Edits occur exclusively on branch `opt/<name>` in `.worktrees/opt-<name>`.
</arguments>

<execution-model>
Prospector iterates against **one declared surface** (repeat-until-budget, keep-or-revert):

- **Conductor (`.optimize/<name>.js`)**: Pure JS runtime. Evaluates worker returns and decides keep/revert deterministically.
- **Workers (subagents)**: Full tools. Execute worktree setup, gate and metric runs, code edits, Git commits, and checkpoints.

Complete execution specifications reside in `references/loop-runtime.md`.
</execution-model>

<procedure>

<step n="1" name="Resolve $ARGUMENTS">
- **empty / `list`**: Run `list-optimizations.cjs` and display active runs.
- **state file exists (`.optimize/state/<arg>.json`)**: Resume via step 4 using existing configuration.
- **new goal**: Derive slug, report run identifier, execute step 1b, then step 2 and 3 upon confirmation.
- **`complete` state**: Report completion; suggest `optimize-report.cjs <name>`.
</step>

<step n="1b" name="Auto-propose metric + gate, measure baseline" note="new goals only">
Reference `references/metric-gate.md` for full derivation rules, the decline threshold, and setup prompts.

1. **Inspect repository**: Search `package.json`, `Makefile`, `bench/`, and CI configs for existing automatable commands.
Reference `references/metric-gate.md` for derivation rules, decline threshold, and setup prompts.
   ```jsonc
   {
     "goal": "<user goal>",
     "surface": "src/search/**",                         // Editable files boundary
     "metric": { "cmd": "node bench/search.mjs", "parse": "p95=([0-9.]+)", "direction": "min", "repeat": 5 },
     "gate":   { "cmd": "npm test && npm run build" },    // Zero exit required
     "budgets": {
       "evalCapSec": null,                // null -> measured during setup (~3x baseline time)
       "agentCapSec": 600,                // Timeout per propose/edit step
       "total": { "experiments": 100 },   // Cap by experiments, wallclockMin, or tokens
       "plateauStop": 15,                 // Stop after N consecutive non-improving rounds
       "maxRestarts": 0,                  // Restart search from baseline upon plateau
       "minDelta": 0.5,                   // Noise threshold floor
       "maxDiffLines": 0                  // Optional diff-size budget
     },
     "baseline": "origin/main"
   }
   ```
3. **Decline invalid goals**: Both an automatable numeric scalar and a non-gameable correctness gate are required.
4. **Measure baseline**: Run gate and metric (`metric.repeat` runs -> median). Establish `evalCapSec`.
5. **Confirm with user**: Present proposed configuration, measured baseline, and projected throughput via `AskUserQuestion`.
</step>

<step n="2" name="Generate loop conductor">
Generate the pure JS conductor from approved configuration:
```bash
node <skill-dir>/scripts/scaffold-optimize.cjs --name <name>
```
Pass the config dynamically at launch; avoid manual edits to generated files.
</step>

<step n="3" name="Launch (fresh)">
Initialize ledger state and trigger Workflow:
```bash
node -e "const fs=require('fs');fs.mkdirSync('.optimize/state',{recursive:true});const f='.optimize/state/<name>.json';if(!fs.existsSync(f))fs.writeFileSync(f,JSON.stringify({name:'<name>',status:'running',startedAt:new Date().toISOString()},null,2))"
```
```javascript
Workflow({ scriptPath: ".optimize/<name>.js", args: { config: <config JSON> } })
```
</step>

<step n="4" name="Launch (resume)">
Resume execution by passing persisted state and baseline metrics:
```javascript
Workflow({
  scriptPath: ".optimize/<name>.js",
  args: {
    config: <config/<name>.json>,
    experiments: <state.experiments>,
    best: <state.best>,
    baseline: <state.baseline>
  }
})
```
</step>

<step n="5" name="Finalize and report">
Stamp completion state and compile report:
```bash
node -e "const f='.optimize/state/<name>.json';const s=JSON.parse(require('fs').readFileSync(f,'utf8'));s.status='complete';s.finishedAt=new Date().toISOString();require('fs').writeFileSync(f,JSON.stringify(s,null,2))"
node <skill-dir>/scripts/optimize-report.cjs <name>
```
If >= 1 experiment improved upon baseline:
1. Push branch: `git -C .worktrees/opt-<name> push -u origin opt/<name>`.
2. Open pull request targeting the baseline branch with `.optimize/reports/<name>.md` as description.
3. Return pull request URL and diff pointer to user.
</step>

</procedure>

<gotchas>
Detailed rules live in `references/loop-runtime.md`:
- **Correctness floor**: Candidate changes are KEPT if and only if gate exits 0, metric strictly improves over `best` by >= `minDelta`, and surface lock holds.
- **Surface lock**: Every changed file in `git status --porcelain` must reside within `surface`. Modifications outside the boundary trigger immediate discard.
- **Clean rollback**: DISCARD executes full hard reset (`git reset --hard HEAD && git clean -fd`) within the worktree to purge invalid modifications.
- **Pure conductor**: Conductor logic must not access Node filesystem or OS APIs. Side-effects belong exclusively inside spawned workers.
</gotchas>

<resources>
- `scripts/scaffold-optimize.cjs`: Generates loop conductor script from approved config.
- `scripts/optimize-report.cjs <name>`: Produces final performance summary.
- `scripts/list-optimizations.cjs`: Displays active and historical optimization runs.
- `scripts/test-optimize.cjs`: Regression suite verifying generator output.
- `references/loop-runtime.md`: Specifications for ledger schema, keep/discard logic, and surface locks.
- `references/metric-gate.md`: Heuristics for metric extraction, gate design, and decline criteria.
</resources>
