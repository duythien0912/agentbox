# agentbox — Agent Directives & Invariants

Personal Claude Code plugin marketplace (`plugins/agentbox/`). Reference catalog in [README.md](./README.md) and developer guides in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Architectural Invariants

- **Dual-target execution**: Package as Claude Code plugin (`claude plugin validate .`); link into Oh My Pi (`bash scripts/setup-omp.sh`).
- **Conductor purity**: Conductor scripts (`.workflows/*.js`) remain pure JS. Express logic in deterministic functions; delegate all file I/O, Git, and process execution to spawned `agent()` worker subagents.
- **Generator single source of truth**: Author changes in `scripts/scaffold-*.cjs` and regenerate. Run the verification net after generator modifications:
  - conductor: `node plugins/agentbox/skills/conductor/scripts/test-scaffold.cjs`
  - prospector: `node plugins/agentbox/skills/prospector/scripts/test-optimize.cjs`
  - whetstone: `node plugins/agentbox/skills/whetstone/scripts/test-improve.cjs`
  - arena: `node plugins/agentbox/skills/arena/scripts/test-arena.cjs`
- **Delivery by pull request**: Leave run branches (`opt/<goal>-<ts>`, `improve/<skill>-<ts>`, `wf/<name>`) unmerged for human review.
- **Artifact isolation**: Keep run artifacts within gitignored directories (`.workflows/`, `.optimize/`, `.improve/`, `.arena/`, `.worktrees/`, `implementation-notes/`). Promote curated summaries to `docs/changes/<name>/` or `docs/arena/<name>/` exclusively via finalization tasks.

## Skill Modification Protocol

Every skill modification requires a discrimination-gated frozen check and a green floor.

1. **Prove red baseline**:
   ```bash
   node plugins/agentbox/skills/whetstone/scripts/check-baseline.cjs "<check cmd>"  # must report DISCRIMINATING
   ```
2. **Register check**: Add entry to `evals/checks-manifest.json` with explicit `mutations`. Prove check failure:
   ```bash
   node scripts/prove-checks.mjs --skill <skill>  # must report DISCRIMINATING
   ```
3. **Keep floor green**:
   ```bash
   node scripts/evals-all.mjs --fast  # all floors and checks must pass (exit 0)
   ```
4. **Prune feedback**: Remove resolved issues from `feedback/<skill>.jsonl` once changes merge.

## Shipping Tiers

- **Tier 1 (Static)**: `claude plugin validate .`, smoke test, `node plugins/agentbox/skills/skill-lint/scripts/analyze.cjs`.
- **Tier 2 (Artifact evals)**: Green regression gate via `node scripts/evals-all.mjs --fast` (covers `evals/floor/` and `evals/checks/`).
- **Tier 3 (Harbor behavioral test)**: Paired behavioral evaluation comparing baseline (`git HEAD`) with working tree. Harbor procedures and container configurations live in [CONTRIBUTING.md § Tier 3](./CONTRIBUTING.md#tier-3--harbor-containerised-behavioural-test--offer-it-do-not-assume-it).

## Knowledge Graph Navigation (graphify)

When `graphify-out/graph.json` exists:
- Query relations: `graphify query "<question>"`, `graphify path "<A>" "<B>"`, `graphify explain "<concept>"`.
- Broad navigation: Read `graphify-out/wiki/index.md`.
- Keep current: Run `graphify update .` after code modifications.
