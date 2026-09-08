# Contributing to Agentbox

Agentbox accepts contributions across skills, subagents, and new plugin packages. This guide walks you through repository conventions, layout requirements, and the three testing tiers required before shipping changes.

## Marketplace architecture

The repository contains two distinct architectural layers:

```text
agentbox/                         # Marketplace repository root
├── .claude-plugin/marketplace.json     # Manifest listing available plugins
├── plugins/
│   └── agentbox/                         # Core Agentbox plugin package
│       ├── .claude-plugin/plugin.json   # Plugin manifest
│       ├── skills/<name>/SKILL.md        # Auto-discovered skills
│       └── agents/<name>.md              # Auto-discovered subagents
└── templates/                           # Starter templates for skills and agents
```

Select the section below that matches your contribution.

## Add a new skill to the Agentbox plugin

Claude Code auto-discovers skills placed in `plugins/agentbox/skills/`. You do not need to edit any manifest file.

1. Copy the skill template:
   ```bash
   cp -R templates/skill-template plugins/agentbox/skills/<your-skill-name>
   ```
2. Edit `plugins/agentbox/skills/<your-skill-name>/SKILL.md`:
   - Set `name:` to match your directory name in kebab-case.
   - Write `description:` in the third person. Be explicit about when the skill triggers. The model reads only `name` and `description` to decide invocation.
3. Place optional bundled resources alongside `SKILL.md`:
   - `scripts/`: Executable scripts (reference via `${CLAUDE_PLUGIN_ROOT}/skills/<name>/scripts/...`).
   - `references/`: Reference documentation loaded on demand to keep `SKILL.md` lean.
   - `assets/`: HTML templates and assets rendered in skill deliverables.
4. Test your skill using the tiers below, then commit your changes.

The skill resolves under the namespace `agentbox:<your-skill-name>`.

## Add a new agent to the Agentbox plugin

Claude Code auto-discovers agents from `plugins/agentbox/agents/` as Markdown files with frontmatter.

1. Copy the agent template:
   ```bash
   cp templates/agent-template.md plugins/agentbox/agents/<your-agent-name>.md
   ```
2. Edit the frontmatter:
   - `name:` (required): Unique kebab-case identifier used during agent dispatch.
   - `description:` (required): Concise statement of agent capabilities and trigger conditions.
   - `model:` (optional): Model identifier (such as `claude-opus-4-1` or `haiku`); omit to inherit.
   - `tools:` (optional): List of tools permitted for this agent.
3. Author the system prompt in the Markdown body defining role, method, and output schema.
4. Test and commit your agent.

Keep agents single-purpose: a focused role with a strict output contract outperforms broad agent prompts.

## Add a new plugin to the marketplace

Create a new plugin when your contribution represents an independent product rather than a tool inside `agentbox`.

1. Scaffold the plugin directories:
   ```bash
   mkdir -p plugins/<new-plugin>/.claude-plugin plugins/<new-plugin>/skills
   ```
2. Create `plugins/<new-plugin>/.claude-plugin/plugin.json`. Copy `plugins/agentbox/.claude-plugin/plugin.json` and adjust `name`, `description`, and `keywords`. Omit `version` during active development so updates track Git commit hashes directly.
3. Add skills and agents under your plugin directory following the conventions above.
4. Register your plugin in `.claude-plugin/marketplace.json` by appending an entry to the `plugins` array:
   ```json
   {
     "name": "<new-plugin>",
     "source": "./plugins/<new-plugin>",
     "description": "…",
     "keywords": ["…"]
   }
   ```

## Layout rules

Follow these repository layout rules:

- `marketplace.json` resides at `.claude-plugin/marketplace.json` in the repository root. Never move it under `plugins/`.
- A plugin's `.claude-plugin/` directory holds only `plugin.json`. Place `skills/`, `agents/`, and `hooks/` at the plugin root.
- Use kebab-case for all filenames and directory names without spaces.
- Reference internal plugin files at runtime via `${CLAUDE_PLUGIN_ROOT}`, never with absolute host paths.

## Configure commit identity

This repository enforces the `duythien0912` personal identity to prevent corporate account details from appearing in public Git history. Activate the pre-commit hook after cloning:

```bash
git config core.hooksPath .githooks
git config user.name "duythien0912"
git config user.email "duythien0912@users.noreply.github.com"
```

The `.githooks/pre-commit` hook blocks any commit authored by an unexpected email domain.

## Pull request workflow for the main branch

Direct pushes to `main` are blocked. All changes must arrive through pull requests.

1. The GitHub ruleset requires a pull request and requires both `evals` jobs (floors plus frozen checks, and generator regression nets) to pass.
2. Maintainer self-approval is not required: automated continuous integration serves as the release gate.
3. Create your feature branch and submit a pull request:
   ```bash
   git switch -c <type>/<slug>
   git push -u origin HEAD
   gh pr create --fill
   ```

Workflow run branches (`improve/*`, `opt/*`, `wf/*`) finish by opening a pull request automatically.

## Testing tiers

Test your work using three progressive tiers before submitting changes.

### Tier 1: Validate and smoke test

Run validation tools locally in seconds:

```bash
claude plugin validate .
claude --plugin-dir ./plugins/agentbox
```

Run `skill-lint` to audit word budgets, XML structure, and trigger descriptions:

```bash
node plugins/agentbox/skills/skill-lint/scripts/analyze.cjs
```

### Tier 2: Evals regression gate

Tier 2 evals prevent regressions and enable automated skill improvement via `whetstone`.

Every skill maintains an evaluation structure:
```text
plugins/agentbox/skills/<name>/evals/
  floor/                 Invariants that must always pass
  checks/                Frozen checks guarding specific past bug fixes
  checks-manifest.json   Registration manifest for all active checks
```

For artifact skills, author a headless validator that parses output HTML. Run the full evaluation suite:

```bash
node scripts/evals-all.mjs --fast --skill <name>
node scripts/evals-all.mjs --fast
```

#### Modify a shipped skill

Every modification to a shipped skill requires a discrimination-gated frozen check and a green floor.

1. **Prove red baseline**: Confirm your check fails on the unmodified skill:
   ```bash
   node plugins/agentbox/skills/whetstone/scripts/check-baseline.cjs "<check command>"
   ```
   The command must output `DISCRIMINATING` (exit 0).
2. **Register check**: Add the check to `checks-manifest.json` with explicit `mutations`. Prove check sensitivity:
   ```bash
   node scripts/prove-checks.mjs --skill <skill>
   ```
3. **Verify green gate**: Run `node scripts/evals-all.mjs --fast` to confirm all floors and frozen checks pass.

#### Decide between whetstone and direct edits

Use `whetstone` for unattended overnight improvements across backlogs of filed concerns. For small, single-file edits, edit directly.

When running `whetstone`, push your frozen checks before launching the loop. After merging the resulting pull request, prune resolved items from `feedback/<skill>.jsonl`.

### Tier 3: Harbor behavioral testing

Tier 2 evals check file content and syntax. Harbor behavioral tests verify that the model actually exhibits the desired capabilities in containerized environments.

A feature or skill change is complete when a paired Harbor evaluation demonstrates performance better than or equal to baseline.

Run paired evaluations comparing two arms on the same task and model:

| Arm | Skill tree source | Verification objective |
| :--- | :--- | :--- |
| **baseline** | Skill tree at `git HEAD` | The performance floor to exceed |
| **after** | Your local working tree | Performance parity or improvement |

Export the baseline tree cleanly from Git:

```bash
git archive HEAD plugins/agentbox/skills/<skill> | tar -x -C /tmp/base
rm -rf /tmp/base/plugins/agentbox/skills/<skill>/{evals,harbor,arena}
```

Run both arms sequentially to prevent filesystem contention in `environment/skill/`.

#### Execute free gates before paid runs

Harbor provides a zero-cost discrimination gate that runs in approximately 1 minute:

```bash
P=plugins/agentbox/skills/<skill>/harbor/tasks/<id>
harbor run -p $P -a nop -y      # Must score 0.0
harbor run -p $P -a oracle -y   # Must score 1.0
```

The `-a nop` run ensures a do-nothing agent receives 0. The `-a oracle` run confirms the reference solution achieves 1.0. Never proceed to paid runs if either condition fails.

#### Multi-dimension grading with Reward Kit

Use `harbor-rewardkit` to isolate grading dimensions into subdirectories:

```text
tests/
  test.sh              Invokes rewardkit per dimension and merges results
  reward/checks.py     Deterministic checks mapping to the "reward" key
  quality/judge.toml   Semantic evaluation mapping to the "quality" key
```

Run each dimension in a separate `rewardkit` process to prevent a semantic judge failure from invalidating deterministic scores.

#### Run against local endpoints

You can evaluate skills on local hardware using Ollama or compatible OpenAI endpoints:

```bash
CAT=$(mktemp -d) && node scripts/harbor-prep.mjs --catalog $CAT
harbor run -p plugins/agentbox/skills/<skill>/harbor/tasks/<id> -a claude-code -m <model> --skill $CAT \
  --ae ANTHROPIC_BASE_URL=$URL --ae ANTHROPIC_AUTH_TOKEN=local-token \
  --ae CLAUDE_CODE_AUTO_COMPACT_WINDOW=26000 --ae CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=85 \
  --ak disallowed_tools="CronCreate,CronDelete,CronList,EnterWorktree,ExitWorktree,NotebookEdit,ReportFindings,ScheduleWakeup,SendMessage,TaskCreate,TaskGet,TaskList,TaskOutput,TaskStop,TaskUpdate,ToolSearch,WebFetch,WebSearch" \
  -e docker -y
```

Set `CLAUDE_CODE_AUTO_COMPACT_WINDOW` below your local server's context window. Restrict tools to essential commands to conserve input token budgets.

#### Run against first-party Anthropic endpoints

When running against Anthropic APIs directly, invoke Harbor with explicit concurrency limits:

```bash
P=plugins/agentbox/skills/<skill>/harbor/tasks/<id>
harbor run -p $P -a claude-code -m claude-sonnet-5 -k 3 \
  -n 1 --agent-setup-timeout-multiplier 5 -r 1 --env-file .env -y
```

Pass `-n 1` to prevent setup races during package downloads, and supply credentials via `.env`.

### Ship your changes

1. Commit your changes with a clear conventional commit message (`feat(skill): add <skill>`).
2. Push your feature branch and open a pull request.
3. After merge, update your installed plugin copy:
   ```text
   /plugin marketplace update agentbox
   ```
