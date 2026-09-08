# Scored tasks — building graded eval suites for whetstone feedback harvest

Reference for authoring and running a **scored task set** for a lirbox skill. Scored tasks evaluate
a skill's output surface across deterministic test cases and feed failing items into whetstone's
backlog via `harvest-feedback.cjs`.

For aggregate prompt/skill text hill-climbing on scored task sets, use dedicated reflective prompt
evolution frameworks such as **[GEPA](https://github.com/gepa-ai/gepa)** (`optimize_anything`) or
**OpenEvolve**, which natively support Pareto optimization and textual reflection. Within lirbox,
use **whetstone** to grind individual failing tasks through deterministic checks and regression floors.

---

## 1. Scaffold the scored task set

```
node plugins/agentbox/skills/whetstone/scripts/scaffold-readiness.cjs --name <skill> --scored
```

This writes (idempotently) on top of the normal whetstone floor:

```
<skill>/evals/
  run.mjs                 # the FLOOR runner (green on baseline — the gate)
  run-scored.mjs          # the METRIC: runs tasks/<split>/*.test.mjs, prints `score=<pct>`
  tasks/train/*.test.mjs  # tasks whose FAILURES may be shown to the worker / harvested
  tasks/val/*.test.mjs    # HELD-OUT tasks — used to verify generalization
```

Write each task as a small deterministic `*.test.mjs` that exercises the skill's *output surface*
(run its validator/generator/asset against a fixture; assert). Split them yourself — roughly
50/50, val at least 4 tasks (a 1-task val flips 0↔100 and cannot smooth noise).

---

## 2. Harvesting failures into whetstone

When scored tasks fail, close the loop by harvesting failures into whetstone's backlog:

```
node plugins/agentbox/skills/whetstone/scripts/harvest-feedback.cjs <skill>
```

Each failing **train** task becomes a `feedback/<skill>.jsonl` item whose `acceptanceCheck` IS that
task — RED-on-baseline by construction (it was just observed failing), already inside the locked
`evals/**` set. Then run `whetstone <skill>` normally.

The harvester refuses `--split val` — the held-out judge must never feed the fixer.

---

## 3. Skill evolution & prompt optimization: GEPA / OpenEvolve

When you want aggregate hill-climbing across a graded benchmark rather than fixing individual
backlog items:
- Use **[GEPA `optimize_anything`](https://github.com/gepa-ai/gepa)** (Genetic-Pareto reflective prompt evolution):
  optimizes any textual artifact with reflective feedback from failing traces and Pareto-frontier tracking.
- Or use **OpenEvolve** / evolutionary prompt optimizers.

Whetstone pairs with this by maintaining the **regression floor**: in-loop regression control
(`evals/run.mjs`) ensures that candidate improvements never break existing invariants or characterization tests.

---

## 4. Quality gates for scored tasks

- **At least ~8 total tasks**: fewer tasks make percentage scores too coarse; file individual concerns into whetstone directly instead.
- **Deterministic verification**: tasks should assert clear invariants on the output surface, not rely on stochastic LLM graders.
- **Always keep the floor green**: a rising task score must never mask regressions on core skills/characterization.
