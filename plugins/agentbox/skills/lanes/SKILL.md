---
name: lanes
description: "Use when work runs across external agent processes that outlive your session — several herdr panes or worktrees in flight, a gate that must not be bypassed under time pressure, a lane that has gone quiet, or an orchestrator picking up a run it did not start. Not for subagents inside one session: that is conductor (fixed pipeline) or loom (reshapeable graph)."
---

# lanes

<purpose>
`conductor` and `loom` drive the **Workflow** tool: a generated pure-JS conductor walks a graph and
spawns **subagents inside one session**. `lanes` is a different execution model.

| | conductor / loom | lanes |
|---|---|---|
| who transitions | generated JS, from a boolean | a **live orchestrator agent**, using judgment, recording why |
| what a worker is | subagent inside the session, dies with it | a **whole process** — own pane, worktree, context, any harness |
| the loop | the JS program; needs a live session | the orchestrator, which can be replaced mid-run |
| on death | re-run the phase | **re-attach** to a still-running pane, redispatch, or retry-whole |

Re-attachability is the point. Everything else here exists to make it safe.
</purpose>

<honesty>
**loom's gates are structural. Ours are procedural.**

loom's conductor is pure JS without `fs`. Our orchestrator has Bash and can edit files.

- **`transition.mjs` PREVENTS** illegal moves for callers using the door.
- **`reconcile.mjs` DETECTS** unrecorded moves by recomputing state from evidence artifacts and diffing against recorded state.

Run `reconcile.mjs` before believing the board, especially before publishing.
</honesty>

<core-model>
Three things, and confusing them is where the bugs are:

- **Lane** — one unit of work owned by one external agent process. It writes JSON files. Nothing else.
- **Store** — append-only JSON artifacts under `<run>/`, read through DuckDB views. Embedded, no
  daemon, no ingestion step: `read_json_auto` is a *view over the files*, so the store cannot drift
  from the artifacts and lanes stay harness-neutral.
- **Orchestrator** — you. You decide transitions, you record why, and you are the only caller of
  `transition.mjs`. **Lanes never touch the store.** The `agentbox-herdr-orchestrator` agent is this
  role written down; it carries the store contract and calls these scripts. Dispatch it, or be it.

```
<run>/
  dispatch/*.json      one record per lane: how to find it again
  evidence/*.json      one record per artifact: report | verification | commit | publish
  decisions/*.json     {fork, options[], chosen, reason, would_overturn}
  transitions.jsonl    append-only, written ONLY by transition.mjs
```

A file may hold one record or an array of them — a live lane appends its own file; a seeded run
ships one array. Both read identically.

**Evidence is never written by hand.** `scripts/evidence.mjs` computes trusted values (`gated_sha`, `merged_sha`, `verified_sha`, `build_exit`, `gate_passed`). Reviewers cannot self-report exit codes.
</core-model>

<states>
```
proposed → planned → dispatched → reported → verified → durable → published
blocked-on-user | blocked-on-task | blocked-on-agent | wedged | dead
```

`durable` is committed state, reachable from `reported` without `verified`.

**Two transitions are strictly refused:**
1. `reported → verified`: Requires verification artifact whose `produced_by` differs from `agent_name` (no self-reports).
2. `→ published`: Requires `verified` in history.

**Verify before you commit.** Only `durable → published` publishes, and there is no `verified → published` edge. Committing first is legal but costs a re-entry: `reported → durable → verified → durable → published`.

`wedged` is distinct from `dead`. `ctrl+c` via `pane send-keys` frees a wedge (`wedged → dispatched`). A dead lane needs replacement (`dead → dispatched`).
</states>

<procedure>

### 1. Dispatch — record how to find the lane again

A herdr agent's **session id changes when its pane is cleared; its name does not.** Re-attach
matches on **name**. Write one `dispatch/<lane>.json` per lane before the agent starts:

```json
{ "lane": "fix", "agent_name": "lane-fix", "role": "implementor", "harness": "claude",
  "tier": "strong", "pane_id": "wV:pF", "workspace_id": "wV",
  "worktree": "/abs/path/to/worktree", "branch": "merge-msn-20260812",
  "sha_at_dispatch": "9610e31", "task": "...", "contract": "/abs/path/to/CRITERIA.md" }
```

`tier` is the only model knob. There is no routing layer and there will not be one.

Then `transition.mjs --to planned`, `--to dispatched`. **Two agents editing one file collide
regardless of branch** — concurrent lanes need disjoint files or a worktree each.

### 2. Move state — only through the door

```
node ${CLAUDE_PLUGIN_ROOT}/skills/lanes/scripts/transition.mjs --root <run> --lane <id> --to <state> --reason "..."
```

Exit 0 appends the row; exit 1 prints why and writes nothing. **Never append to
`transitions.jsonl` yourself.** If the door refuses you, the refusal is the finding — do not route
around it.

### 3. Record the fork, not the choice

```json
{ "fork": "...", "options": ["...", "..."], "chosen": "...", "reason": "...",
  "would_overturn": "..." }
```

**`would_overturn` is the field that makes resume work, not `chosen`.** A replacement orchestrator
can act on *"overturned if any of the 33 covers behaviour that survives P-1"*. It cannot act on
*"chose option 1"*.

### 4. Read the board

```
duckdb -c "SET VARIABLE r='<run>'" -c ".read ${CLAUDE_PLUGIN_ROOT}/skills/lanes/scripts/views.sql" \
       -c "SELECT * FROM board"
```

`board.verified_by` is NULL unless some agent **other than** the implementor produced a verification
artifact. That is the column a Done column cannot fake. Views: `dispatch`, `evidence`, `decisions`,
`transitions`, `board`.

### 5. Reconcile before you believe it

```
node ${CLAUDE_PLUGIN_ROOT}/skills/lanes/scripts/reconcile.mjs --root <run>
```

Exit 0 clean, exit 1 drift. It also flags an evidence record whose file no longer exists. The stuck
states leave no artifact, so they report `UNVERIFIABLE` rather than clean — stated, not hidden.

Run it before every publish and after every orchestrator handover.

### 6. Recover a lane

Detailed diagnostic recipes, signal handling, and recovery matrices are in [`references/recovery.md`](references/recovery.md).

| symptom | state | move |
|---|---|---|
| pane alive, context and cost still climbing | working | leave it |
| counters flat, process state `T` | stopped (records as `wedged`) | `kill -CONT <pid>` — `ctrl+c` cannot land on a stopped process |
| counters flat, process state `R`/`S` | `wedged` | `ctrl+c` via `pane send-keys`, then `orch-lane.sh restart`, then `wedged → dispatched` |
| no `agent_status` at all | `dead` | `orch-lane.sh restart <lane> --run <slug>` — same pane, same checkout, profile re-applied; then `dead → dispatched` |

```
ps -o pid=,stat=,command= -A | grep "[o]pencode --agent" | awk '$2 ~ /T/'
```
### 7. Gate the work before it leaves

Detailed gate mechanics, `gate-guard.sh` hooks, and audit escapes are in [`references/dod-and-gates.md`](references/dod-and-gates.md).

- Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/orch-lane.sh gate <lane> --run <slug>` to review code, fix Critical/High issues, and build.
- Pass condition requires `gate_passed && build_exit == 0` produced by an independent verifier.
- `gate-guard.sh` intercepts `git push`, `gh pr create`, and `git merge`, blocking branches lacking passing gate evidence or a `durable` state record.

### 8. DoD, if the run needs one

Detailed DoD freezing, hashing, and gating rules are in [`references/dod-and-gates.md`](references/dod-and-gates.md).

- Freeze checks: `node ${CLAUDE_PLUGIN_ROOT}/skills/loom/scripts/dod-freeze.mjs --dod <run>/dod.json --checks-dir <run>/checks`.
- Locks sha256 checksums of all test commands before implementation begins.
- `gate-guard.sh` prevents PR creation until an `evidence/` record with `kind: "dod_gate"` reports `all_passed: true`.
</procedure>
## Gotchas
<gotchas>
- **A green check that cannot fail is the dominant defect class here.** Before a lane's evidence
  counts, its red arm must have gone red on a *value*. A criterion whose check passes at baseline
  discriminates nothing.
- A test with no timeout that awaits an event does not fail — it **hangs**, and the lane looks busy.
- `transition.mjs` refusing is not a bug to work around. It is the only part of this that holds.
- `reconcile.mjs` cannot see intent. It answers "do the artifacts support this state", nothing more.
- **Never auto-merge, never auto-push.** That is the human's call, always.
</gotchas>

<not-built>
Deliberately absent: a browser graph editor (loom has one), model routing beyond `tier`, and
anything that merges or pushes on its own. Also out of this cut: deriving parallel-safe fork regions
from graphify touch-sets — the right next step, but the skeleton has to survive the death test first.
</not-built>
## Resources
<resources>
- `scripts/transition.mjs` — Sanctioned state writer (`TABLE`, `check`, `loadRun`, `stateOf`, `ctxFor`).
- `scripts/reconcile.mjs` — Recompute state from artifacts, diff against store.
- `scripts/triage.mjs` — Verify sizing protocol.
- `scripts/evidence.mjs` — Sanctioned writer of `evidence/` (`gate`, `report`, `verify`).
- `scripts/views.sql` — DuckDB views (`board`, `dispatch`, `evidence`, etc.).
- `scripts/test-transitions.mjs` — Tests matrix transitions.
- `assets/example-run/` — Historical test fixture.
</resources>
