# agentbox — repo guide for Claude

Personal Claude Code plugin marketplace. One plugin: `plugins/agentbox/`.
Structure: `skills/<name>/SKILL.md` (+ optional `scripts/`, `references/`, `assets/`), `agents/<name>.md`.
Skills auto-discovered via `.claude-plugin/marketplace.json`.

Catalog → [README.md](./README.md). Add/test details → [CONTRIBUTING.md](./CONTRIBUTING.md).

## Dual-target operating model

- **Claude Code**: Packaged as a marketplace plugin. Validate with `claude plugin validate .`.
- **Oh My Pi (omp)**: Link into `~/.config/omp/` via `bash scripts/setup-omp.sh`. Conductor workflows run on a persistent Bun/Node VM using `workpool()`, `agent()`, and `hub`.

## Two skill families

**HTML-artifact** (e.g., `codewalk`, `flowchart`, `plan-deck`, `pr-writeup`) — single HTML file. `flowchart` has `assets/validate.mjs`; run `node .../validate.mjs <file>.html` to catch Mermaid label issues. `deep-understanding` is an interactive tutor.

**Orchestration loops** (`conductor`, `loom`, `prospector`, `whetstone`, `arena`) — deterministic JS conductor generates worker subagents. Rules:
- Conductor must be pure JS: no `fs`/`git`/`require`/`Date.now()`/`Math.random()`. Put side effects in `agent()` workers; `test-*.cjs` enforces this.
- Do not hand-edit generated loop scripts—change `scripts/scaffold-*.cjs` and regenerate.
- After generator changes, run the net: conductor → `test-scaffold.cjs`, prospector → `test-optimize.cjs`, whetstone → `test-improve.cjs`, arena → `test-arena.cjs`.
- Never auto-merge. prospector/whetstone finalize by opening a PR with the run report; conductor leaves a `wf/` branch.
- Runs create timestamped branches (`opt/<goal>-<ts>`, `improve/<skill>-<ts>`) so concurrent runs do not collide. whetstone backlog keys by skill (`feedback/<skill>.jsonl`).

## Runtime artifacts are gitignored — never commit them

Ignored: .workflows/, .optimize/, .improve/, .arena/, .worktrees/, generated `*-flowchart/codewalk/plan-deck.html`, `implementation-notes/`.

Exceptions (promoted into docs by finalization steps): arena `Finalize` moves `leaderboard.html` + `report.md` to `docs/arena/<name>/`; conductor `Writeup` moves `implementation-notes/*.html`, `writeup.html`, `design.html`, and DocsGate `summary.md` to `docs/changes/<name>/`.

## Validate

Run `claude plugin validate .` before pushing. A skill's frontmatter `description` is its **trigger**—keep it specific. Skills resolve as `agentbox:<name>`.

## Changing a skill — the rule why

> **Every skill change is behind a discrimination-gated frozen check and a green floor.**
> Whether `whetstone` or a human runs it is a cost decision.

- Prove the check RED on baseline first:
  `node plugins/agentbox/skills/whetstone/scripts/check-baseline.cjs "<check cmd>"` → `DISCRIMINATING`.
- Register it in `evals/checks-manifest.json` with `mutations`. Keep it measurable: `node scripts/prove-checks.mjs --skill <skill>` ensures the check can fail; undeclared checks show `UNPROVEN`.
- Keep the floor green: `node scripts/evals-all.mjs --fast`.
- If running `whetstone`, push frozen checks first—the worktree is cut from remote tip, so local-only checks are invisible. After improve-PR merges, prune resolved items from `feedback/<skill>.jsonl` (the open-issues queue).

## Shipping a skill — three tiers

**Tier 1**: validate, smoke-test, `skill-lint`.  
**Tier 2**: evals (`evals/floor/`, `evals/checks/`, `evals/checks-manifest.json`) and green under `node scripts/evals-all.mjs --fast`. Tiers 1–2 are required.

**Tier 3 — Harbor (containerized behavioral test): REQUIRED for a skill change.** Tier 2 is artifact-level; Harbor proves behavior. A new feature or change is not done until Harbor shows it BETTER or NO WORSE than baseline.

Run Harbor paired: same task, same model, two skill trees (baseline = `git HEAD`; after = working tree). Report the lift, not raw scores. One task can cover both "no worse" and "better" dimensions.

Build + discrimination gate (`-a nop` / `-a oracle`) is free and required. Paired runs cost ~$5–15 per task—state the estimate and proceed; skipping means the change is unverified behaviorally.

Tasks live at `plugins/agentbox/skills/<skill>/harbor/tasks/<id>/`. Harbor runs that directory; edit what runs. Generate `environment/skill/` first:

```
node scripts/harbor-prep.mjs <skill>/<task-id>       # or --all
harbor run -p plugins/agentbox/skills/<skill>/harbor/tasks/<id> -a nop    -y   # must be 0
harbor run -p plugins/agentbox/skills/<skill>/harbor/tasks/<id> -a oracle -y   # must be 1.0
```

Before a paid run, read `jobs/`. Job output lands in `<repo-root>/jobs/` (gitignored); always inspect the main repo root's `jobs/`. Prior `reward`/`quality`/`cost_usd` live there—if a metric is saturated, note it instead of spending. Always `ls` directories before assuming contents.

See [CONTRIBUTING.md § Tier 3](./CONTRIBUTING.md#tier-3--harbor-containerised-behavioural-test--offer-it-do-not-assume-it). Key rules: never give the container a skill tree with `evals/`/`harbor/`/`arena/` (harbor-prep prunes and refuses them); re-run `harbor-prep.mjs` after edits; re-copy a skill validator when `assets/` change; always run `-a nop` with `-a oracle`; oracle bar is `== 1.0` per dimension; judged dimensions are advisory, not gating.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
