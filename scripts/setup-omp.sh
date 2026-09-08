#!/usr/bin/env bash
#
# setup-omp.sh — Connect agentbox skills & agents to Oh My Pi (omp)
#
# Usage:
#   bash scripts/setup-omp.sh            # Link skills & agents into ~/.config/omp/
#   bash scripts/setup-omp.sh --status   # Check currently linked skills & agents
#   bash scripts/setup-omp.sh --clean    # Remove symlinks created by this script
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_SRC="$REPO_DIR/plugins/agentbox/skills"
AGENTS_SRC="$REPO_DIR/plugins/agentbox/agents"
OMP_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/omp"

if [ ! -d "$SKILLS_SRC" ] || [ ! -d "$AGENTS_SRC" ]; then
  echo "Error: source directories not found in $REPO_DIR" >&2
  exit 1
fi

install_links() {
  echo "Linking agentbox into Oh My Pi ($OMP_CONFIG_DIR) ..."
  mkdir -p "$OMP_CONFIG_DIR/skills" "$OMP_CONFIG_DIR/agents"

  local count_skills=0
  for s in "$SKILLS_SRC"/*; do
    if [ -d "$s" ]; then
      local name
      name="$(basename "$s")"
      ln -sf "$s" "$OMP_CONFIG_DIR/skills/$name"
      count_skills=$((count_skills + 1))
    fi
  done

  local count_agents=0
  for a in "$AGENTS_SRC"/agentbox-*.md; do
    if [ -f "$a" ]; then
      local name
      name="$(basename "$a")"
      ln -sf "$a" "$OMP_CONFIG_DIR/agents/$name"
      count_agents=$((count_agents + 1))
    fi
  done

  echo "✔ Done: $count_skills skills and $count_agents agents linked into $OMP_CONFIG_DIR"
  echo "  Skills available in omp via: skill://<name>"
  echo "  Agents available in omp via: agent://agentbox-<role>"
}

show_status() {
  echo "=== Agentbox OMP Integration Status ==="
  echo "Source: $REPO_DIR"
  echo "Target: $OMP_CONFIG_DIR"
  echo ""
  if [ -d "$OMP_CONFIG_DIR/skills" ]; then
    local sk
    sk=$(find "$OMP_CONFIG_DIR/skills" -maxdepth 1 -lname "$SKILLS_SRC/*" 2>/dev/null | wc -l | tr -d ' ')
    echo "  Skills linked: $sk / 19"
  else
    echo "  Skills: not configured"
  fi
  if [ -d "$OMP_CONFIG_DIR/agents" ]; then
    local ag
    ag=$(find "$OMP_CONFIG_DIR/agents" -maxdepth 1 -lname "$AGENTS_SRC/*" 2>/dev/null | wc -l | tr -d ' ')
    echo "  Agents linked: $ag / 10"
  else
    echo "  Agents: not configured"
  fi
}

clean_links() {
  echo "Removing agentbox symlinks from $OMP_CONFIG_DIR ..."
  if [ -d "$OMP_CONFIG_DIR/skills" ]; then
    find "$OMP_CONFIG_DIR/skills" -maxdepth 1 -lname "$SKILLS_SRC/*" -delete 2>/dev/null || true
  fi
  if [ -d "$OMP_CONFIG_DIR/agents" ]; then
    find "$OMP_CONFIG_DIR/agents" -maxdepth 1 -lname "$AGENTS_SRC/*" -delete 2>/dev/null || true
  fi
  echo "✔ Symlinks removed."
}

ACTION="${1:-install}"
case "$ACTION" in
  install|--install)
    install_links
    ;;
  status|--status|-s)
    show_status
    ;;
  clean|--clean|uninstall|--uninstall)
    clean_links
    ;;
  *)
    echo "Usage: $0 [--install | --status | --clean]" >&2
    exit 1
    ;;
esac
