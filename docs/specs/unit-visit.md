# Spec - Version 5: Unit vs Unit Facility Visit (a container and its visits)

Status: **draft, waiting for Shalom's decisions** (2026-10-26). Roadmap: `docs/ROADMAP.md` row 5. Research: `N4-data-model-research.md` sections 1, 2, 9.

## Context and observed problem
In the simulator one record is both "the container" and "its stay in the port". When a container leaves, its story ends; if the same physical box came back, it would get a new number. In N4 (public sources) the **Unit** (the box: number, type, owner) is separate from the **Unit Facility Visit, UFV** (one stay in one terminal: category, carriers, position, times, state). A box that returns months later keeps its number and gets a new UFV. N4 also tracks a finer life-cycle state inside a visit, the **transit state**: Advised, Inbound, EC/In, Yard, EC/Out, Loaded, Departed. Today the simulator has only ON_VESSEL / AT_GATE / YARD / LOADED / DEPARTED, with no history.

## Target user and decision
Shalom, learning. After this version he should be able to answer: "what is the difference between a container and a visit, and where in its life is this box right now?"

## Outcome
- Every container shows its **visit history**: each stay in the port, with category, how it came, how it left, and the times.
- Every visit shows its **7-step life cycle** with the time each step was reached.
- A container that already left can **come back** (as an empty return through the gate) with the same number and a new visit.

## Goal
1. Each visit has a transit state from the N4 list, updated by what happens in the simulator:
   - **ADVISED**: expected, not yet certain (on a vessel that has not arrived; an export booked at the gate is created already at EC/In).
   - **INBOUND**: on the carrier at the terminal (vessel at the quay, not yet discharged).
   - **EC/IN**: received, not yet in a yard slot (a discharge job sent to the cranes, or a truck in the gate lane).
   - **YARD**: in a yard slot.
   - **EC/OUT**: on its way out (a load or delivery job exists for it).
   - **LOADED**: on the outbound vessel, which has not sailed.
   - **DEPARTED**: left the terminal.
2. Each step is recorded with its time (a small timeline).
3. New screen **Yard > Unit Inspector**: pick or search a container number; it shows the **Unit** part (number, owner line, type and size) and a **Visits** table (visit number, category, came by, left by, in time, out time, final state), and for the selected visit the timeline of transit states and its moves (work instructions) and charges.
4. Unit Inventory shows **Transit state** instead of the old State column (one column, with the N4 name). Every container number in every screen opens the Unit Inspector; the Inspector has "Show in yard" for a box in a yard slot. The Inspector's list includes containers that already left.
5. **Coming back:** the gate-in "Empty return" form gets a list "Returning container" with the containers that left the port (or "new number"). Choosing one gives the same Unit a new visit (category EMPTY); the old visit stays in its history, and everything that belonged to the old visit (vessel, slot, POD, holds, times) is cleared for the new one. Only containers that left are in the list, so a box still in the port cannot be chosen.

## Transit state mapping (what moves a visit to the next step)
| Event in the simulator | Transit state |
|---|---|
| Import on a vessel that is INBOUND (also while it waits for a quay) | ADVISED |
| That vessel arrives at the quay | INBOUND |
| Discharge job sent to the cranes | EC/IN |
| Truck accepted at the gate with a box (gate in) | EC/IN |
| Box placed in a yard slot | YARD |
| Load job or delivery job created for the box | EC/OUT |
| Box loaded on the vessel | LOADED |
| Truck leaves with the box, or the vessel sails with it | DEPARTED |

No step is recorded for a rejected truck, a rehandle (the box only changes slot), or a short-shipped or rolled export (it stays YARD; the history shows the log line).

## Non-goals
- Damages, seals, flex fields, holds per visit (version 10 for holds).
- Rail and truck appointments as carriers (versions 7, 8).
- Transshipment (version 15).

## Decisions for Shalom
- **D1 - how deep the split goes.**
  (a) Light: the container record keeps its current stay as today, and gains a `visits` list (one entry per stay) plus the transit state and its timeline. What you see on screen is the full N4 idea; inside, the code changes little (recommended: low risk, the lesson is the same).
  (b) Full: two separate tables in the data, Unit and UFV, and every part of the simulator reads the visit table. Closer to N4 inside, but it touches almost every function and every old save.
- **D2 - how a container comes back.**
  (a) Through the gate, as an empty return, by typing or choosing a number that left before (recommended: the most common real case, a box that delivered its cargo and is returned empty).
  (b) Also on a new vessel as an import, chosen when the vessel visit is created.

## Proposed experience
- Unit Inspector: top part "Unit" (permanent identity), below "Visits" table (newest first), below "Life cycle of visit ..." as a row of 7 steps: reached steps show their time, the current one highlighted, future ones grey. Every part explained by a Hebrew tooltip.
- Inventory: new column "Transit state" with the N4 names.
- Gate: in "Receive (gate in)", a list "Returning container" ("new number" or a container that left). Used for an empty return.
- Mapping page: a row explaining Unit vs UFV and the transit states.

## System / data implications
- Per container: `visits: [{ id, category, inBy, outBy, inTime, outTime, steps: [{ state, time }] }]`, the last one is the current visit; `transit` = current state.
- Every place that changes `u.state` also records the transit step (one helper).
- Saved state `STATE_VER` 5: old containers get one visit built from what they have now (steps known only from their current state, with the current clock as time where unknown).

## Acceptance criteria (observable)
1. An import on a vessel that has not arrived is ADVISED; after the vessel arrives INBOUND; when its discharge job is sent EC/IN; after it lands in the yard YARD; when a delivery is accepted at the gate EC/OUT; after the truck leaves DEPARTED. Each step has its time in the Unit Inspector.
2. An export goes EC/IN (gate lane) -> YARD -> EC/OUT (load job) -> LOADED -> DEPARTED (vessel departs).
3. Unit Inventory shows the Transit state column, matching the Inspector.
4. An empty return with the number of a DEPARTED container: same number, 2 visits in the Inspector, the first one closed with its out time, the new one EC/IN then YARD.
5. The returning list holds only DEPARTED containers; a rejected truck adds no step; a rehandle adds no step.
6. Old saves (v4, v3 fixtures) load; each container has 1 visit and a transit state consistent with its state.
7. Tooltip audit passes (new screen, column, steps); 390 px no sideways scroll.

## States
- No container selected: list of containers to pick, and a search field.
- Container with one visit: the table has one row.
- Returning container: two or more rows.

## Accessibility, security, privacy
Steps shown as text plus highlight (not colour alone). SECURITY NOT TRIGGERED: a typed container number is the only new input; it is only looked up, never run or stored as HTML.

## Verification plan
Direct checks of each transition; a full import and export life cycle through the page; a returning container; old saves; tooltip audit; 390 px; Hebrew test guide `docs/guides/v5-test-guide.md`.

## Expert input (fan-in)
- Product / QA / architecture: one helper records every step; a full mapping table (above); defined what records no step; the return path clears everything of the old visit.
- Design: every container number opens the Inspector (one meaning everywhere); Transit state replaces State instead of a 13th column; the timeline as a vertical list with "reached / now / not yet" text; departed containers must be reachable; a pick-list instead of typing.

## Spike
Needed only for D1 = (b). With D1 = (a) every part is already proven (state changes happen in five known places; a new screen like the others), so the spike would be skipped.
