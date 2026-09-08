---
name: loom
argument-hint: "[ <goal to start> | <name to resume> | list ]"
description: "This skill should be used to run a multi-subagent delivery workflow whose SHAPE can change — where a gate failure must send the run back to an earlier stage rather than into a local retry, and where the run should be able to add stages once it has read the code. It drives the Workflow tool with a node/edge graph the conductor interprets, validates every runtime graph patch so no path can reach the terminal without crossing every gate, re-verifies the plan (via plan-check, autofix applied) whenever an enforced gate rejects work and routes backwards, and persists the patched graph so a resume restores structure, not just progress. Launches without pre-approval by default; it can also serve the graph in a browser for a human to review and edit before launch, when asked. Do NOT use for a fixed linear pipeline (use conductor) or a quick one-shot (call Workflow directly)."
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Workflow
  - AskUserQuestion
---

$ARGUMENTS

# loom

<purpose>
`conductor` executes a fixed phase list, so every gate hand-rolls its own retry and a
failure can only be patched locally. loom makes the **graph** the execution spec: a gate
failure is an **edge** back to an earlier node, and the graph can rewrite itself at runtime
under invariants that keep every gate un-bypassable.
</purpose>

<when-to-use>
All of: multi-step with subagents; a gate failure should re-enter real work rather than a
narrow fix worker; the decomposition is not knowable up front. Otherwise use `conductor`
(fixed pipeline) or call `Workflow` directly (one-shot).

Work is sequential unless you **declare** otherwise: a `fork` node opens a **region** that
closes at the `join` it names, and inside a region an edge means *depends on* — so the region
is a real DAG. A node with two arrows in waits for both; a node with one is not held up by
unrelated work. The region must be acyclic, must have that one exit, and may not hide a
`mustCross` gate (a gate has nowhere legal to fail to in there) — put it at or after the join.
When N is only knowable at run time, a fork may declare `fanOut: { field, max }` and its
region becomes a template instantiated once per item — bounded, and the run **aborts** rather
than truncating past the bound. See `references/graph-spec.md` § *Sequential by default,
concurrent where you say so*.
</when-to-use>

<core-model>
Three layers — confusing them causes every bug in this system:
- **Graph** (`.loom/<name>.graph.json`) — nodes, conditional edges, invariants. DATA.
- **Conductor** (the generated `.js`) — several hundred lines total (`graph-core.mjs`
  **inlined** verbatim, plus the graph itself spliced in as data), but the loom-specific
  interpreter logic — everything besides the inlined math and the embedded graph — is about
  140 lines, and its `while` loop is the ~80 lines that actually walk the graph. **Pure JS: no
  `fs`, `git`, `require`, `import`, `Date.now()`, `Math.random()`, `crypto`.**
- **Workers** — the subagents it spawns. Full tools. Every side effect.

**One shared worktree** `.worktrees/<name>` on `wf/<name>` holds every edit; `state.json`
stays in the main repo.

Spec → [`references/graph-spec.md`](references/graph-spec.md).
The dominance argument → [`references/invariants.md`](references/invariants.md).
</core-model>

<procedure>

### 1. Resolve `$ARGUMENTS`

| `$ARGUMENTS` | do |
|---|---|
| empty or `list` | `node <skill-dir>/scripts/list-runs.cjs` (add `--all` to include `complete` runs), show the table, stop |
| a state file, `running`/`failed` | run `loom-report.cjs <name>` first — if its RESUME section says `NOT AVAILABLE` (the cursor is not in the stored graph, e.g. a bad patch renamed it out from under a live run), it is **not** resumable; fix the cursor or the graph before touching step 5. Otherwise **resume** → step 5 |
| a state file, `awaiting-approval` | restart the server, reopen the editor → step 3 |
| a state file, `complete` | say so; offer `loom-report.cjs <name>` |
| anything else — a goal | fresh run → step 2 |

### 2. Triage, DoD, seed

Same triage tiers as conductor — **bias down, and decline is a hard STOP.** A fixed linear
pipeline is conductor's job, not loom's; loom earns its cost only when the shape can change.

Acquire the DoD (3–7 criteria, ticket ACs verbatim), then write each `checkable` criterion's
**script** into the DoD file and freeze it:

```
node <skill-dir>/scripts/dod-freeze.mjs --dod .loom/<name>.dod.json \
  --checks-dir .loom/<name>.checks
```

Every check becomes an executable file with a frozen `sha256`. A criterion defaults to
`baseline: "red"` — **it must FAIL before the work starts**, or it cannot discriminate this
run and DoDBaseline fails the run. Use `"green-ok"` only for genuine regression guards, and
confirm that waiver in the same one-shot `AskUserQuestion` as the criteria.

Copy the seed: `scripts/seeds/lite.json` or `scripts/seeds/delivery.json` →
`.loom/<name>.graph.json`, setting `name` and `goal`.

### 3. Pre-flight — freeze always, review on request

Detailed procedures, pricing formulas, server setup, and invariant rules are documented in [`references/pre-flight.md`](references/pre-flight.md).

- **Price the graph**: Run `node <skill-dir>/scripts/graph-metrics.mjs .loom/<name>.graph.json` to inspect critical path and parallelism before execution.
- **Freeze invariants (mandatory)**: Lock all `mustCross` gate nodes and their passing out-edges (`when.eq === true`); stamp `invariants.lockedHash` and set `approved: true` (stock seeds remain zero-drift). Never lock failing out-edges.
- **Browser review (on request only)**: Launch `node <skill-dir>/scripts/graph-server.mjs --name <name> --root . --port 0` and poll `.loom/<name>.action.json` only when the user explicitly requests visual graph approval. By default, skip server launch and proceed straight to step 4.
### 4. Generate and launch

```
node <skill-dir>/scripts/scaffold-loom.cjs --name <name> \
  --graph .loom/<name>.graph.json --force
Workflow({ scriptPath: ".loom/<name>.js" })
```

**Never hand-edit the generated script** — change the generator and regenerate.

Workers default to model tiers: strong tier (`opus`, `effort: high`) for `invariants.mustCross` and `kind: "plan"`, work tier (`sonnet`) for others, or node-specified overrides. Tune with `--model-think`/`--model-work` or `--model-mode inherit`.

**Plan re-check on rejected re-entry (`--plan-check`, default `on`)**: When an enforced gate rejects work and routes backwards, the destination node runs `agentbox:plan-check` with autofix over recorded plan output before repeating work. A `NO-GO` aborts the run. Opt out with `--plan-check off`.

**Headless (`claude -p`)**: Launch in foreground (`run_in_background: false`) and do not end turn while it runs. Then confirm `status` is no longer `running` in `state.json`.

### 5. Resume

```
Workflow({ scriptPath: ".loom/<name>.js", args: {
  graph, visits, carry, trace, cursor, results } })
```

`graph`/`visits`/`carry`/`trace`/`cursor` come from `.loom/state/<name>.json` — that exact
path, never `.loom/<name>.graph.json`, which is the *approved* graph and is stale the moment
the first patch lands.

**`results` is not in that file — you assemble it.** Read every
`.loom/state/<name>/results/<key>.json` and build `{ "<key>": <that file's contents> }`. Each
node worker writes its own entry, because a conductor that re-sent every earlier result into
every checkpoint was spending ~38% of a run's tokens restating work it had already paid for.
**Skip this fold and the resume silently re-runs every completed node** — it will look like a
working resume right up to the bill.

**`args.graph` MUST be the persisted patched graph, not the seed.** Resume restores
*structure*, not just progress — replaying the approved topology silently discards every
runtime patch, and nothing will tell you it happened. `loom-report.cjs` prints this same
warning at the top of its RESUME block; the two must not drift.

### 6. Finalize

Stamp `status` + `finishedAt` in `.loom/state/<name>.json` (the conductor cannot — it has no
`fs` and no clock), `failed` if it threw. Kill the editor
server. Run `loom-report.cjs <name>` and hand over the report, the branch and the worktree.
**Never auto-merge and never auto-remove the worktree** — that is the human's call.
</procedure>

<gotchas>
- Nodes are **at-least-once** and must be **idempotent**; a re-run may return a different
  verdict and take a different edge. That is accepted.
- A rejected patch is **logged, not fatal** — check `trace` for `patch: 'rejected'`.
- `invariants.lockedHash` is FNV-1a: a **drift detector**, not a cryptographic guarantee.
  DoD `checkSha` is real sha256.
- Visit caps live only in `invariants.visitCaps`. Never add a `visitCap` field to a node.
- A dead session orphans the editor server; `list-runs.cjs` shows the stale port.
</gotchas>

<resources>
- `scripts/` — `graph-core.mjs` (all graph math; **the one source**) · `scaffold-loom.cjs`
  (step 4) · `graph-server.mjs` + `editor/` (step 3) · `dod-freeze.mjs` (step 2) ·
  `loom-report.cjs` / `list-runs.cjs` (steps 1, 6) · `test-loom.cjs` (regression net).
- `references/` — `graph-spec.md` (field reference) · `invariants.md` (why gates cannot be
  bypassed).
</resources>
