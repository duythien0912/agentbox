# Lane DoD and Gates Reference

Mechanics of code reviews, gating hooks, and Definition of Done (DoD) verification.

## 1. Code gate execution

Before branch publication, run the review and verification gate:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/orch-lane.sh gate <lane> --run <slug>
```

- Spawns a dedicated lane using `lanes.gate_profile` on the lane branch.
- Reviews and fixes Critical and High severity issues in a single pass, then executes the build.
- Emits an `evidence/` record with `kind: "code_gate"` containing `gate_passed`, `critical`, `high`, `build_cmd`, and `build_exit`.
- **Pass invariant**: `gate_passed && build_exit == 0`. Self-reports by the implementor are rejected.

## 2. Gating hook mechanics (`gate-guard.sh`)

`gate-guard.sh` acts as an unbypassable PreToolUse guard on `git push`, `gh pr create`, and `git merge` onto base branches:

- **Refusal (exit 2)**: Rejects actions if the branch dispatch record lacks a passing gate record, or if the lane was never recorded as `durable` in the state store (`transitions.jsonl`).
- **Scope**: Evaluates only the specific branch being pushed/merged.
- **Bypass**: Can be overridden with `POLICY-OVERRIDE` plus an explicit audit reason.

## 3. DoD freezing and verification

Leverages standalone freezing utilities from `loom`:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/loom/scripts/dod-freeze.mjs \
  --dod <run>/dod.json --checks-dir <run>/checks
```

- Every check script is written to `<run>/checks` with a cryptographically locked sha256 hash.
- When `<run>/dod.json` exists, `gate-guard.sh` blocks PR creation until an `evidence/` record with `kind: "dod_gate"` reports `all_passed: true`.
- Tampering with check scripts invalidates hashes and causes verification failure.
