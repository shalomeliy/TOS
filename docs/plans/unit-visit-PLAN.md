# Plan - Version 5: Unit vs Unit Facility Visit

Spec: `docs/specs/unit-visit.md` (D1 = a light, D2 = a gate return). Spike skipped: every part is already proven here (state changes happen in a few known places; a new screen like the others; a save migration step). Status: **waiting for Shalom's approval**.

## Changes (`index.html`)
- **Data per container:** `transit` (current N4 transit state) and `visits: [{ id: 'UFV0001', category, inBy, outBy, inTime, outTime, steps: [{ state, time }] }]`; the last visit is the current one. `S.seq.ufv` counter.
- **One helper** `setTransit(u, state)`: sets `u.transit`, appends `{ state, time: S.clock }` to the current visit (no duplicate of the same state). `openVisit(u, category, inBy)` starts a new visit; `closeVisit(u, outBy)` sets out time.
- **Calls (mapping table in the spec):** `addVisit` imports -> ADVISED (inBy = vessel); `arrive` -> its imports INBOUND; `tryDispatch` DISCHARGE -> EC/IN; gate-in accepted -> EC/IN (inBy = truck); `complete` DISCHARGE / GATE_IN -> YARD; `newWI` LOAD / GATE_OUT -> EC/OUT; `complete` LOAD -> LOADED; `complete` GATE_OUT -> DEPARTED (outBy = truck); `depart` -> loaded boxes DEPARTED (outBy = vessel). Seeded yard boxes get one visit already at YARD.
- **Returning container:** gate-in form list "Returning container": "new number" or a DEPARTED container. Choosing one resets visit, vessel, slot, POD, holds, short, times, wi; opens a new visit (category EMPTY) at EC/IN.
- **Screen `inspector`** (Yard > Unit Inspector): search field + list of all containers incl. departed; Unit block (number, line, owner code, type and size); Visits table (newest first, click a row to select); life cycle of the selected visit as a vertical list of the 7 states with "reached HH:MM / now / not yet"; moves (WIs) and charges of that visit; "Show in yard" button when in a slot.
- **Links:** `ACTIONS.unit` opens the Inspector everywhere; `TIPS.unit` rewritten.
- **Inventory:** "Transit state" column replaces "State".
- **Saved state:** `STATE_VER = 5`; `MIGRATE[4]` gives each container one visit and a transit state derived from its state and its vessel's phase (unknown times = the save's clock).
- **Help:** `SCREEN_TIPS.inspector`, `PAGE_TIPS.inspector`, `INFO` for every new heading, column and the 7 states, help box; mapping row "Unit vs UFV"; `APP_VERSION = 'v5.0'`.

## Tests (`tools/smoke.mjs`)
Import life cycle ADVISED -> INBOUND -> EC/IN -> YARD -> EC/OUT -> DEPARTED with times; export EC/IN -> YARD -> EC/OUT -> LOADED -> DEPARTED; rejected gate-out and rehandle add no step; returning container: same number, 2 visits, old one closed, new EC/IN then YARD; Inventory column matches; v4 / v3 / v1 saves load; Inspector page in the tooltip audit; 390 px. `tools/fixtures/save-v4.json` from the current build.

## Order
1. Fixture. 2. Helper + calls + migration + tests. 3. Inspector screen, links, column, gate list + tests. 4. Change review, smoke, v5 guide, HANDOFF, DECISIONS, commit, push.

## Risks
A missed state change leaves a wrong step: covered by the full life-cycle tests above. Old saves get a short history (one visit, steps from now): stated in the Inspector as "history before version 5 is not known".

## Built (2026-10-26)
- Change review: REPAIR. Fixed: a late export skipped YARD (its LOAD job is made in the same cycle; YARD is now recorded first); old saves with containers that had left now keep their real out time; moves and charges carry their visit id, so a box that returns at once never shows the same move under both visits; the Unit column tooltip now says it opens the Inspector. Tests added for the late export and the old departed container. Smoke passes.
