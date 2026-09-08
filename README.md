# agentbox

duythien0912's personal [Claude Code](https://docs.claude.com/en/docs/claude-code) plugin marketplace.

A modular set of visual generators, orchestration loops, and eval/optimization engines for Claude Code.

## Install

### Claude Code

Install from the marketplace:

```text
/plugin marketplace add duythien0912/agentbox
/plugin install agentbox@agentbox
```

### Oh My Pi (omp)

Link skills & agents into your `~/.config/omp/` for use in any project:

```bash
bash scripts/setup-omp.sh
```

Check status: `bash scripts/setup-omp.sh --status`

## Quick Start by Job-To-Be-Done (JTBD)

| What do you want to do? | Recommended Command / Prompt | Output / Benefit |
|---|---|---|
| Review or explain a PR | `write up PR <N>` | Interactive file-by-file HTML writeup |
| Trace logic or branching pipeline | `flowchart the <process>` | Interactive Mermaid flowchart |
| Sequence diagram service interaction | `sequence-diagram the <flow>` | Time-ordered sequence diagram |
| C4 architectural landscape | `C4 model of <system>` | Multi-view architectural diagram |
| Ship multi-subagent feature with resume | `implement <spec> with resume` | Crash-safe conductor workflow |
| Pre-flight test a plan for blindspots | `plan-check @PLAN.md` | GO/NO-GO audit with code evidence |
| Benchmark or hill-climb a metric | `make <target> faster` | Automated hill-climbing PR via prospector |
| Not sure what to pick? | `/guide` or `how do I use agentbox` | Interactive concierge router |

## Skills Catalog

The marketplace ships 19 skills; key ones below:

| Skill | What it does |
|---|---|
| **`guide`** | Concierge router: maps goals to agentbox skills, suggests commands, and explains combos. |
| **`pr-writeup`** | Converts PRs into self-contained HTML writeups (TL;DR, file tour, tests, rollout). |
| **`plan-deck`** | Turns specs into implementation plans (timeline, data-flow, mockups, risks). |
| **`codewalk`** | Walks a code path into an HTML guide with file:line refs and gotchas. |
| **`flowchart`** | Creates interactive Mermaid flowcharts with per-node details (needs internet/CDN). |
| **`component-diagram`** | Interactive component diagrams with boundaries, typed deps, and clickable panels (needs CDN). |
| **`sequence-diagram`** | Interactive time-ordered sequence diagrams with step-driven detail (needs CDN). |
| **`c4-model`** | Generates LikeC4 multi-view HTML from a `.c4` source; runs in a throwaway Docker container (needs docker, ~1 GB first pull). |
| **`deep-understanding`** | Interactive tutor: quizzes and guides until mastery of a PR/change/subsystem. |
| **`conductor`** | Durable workflow runner with crash/resume, isolation, gates, and cost reporting for long multi-agent runs. |
| **`prospector`** | Hill-climb a numeric metric with a correctness gate; keeps only strict improvements and opens a PR (never auto-merges). |
| **`whetstone`** | Overnight eval-gated improver: grinds a backlog, applies per-item checks, optionally compacts, and opens a PR. |
| **`arena`** | Reproducible pairwise leaderboard: judges conductor outputs across fixtures and emits a ranking, then opens a PR. |
| **`loom`** | Graph-shaped delivery: fork/rejoin work with invariants, preview and edit in-browser before launch. |
| **`lanes`** | External-agent execution model with append-only JSON store, DuckDB views, and tools to detect/recompute state drift. |
| **`lane-config`** | Manage per-repo orchestration configs: harness, model effort, caps, timeouts; validated by subcommands (`detect`,`init`,`validate`). |
| **`skill-lint`** | Analyzes SKILL.md for verbosity, missing tags, weak triggers, oversized assets; reports findings (does not edit). |
| **`plan-check`** | Pre-flight audits plans against code/docs across 4 quadrants and emits a GO/GO-WITH-CONDITIONS/NO-GO HTML report. |
| **`feedback`** | Converts user feedback into a redacted GitHub issue on `duythien0912/agentbox` to seed `whetstone` runs. Invoked by `/feedback`. |

## Agents

Subagents live under `plugins/agentbox/agents/`: public subagents for direct use and automated gate workers spawned by conductor/lanes.

### Directly Usable Subagents (Public)

Invoke these for scoping, building, verifying, and reviewing:

| Agent | Role |
|---|---|
| **`agentbox-planner`** | Scopes goals into executable acceptance criteria; never implements. |
| **`agentbox-builder`** | Implements a scoped slice in a worktree; stops at first red. |
| **`agentbox-verifier`** | Verifies a lane result at a SHA; reports failures and numbers; does not fix. |
| **`agentbox-code-reviewer`** | Reviews changed code and fixes Critical/High issues while keeping the build green. |

### Automated Gate Workers (Auto-spawned by Conductor/Lanes)

Automatically enforce tests, docs, frontend verification, and multi-pane sessions:

| Agent | Role |
|---|---|
| **`agentbox-test-writer`** | Writes failing tests from acceptance criteria (RED-first). |
| **`agentbox-tryve-enhancer`** | Improves coverage by focusing on error paths, boundaries, auth, and concurrency from the diff. |
| **`agentbox-docs-writer`** | Adds concise implementation summaries to `docs/changes/` from diffs and notes. |
| **`agentbox-web-verifier`** | Writes Playwright E2E specs, captures per-viewport evidence; failures never silently pass. |
| **`agentbox-mobile-verifier`** | Detects RN/Flutter/native and writes Maestro/Appium flows; falls back to `simctl`/`adb` evidence capture. |
| **`agentbox-herdr-orchestrator`** | Runs multi-agent Herdr sessions: scopes work, sets success criteria, delegates implementor/verifier panes, adjudicates reports, and pushes commits. Never edits or trusts self-reports. Pairs with `lanes`. |

## Common Prompts

Invoke skills by describing the task:

```text
/guide
write up PR 1059
make a plan-deck for <spec/task>
codewalk the auth flow
flowchart the deploy pipeline
diagram the components of <service>
sequence-diagram the login flow
C4 model of <system>         # needs docker
help me deeply understand PR 1059
plan-check @PLAN.md
implement <plan/spec> with resume
make the /search endpoint faster
improve the flowchart skill
which conductor config wins
which skills are too long?
```

Skills resolve under `agentbox:` (e.g. `agentbox:guide`, `agentbox:pr-writeup`, `agentbox:conductor`, `agentbox:prospector`, `agentbox:whetstone`, `agentbox:arena`, `agentbox:skill-lint`, `agentbox:plan-check`).

## Test locally (no install)

Run from a clone without registering the marketplace:

```bash
git clone https://github.com/duythien0912/agentbox
cd agentbox
claude plugin validate .
claude --plugin-dir ./plugins/agentbox
```

Or add the local checkout as a marketplace:

```text
/plugin marketplace add ./path/to/agentbox
```

## Updating

agentbox tracks the git commit SHA (no pinned version). Push commits, then run:

```text
/plugin marketplace update agentbox
```

## Guides

- [Making a skill whetstone-ready](./docs/whetstone-ready.md) — the floor + acceptance-check scaffolding.
- [Skill-improvement cookbook](./docs/skill-improvement-cookbook.md) — scored tasks → harvest failures → `whetstone` → auto-PR example with metrics.
- [`skill-train` recipe](./plugins/agentbox/skills/whetstone/references/scored-tasks.md) — use `prospector` to hill-climb task pass-rate.
- [Running the arena](./docs/arena-guide.md) — add fixtures, compare conductor versions, read the leaderboard; includes gotchas.
- [SkillOpt exploration](./docs/skillopt-exploration.md) — rationale and empirical validation of controls.

## Extending

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to add a skill, agent, or plugin.

## License

MIT — see [LICENSE](./LICENSE).
