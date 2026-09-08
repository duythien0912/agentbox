# Lane Recovery Reference

Comprehensive diagnostic recipes, process state handling, verification sizing, and recovery strategies for stuck, stopped, or dead lanes.

## 1. Discriminating liveness

`agent_status: working` is unreliable during wedges and process stops. Sample the pane twice (~30 seconds apart) and inspect token count and cost:

| Signal | Active / Healthy | Wedged or Stopped |
|---|---|---|
| `↓ Nk tokens` | Advancing | Flat |
| `$N.NN` | Advancing | Flat |
| `(Nm Ns` elapsed | Advancing | **Advancing (not a liveness indicator)** |

Measured: a healthy lane moved `21.4k → 23.3k` tokens and `$2.11 → $2.26` in 25 seconds; opencode wedges held both flat for ~10 minutes.

## 2. Process state inspection (`T` vs `R`/`S`)

Flat counters correspond to two distinct underlying states. Always inspect process state before sending signals:

- **State `T` (Stopped)**: The harness is alive and in memory, but unscheduled due to a signal (e.g., `SIGSTOP`/`SIGTSTP`). `SIGINT` (`ctrl+c`) cannot be delivered to a stopped process. Send `kill -CONT <pid>` to resume.
- **State `R` / `S` (Wedged / Running)**: The harness is scheduled but unresponsive. Send `ctrl+c` via `pane send-keys`, restart the lane via `orch-lane.sh restart`, and transition `wedged → dispatched`.

### Recipes for inspection on macOS/Linux:

Detect stopped opencode harnesses:
```bash
ps -o pid=,stat=,command= -A | grep "[o]pencode --agent" | awk '$2 ~ /T/'
```

Resolve the working directory (and therefore lane worktree) from PID:
```bash
lsof -a -p <pid> -d cwd -Fn | grep '^n' | cut -c2-
```
Match this path against `dispatch/<lane>.json` to locate the target lane.

Signals causing suspension:
- `suspended (signal)`: `SIGSTOP`/`SIGTSTP` delivered from outside.
- `suspended (tty output|input)`: `SIGTTOU`/`SIGTTIN` (mitigated via `stty -tostop`).

## 3. Recovery strategies for dead lanes

When an agent process terminates or disappears, evaluate the three recovery paths:

| Strategy | Safe When | Verification |
|---|---|---|
| **Re-attach** | Pane is still alive and lane state is intact | Query `herdr agent get` + `dispatch/` record; re-arm with `orch-lane.sh restart`. |
| **Redispatch** | Idempotent, no durable side effects committed | Verify whether `HEAD` moved past `sha_at_dispatch`. |
| **Retry-whole** | No external side effects occurred | Worktree is discarded; invalid if the lane pushed branches, opened PRs, or deployed. Record externalization in `evidence/`. |

## 4. Verification and sizing

### Sizing before spending:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/lanes/scripts/triage.mjs --run <slug>
```
Prints the ceiling supported by measurements. `start --role verifier --for <lane>` refuses above it; bypass with `--because "<reason>"` writes a decision record.

### Verification without spending a lane:
Deterministic commands are verified by re-running at the same SHA:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/lanes/scripts/evidence.mjs verify <lane> --run <slug> \
  --check "unit::<cmd>" --check "typecheck::<cmd>" --summary "..."
```
A verifier lane is reserved for active mutation (breaking the check intentionally to prove it can fail) and should run in batches (one verifier per wave).
