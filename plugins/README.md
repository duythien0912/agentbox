# Public Plugins

This directory contains the canonical plugin package for **`agentbox`**, distributed through the Claude Code marketplace manifest at `.claude-plugin/marketplace.json`.

## Architecture: Single Source of Truth

All skills, agents, and hooks are authored and maintained directly in **`plugins/agentbox/`**:

```text
plugins/
└── agentbox/
    ├── .claude-plugin/      # Plugin manifest (plugin.json)
    ├── agents/              # 10 subagents (agentbox-*.md)
    ├── hooks/               # Session hooks and policy guards
    ├── scripts/             # Internal runtime orchestrators
    └── skills/              # 19 skills (each with SKILL.md, evals/, tests)
```

## Installation

```text
/plugin marketplace add duythien0912/agentbox
/plugin install agentbox@agentbox
```

## Marketplace Manifest

The marketplace entrypoint resides in `.claude-plugin/marketplace.json` at the repo root:

```json
{
  "name": "agentbox",
  "plugins": [
    {
      "name": "agentbox",
      "source": "./plugins/agentbox"
    }
  ]
}
```

Validate with:
```bash
claude plugin validate .
```
