---
name: plan-check
description: This skill should be used to rigorously VERIFY a plan before it is executed — an ops/infra runbook (e.g. a Ceph cluster fix), a code-change plan, or a mix. It treats the plan as a map and pressure-tests it against the territory (official docs + version release notes for ops; the actual repo for code), interrogating the human claim-by-claim to surface unknowns, then emits a self-contained HTML verification report plus a GO / GO-WITH-CONDITIONS / NO-GO verdict. Triggers when the user asks to "verify this plan", "sanity-check this runbook", "is this plan safe to run", "find the holes in this plan", "pressure-test this migration/fix before I run it", or pastes a plan / plan-deck and wants it validated rather than executed. Read-only by default — it NEVER runs commands against live systems, and only does local dry-runs when the human explicitly hands it an environment. NOT for writing a plan (use plan-deck) or executing one.
---

# plan-check

A plan is a **map**; the codebase, cluster and real world are the **territory**. plan-check
is an unknowns-finder, not a reviewer: it interrogates each claim, checks it against real
evidence, hunts what the plan never named, and ends with a self-contained HTML report and a
**GO / GO-WITH-CONDITIONS / NO-GO** verdict.

Every gap is tagged to one quadrant (`data-quadrant`):

| Quadrant | In a plan | How plan-check handles it |
|---|---|---|
| **known-known** | explicit claims | verify against evidence (web / repo) |
| **known-unknown** | TBDs the plan admits | confirm actually resolved, not hand-waved |
| **unknown-known** | tacit assumptions never written | **interrogate them out of you** |
| **unknown-unknown** | potholes nobody considered | **blind-spot pass** (highest value) |

## When to use

Before running a runbook, migration, infra fix, or code-change plan where being
wrong is costly, and you want the holes found — not the plan rewritten.

**Not for:** writing a plan (→ `plan-deck`), executing one, or posting PR review
comments. If the request is "do the plan," this is the wrong skill.

## Inputs

- **The plan** — pasted text, a file path, or a `plan-deck` HTML file. Ask if missing.
- **Optional environment** — a sandbox path + commands + docs, ONLY if you want
  local dry-runs. Never assumed, never auto-detected.

<non-negotiable>
Read-only + web by default. NEVER run commands against a live system. Local
dry-run / reproduction happens ONLY against an environment the human explicitly
hands over. When in doubt, reason and flag rather than run.
</non-negotiable>

<non-negotiable>
No verdict while an askable question is open. You may NOT emit a verdict (step 7) or
the report (step 8) while any UNVERIFIED proposition is still **askable of the human**.
Ask it first (step 5). Only propositions tagged `needs: run on target` — answerable
solely by touching a live system that was NOT handed to you — may remain open, and only
as conditions-to-clear. A verdict emitted with an unasked askable question is invalid.
</non-negotiable>

## Workflow

1. **Ingest & classify** the plan: `ops`, `code`, or `mixed`. State classification explicitly.
   - Capture the plan's **goal** in its own terms (the intended outcome, not the implementation steps).
   - If the plan lacks a stated goal, report it and adjudicate as an `UNSTATED-ASSUMPTION`.
2. **Decompose into atomic propositions**:
   - Trace preconditions, claimed effects, ordering, hidden dependencies, rollback, and unstated assumptions.
   - For plans with task graphs, invert the declared `Files:` lists into a file → tasks map.
   - Treat a file claimed by two tasks or an edge found only in step prose as an explicit proposition (see `references/blind-spot.md`).
3. **Verify from evidence — demand references, not assertions**:
   - *Ops*: Official docs, version release notes, deprecations, CVE trackers.
   - *Code*: Grep/AST analysis — verify functions, APIs, types, and callers exist and match current behavior.
4. **Blind-spot pass**: Hunt unknown-unknowns using checklists in `references/blind-spot.md`.
5. **Interrogation gate (BLOCKS the verdict)**:
   - Enumerate every proposition still `UNVERIFIED`.
   - For askable questions (not tagged `needs: run on target`), prompt the user one by one, hardest first.
   - Do not emit a verdict while an askable `UNVERIFIED` item remains open.
   - Only `needs: run on target` items may remain open as conditions-to-clear.
6. **Adjudicate**: Assign each proposition a quadrant and status (`VERIFIED`, `REFUTED`, `UNVERIFIED`, `UNSTATED-ASSUMPTION`, `BLIND-SPOT-RISK`).
   - **Mandatory coverage row (`data-goal-coverage`)**: *if every DoD criterion were met, would the stated goal be achieved?*
7. **Formulate verdict**:
   - `NO-GO`: Any `REFUTED` proposition on a critical path. State what must change to clear each refutation.
   - `GO-WITH-CONDITIONS`: Open items (`UNVERIFIED` or `BLIND-SPOT-RISK`) remain. Every open item becomes a condition to clear.
   - `GO`: All propositions verified.
   - Tag each open item with a disposition: `fix: mechanical` or `fix: needs-decision`.
8. **Emit the report**: Copy `${CLAUDE_PLUGIN_ROOT}/skills/plan-check/assets/template.html` to `./plan-check-<slug>.html`.
   - **Order**: Lead with verdict-changing risks (refutations, blind spots, conditions); verified rows last. Preserve `<style>`.
   - **Fix disposition**: Carry step 7's disposition onto **every open row** using `<span class="fix">fix: mechanical</span>` or `fix: needs-decision` (machine-checked). Drop the span on non-open rows.
   - **Definition of done (`#dod`)**: Extract success criteria into `#dod` JSON script (`checkable` command exit 0, or `judged` with cited evidence). A plan with no stated criteria derivation receives `BLIND-SPOT-RISK`.
   - **Execution task graph (`#taskgraph`)**: Encode edges as `needs` (output dependency) or `contention` (shared write path). `levels` is **derived** from `needs` edges by validate.mjs, not asserted manually. If no graph exists, supply empty arrays.
9. **Verify output artifact**:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/plan-check/assets/validate.mjs ./plan-check-<slug>.html
   ```
10. **Offer autofix (never automatic)**:
    - Apply only to `fix: mechanical` rows per `references/autofix.md`.
    - The input plan is **never modified**; write fixes to a sibling `<plan>.autofix.md`.
    - Re-run verification (steps 3–6) on touched rows and recompute the verdict.
    - Do not apply autofix to `REFUTED` rows.
11. **Offer handoffs**:
    - Offer `deep-understanding` to internalize critical risks.
    - Offer `plan-deck` to re-author against `REFUTED` rows.

## Quality bar

- **Unknowns-first.** Lead with the unknown-knowns and unknown-unknowns, not the checklist.
- **Evidence, not vibes.** Every `VERIFIED` cites a source (doc URL, `file:line`, command
  output). No source → `UNVERIFIED`, which is a valid answer.
- **Honest verdict.** One `REFUTED` critical path is `NO-GO` — don't soften it.
- **A DoD or no clean GO.** Every report carries the `#dod` block (validate.mjs enforces it);
  a plan that stated no success criteria gets a `BLIND-SPOT-RISK`.
- **Self-contained report.** No external CSS/JS/fonts/images; opens offline.
