# Agentbox Skills

This directory contains the 19 skills published by **`agentbox`**.

## Skill Layout Convention

Each skill directory adheres to a standard layout:
- `SKILL.md`: Frontmatter trigger (`name`, `description`, `allowed-tools`), core invariants, and procedural guide.
- `evals/`:
  - `floor/`: Deterministic baseline characterization tests (`00-structure.test.mjs`, behavior tests).
  - `checks/`: Discriminating frozen regression checks (verified RED on mutation).
  - `checks-manifest.json`: Registration manifest mapping each check to its purpose.
  - `run.mjs`: Test runner executed by the repo-wide gate (`scripts/evals-all.mjs`).
- `references/` *(optional)*: Specialized procedural documentation, reducing cognitive load and context tokens in `SKILL.md`.
- `assets/` *(optional)*: HTML templates, validators (`validate.mjs`), or rendering assets.
- `scripts/` *(optional)*: Generators or diagnostic tools for orchestration loops.

## Skill Catalog by Domain

### 1. Visual Artifacts & Documentation
- **`guide`**: Concierge router and interactive decision tree for the agentbox suite.
- **`pr-writeup`**: Turn any pull request into a self-contained reviewer HTML writeup.
- **`plan-deck`**: Turn specs into milestone-based HTML implementation plans.
- **`codewalk`**: Interactive code path walkthrough with verified line references.
- **`flowchart`**: Interactive Mermaid flowchart with per-node detail panels.
- **`component-diagram`**: Static system architecture with typed dependency edges.
- **`sequence-diagram`**: Time-ordered interaction sequence diagram with call-site excerpts.
- **`c4-model`**: LikeC4 multi-view architectural diagramming (needs Docker).
- **`deep-understanding`**: Interactive tutor assessing and quizzing code understanding.

### 2. Orchestration & Delivery Loops
- **`conductor`**: Durable multi-phase workflow runner with crash/restart resume and enforcement gates.
- **`loom`**: Graph-shaped delivery loop with fork/rejoin DAG regions and browser editor.
- **`lanes`**: External-agent execution model with append-only ledger and drift reconciliation.
- **`lane-config`**: Configuration manager for model effort, lane caps, and timeouts.
- **`plan-check`**: Pre-flight audit testing execution plans across 4 knowledge quadrants.

### 3. Evaluation & Optimization
- **`prospector`**: Sequential keep-or-discard hill-climbing loop for objective code scalars.
- **`whetstone`**: Overnight eval-gated skill improver grinding a backlog through frozen checks.
- **`arena`**: Reproducible pairwise leaderboard evaluating conductor outputs across test fixtures.
- **`skill-lint`**: Deterministic analyzer auditing word budgets, structural tags, and triggers.
- **`feedback`**: User feedback intake converting experience into scrubbed GitHub issues.
