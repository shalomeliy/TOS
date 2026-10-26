# Spec - Version 4: Stowage planning practice ("be the planner")

Status: **draft, waiting for Shalom's approval** (2026-10-26). Roadmap: `docs/ROADMAP.md` row 4. Builds on version 3 (`docs/specs/stowage-plan.md`).

## Context and observed problem
In version 3 the computer builds the stowage plan and the learner only watches. The roadmap goal for version 4 is the other side: the learner is the vessel planner, places the containers himself, and the system marks every rule break and explains it. Today there is no way to put a container in a slot by hand.

## Target user and decision
Shalom, learning. After this version he should be able to answer: "if I put this box here, what goes wrong at which port, and why does the computer plan it differently?"

## Outcome
- The learner plans a vessel by hand and sees, at once, which placements break which rule.
- He can compare his plan with the automatic one, as a score.
- Optionally he loads the vessel with his own plan and sees what it costs.

## Goal
1. On the Stowage Plan screen, a vessel that is ARRIVED (not yet working) can be planned **by hand** instead of automatically: button "Plan it myself".
2. A side list "Waiting to be placed" shows the vessel's exports in the yard: unit, size, POD (stop 1-3), weight. The learner picks one, then clicks a slot.
3. Each placement is checked at once:
   - **Hard rules (the move is refused, with the reason):** a 40' box only in the 40' bay and a 20' box only in a 20' bay; a box cannot float (the slot below must already hold a planned export; an import still on board does not count, because it leaves before loading starts).
   - **Soft rules (allowed, marked with a red "!" and the reason):** a box for a later stop above a box for an earlier stop (it will have to be moved at that port); a heavier box above a lighter one for the same port.
4. The learner can remove a box from a slot (back to the list), or clear the whole plan and start again. A box that has another box on top of it cannot be removed: take the top one off first (same as on a real ship), and the refusal says so.
5. A score line: "Placed 7 / 10, rule breaks 2 (1 port order, 1 weight)", and **"Compare with the automatic plan"**: the automatic plan's breaks (always 0) next to his, and how many extra moves his plan would cause at later ports.
6. When every box is placed, "Start work with my plan" runs the vessel exactly like version 3, but with his slots. Rule breaks stay marked.
7. "Let the computer plan" fills the rest automatically at any time.

## Non-goals
- Drag and drop (click to pick, click to place, which also works with a keyboard and on a phone).
- Stability, lashing, reefer plugs, dangerous goods, crane split (later versions).
- Saving several practice attempts or a high score table (version 19, training mode).

## Assumptions
- Practice works on the vessels already in the demo (MV Harbor Lesson has 10 exports). No separate exercise generator.
- Imports still on board do not block placement: the export slot is used after discharge, as in version 3.
- "Extra moves at later ports" = for every box, 1 move for each box for an earlier stop anywhere under it in the same stack (it must be lifted off at that port and put back). A simple count, explained in Hebrew. The automatic plan always scores 0.
- "Waiting to be placed" = the vessel's exports in the yard that have no slot yet, recomputed on every screen; an export that gates in during practice appears there too.
- Load order of a hand plan is not the click order: at Start work every slot is renumbered bottom tier first, so loading never waits on a box that is not coming.
- "Let the computer plan" places the boxes still waiting with the version 3 rules, around what is already placed, bottom-up; a box with no legal slot left is short-shipped as in version 3.
- Saved state: `STATE_VER` 4; the step only bumps the number (a plan without `manual` is automatic).

## Decisions for Shalom
- **D1 - which rules stop the move.** (a) Size and "no floating" are refused; port order and weight are allowed with a warning (recommended: you can make the classic mistake and see its cost, but not build something physically impossible). (b) Every rule is refused. (c) Nothing is refused, only warnings.
- **D2 - what a hand-made plan is used for.** (a) It can be used for real loading ("Start work with my plan") (recommended: you see the result run). (b) Practice only; the real loading always uses the automatic plan.

## Proposed experience
- Stowage Plan, vessel ARRIVED: two buttons "Plan it myself" and "Let the computer plan".
- In "plan it myself": the bay drawing as in version 3; beside it the "Waiting to be placed" list (each row a button). Picking a box opens a bay that fits its size and shows "Picked: unit, size, stop, weight" with Cancel above the drawing (on a phone the list is below the drawing, so the line keeps the choice visible). Slots it may go into are outlined in green, impossible slots greyed.
- Click meaning: with a box picked, clicking a slot places it (or shows the Hebrew refusal). With nothing picked, clicking a slot shows its details, with a "Remove" button for a hand-placed box.
- Refusals and warnings are in Hebrew, in a message area that screen readers announce (`aria-live`), not by colour alone.
- After placing: the slot shows the box; a soft break gets the red "!" and a Hebrew reason in the side panel.
- Score line under the summary. "Compare with the automatic plan" opens a small table: mine vs computer.
- Every new button, list row, column, tag and score part gets a Hebrew tooltip (project rule).

## System / data implications
- The visit's existing `plan` is reused; a hand placement writes the same `{ unit, seq }` entry, with `manual: true`. The order of loading follows the bottom-up order of the slots.
- Start work keeps a hand-made plan instead of building a new one (only if the learner chose it).
- Saved state: `STATE_VER` 4, a migration step that adds nothing harmful (old plans stay automatic).

## Acceptance criteria (observable)
1. On an ARRIVED vessel, "Plan it myself" shows the waiting list with every yard export of that vessel.
2. Placing a 40' box in a 20' bay is refused with a Hebrew reason, and nothing changes.
3. Placing a box above an empty slot is refused with a Hebrew reason.
4. Placing a stop-3 box above a stop-1 box is allowed and shows "!" with a reason; the score counts 1 port-order break.
5. Removing a box returns it to the list and clears any warning it caused.
6. "Compare" shows the automatic plan with 0 breaks next to the learner's count, and the extra-moves count.
7. "Start work with my plan" loads every box into the learner's slots, never floating, and the vessel completes.
8. "Let the computer plan" fills the remaining boxes without breaking any rule given what is already placed (or marks the unavoidable ones).
9. Keyboard: list rows and slots are buttons; the whole flow works without a mouse. 390 px: no sideways page scroll.
10. Tooltip audit passes; old saves load.

## States
- **Nothing placed**: "Pick a box from the list, then a slot."
- **Box picked**: valid slots outlined, others greyed.
- **Refused move**: red message with the reason, nothing changes.
- **Partly placed**: score line, Start work disabled until all are placed or the computer fills the rest.
- **Vessel already working**: practice closed, the plan is shown read-only.

## Accessibility, security, privacy
Same patterns as version 3 (buttons, aria-labels, meaning not by colour alone). SECURITY NOT TRIGGERED: no new input beyond clicks, no network.

## Verification plan
- Rule checks called directly: size refusal, floating refusal, soft-break count, removal clears warnings.
- Through the page: plan MV Harbor Lesson by hand in a known bad order, compare, start work, vessel completes.
- Tooltip audit, 390 px, old saves (v3 fixture).
- Hebrew test guide `docs/guides/v4-test-guide.md`.

## Expert input (fan-in)
- Product / QA: removal and Start work must be gap-proof; define the waiting list, "extra moves", and what the computer does with leftovers. Taken into Goal 4, Assumptions.
- Architecture: renumber the load order bottom-up at Start work; reuse `buildPlan` without resetting for "let the computer plan"; use the export-only view for "no floating"; the save step is only a version bump. `index.html` stays one file (about 1300 lines, one clear stowage block); `HANDOFF.md` should keep only the current version's test guide, older guides live in `docs/guides/`.
- Design: picking jumps to a fitting bay and shows the pick; one click meaning per state; Hebrew refusals with `aria-live`.

## Spike (before plan)
Riskiest assumption: a hand-made plan with soft breaks, and "let the computer fill the rest" on top of a partial hand plan, still loads with no floating box and no deadlock. The spike builds such plans in the page and runs the vessel.
