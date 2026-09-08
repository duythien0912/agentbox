# Build developer workflows with Agentbox

Agentbox provides visual generators, durable orchestration loops, and eval-gated optimization engines for Claude Code and Oh My Pi (omp). You get 19 modular skills and 10 specialized agents to trace code paths, diagram architectures, and automate multi-agent execution.

## Install Agentbox

Install Agentbox directly into your preferred environment using one command.

### Claude Code

Add the marketplace and install the package:

```text
/plugin marketplace add duythien0912/agentbox
/plugin install agentbox@agentbox
```

### Oh My Pi

Link skills and agents into your local `~/.config/omp/` directory:

```bash
bash scripts/setup-omp.sh
```

Check the symlink status at any time:

```bash
bash scripts/setup-omp.sh --status
```

## Select a workflow by task

Choose the recommended command for your objective:

| Your objective | Recommended prompt | Output deliverable |
| :--- | :--- | :--- |
| Explain a pull request | `write up PR <N>` | Interactive HTML walkthrough |
| Trace branching logic | `flowchart the <process>` | Interactive Mermaid flowchart |
| Diagram service communication | `sequence-diagram the <flow>` | Time-ordered sequence diagram |
| Map system architecture | `C4 model of <system>` | Multi-view LikeC4 diagram |
| Ship multi-agent features with resume | `implement <spec> with resume` | Crash-resilient conductor workflow |
| Audit an implementation plan | `plan-check @PLAN.md` | GO or NO-GO verification report |
| Hill-climb a numeric metric | `make <target> faster` | Optimization pull request via prospector |
| Find the right skill | `/guide` or `how do I use agentbox` | Interactive concierge router |

## Skills catalog

The marketplace ships 19 skills organized by category:

| Skill | Description |
| :--- | :--- |
| **`guide`** | Concierge router: maps tasks to matching skills and agents. |
| **`pr-writeup`** | Generates self-contained HTML pull request tours with test plans. |
| **`plan-deck`** | Converts specifications into interactive HTML implementation decks. |
| **`codewalk`** | Documents code execution paths with file and line references. |
| **`flowchart`** | Renders interactive Mermaid diagrams with node detail panels. |
| **`component-diagram`** | Diagrams component boundaries and typed interface dependencies. |
| **`sequence-diagram`** | Visualizes message exchanges with step-by-step inspector panels. |
| **`c4-model`** | Renders LikeC4 architecture diagrams inside a containerized renderer. |
| **`deep-understanding`** | Quizzes and guides you until you master a diff or subsystem. |
| **`conductor`** | Executes multi-phase agent workflows with crash-resilience and gates. |
| **`prospector`** | Hill-climbs numeric code metrics and opens a pull request. |
| **`whetstone`** | Resolves skill backlogs overnight using frozen test checks. |
| **`arena`** | Benchmarks conductor outputs across fixtures to produce a leaderboard. |
| **`loom`** | Coordinates graph-shaped workflows with verified invariants. |
| **`lanes`** | Manages external agent execution with an append-only ledger. |
| **`lane-config`** | Configures model effort, lane concurrency limits, and timeouts. |
| **`skill-lint`** | Audits skill word budgets, structural tags, and trigger descriptions. |
| **`plan-check`** | Audits technical plans against codebase evidence before execution. |
| **`feedback`** | Converts user feedback into scrubbed GitHub issue reports. |

## Agents catalog

Agentbox includes 10 subagents located in `plugins/agentbox/agents/`.

### Public agents

Invoke these agents directly for scoping, building, verifying, and reviewing:

| Agent | Responsibilities |
| :--- | :--- |
| **`agentbox-planner`** | Decomposes goals into code slices and acceptance criteria. |
| **`agentbox-builder`** | Implements a scoped slice in an isolated worktree. |
| **`agentbox-verifier`** | Verifies results at a commit hash using paired failure proofs. |
| **`agentbox-code-reviewer`** | Resolves Critical and High findings in a single review pass. |

### Automated gate workers

Conductor and lanes dispatch these workers automatically during workflow execution:

| Worker | Responsibilities |
| :--- | :--- |
| **`agentbox-test-writer`** | Authors failing acceptance tests before implementation begins. |
| **`agentbox-tryve-enhancer`** | Generates boundary, error path, auth, and concurrency tests. |
| **`agentbox-docs-writer`** | Records architectural changes into `docs/changes/`. |
| **`agentbox-web-verifier`** | Runs Playwright tests and captures viewport screenshots. |
| **`agentbox-mobile-verifier`** | Executes Maestro or Appium flows on mobile simulators. |
| **`agentbox-herdr-orchestrator`** | Coordinates multi-agent sessions across external panes. |

## Common prompt examples

Trigger skills by describing what you want to achieve:

```text
/guide
write up PR 1059
make a plan-deck for <spec>
codewalk the auth flow
flowchart the deploy pipeline
diagram the components of <service>
sequence-diagram the login flow
C4 model of <system>
help me deeply understand PR 1059
plan-check @PLAN.md
implement <spec> with resume
make the /search endpoint faster
improve the flowchart skill
which conductor config wins
which skills are too long?
```

Skills resolve under the `agentbox:` namespace, such as `agentbox:conductor` or `agentbox:plan-check`.

## Test locally without installing

Run Agentbox directly from a local clone:

```bash
git clone https://github.com/duythien0912/agentbox
cd agentbox
claude plugin validate .
claude --plugin-dir ./plugins/agentbox
```

You can also register the local directory as a marketplace source:

```text
/plugin marketplace add ./path/to/agentbox
```

## Update Agentbox

Agentbox tracks the Git commit hash directly. Pull new commits and run:

```text
/plugin marketplace update agentbox
```

## Explore guides

Read the documentation to learn specific workflows:

- [Make a skill whetstone-ready](./docs/whetstone-ready.md): Learn the floor and acceptance-check setup.
- [Skill-improvement cookbook](./docs/skill-improvement-cookbook.md): Harvest failures and automate pull requests.
- [Task scoring recipe](./plugins/agentbox/skills/whetstone/references/scored-tasks.md): Optimize task pass rates with prospector.
- [Run the arena](./docs/arena-guide.md): Add fixtures and compare conductor outputs.
- [SkillOpt exploration](./docs/skillopt-exploration.md): Review empirical validation data.

## Contribute

Read [CONTRIBUTING.md](./CONTRIBUTING.md) to add a skill, agent, or plugin package.

## License

MIT License. Details in [LICENSE](./LICENSE).
