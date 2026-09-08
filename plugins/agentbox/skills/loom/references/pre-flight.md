# Loom Pre-flight Reference

Detailed procedures for graph pricing, interactive browser editing, and the invariant freeze.

## 1. Price the graph

Run graph metrics to check the critical path and expected parallelism before launch:

```bash
node <skill-dir>/scripts/graph-metrics.mjs .loom/<name>.graph.json
```

- **Critical path**: Longest chain of sequential workers. Measured against emitted conductor code, critical path times average node duration predicts wall-clock runtime within 1–3%.
- **Parallelism**: A score of `1.00` indicates sequential execution with no wall-clock speedup from loom. If sequential nodes are independent, wrap them in a `fork` region to cut runtime to the longest branch.
- **Bounds**: `invariants.maxCriticalPath` optionally bounds critical path length, analogous to `nodeBudget` for node counts.

## 2. Interactive review (on request only)

Serve the visual graph editor only if the user explicitly requests to review or edit the shape before running:

```bash
node <skill-dir>/scripts/graph-server.mjs --name <name> --root . --port 0
```

1. Read `LOOM_SERVER_PORT=<port>` from stdout and record in `.loom/state/<name>.json`.
2. Provide the user `http://127.0.0.1:<port>` and set `status: "awaiting-approval"`.
3. Poll `.loom/<name>.action.json`:
   - `replan` -> Run a replan worker over `(graph, comments)`, write updated graph, continue polling.
   - `approve` -> Execute the invariant freeze, then proceed to generation and launch.

The user reviews graph topology and failure routings, not repo-specific details (which planner nodes refine at runtime).

## 3. The invariant freeze (mandatory on all paths)

Lock every gate node in `invariants.mustCross`, and lock **only the passing out-edge** (`when.eq === true`):

```javascript
for (const n of g.nodes) {
  if (g.invariants.mustCross.includes(n.id)) n.locked = true;
}
for (const e of g.edges) {
  if (g.invariants.mustCross.includes(e.from) && e.when && e.when.eq === true) {
    e.locked = true;
  }
}
```

Stamp `invariants.lockedHash` and set `approved: true`.

### Invariant rules:
- **Zero drift on stock seeds**: Stock seeds (`lite.json`, `delivery.json`) are already pre-frozen. A correct freeze touches 0 nodes/edges and preserves `lockedFingerprint` (`fnv1a:21e7419e` for lite, `fnv1a:51d7641c` for delivery). If the hash moves on a stock seed, do not re-stamp.
- **Never lock failing edges**: `applyPatchTo` appends and `pickEdge` selects the first match. A locked fail edge permanently shadows runtime patches attempting to splice recovery or spike nodes onto failure paths.
