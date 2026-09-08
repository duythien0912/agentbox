# Plugin packages

This directory hosts the canonical plugin packages published by Agentbox. Claude Code discovers the package structure through the marketplace manifest located in the repository root.

## Directory architecture

The core Agentbox plugin resides inside `plugins/agentbox/`, serving as the single source of truth for all skills, agents, and hooks:

```text
plugins/
└── agentbox/
    ├── .claude-plugin/      # Plugin manifest (plugin.json)
    ├── agents/              # 10 subagent definitions (agentbox-*.md)
    ├── hooks/               # Session hooks and policy guards
    ├── scripts/             # Internal runtime orchestrators
    └── skills/              # 19 skills with tests and evals
```

## Installation

Install the package directly into Claude Code:

```text
/plugin marketplace add duythien0912/agentbox
/plugin install agentbox@agentbox
```

## Marketplace manifest configuration

The marketplace entrypoint is declared in `.claude-plugin/marketplace.json` at the repository root:

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

Validate the manifest schema using the Claude Code CLI:

```bash
claude plugin validate .
```
