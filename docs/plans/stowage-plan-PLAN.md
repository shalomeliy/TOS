# Plan - Version 3: Automatic stowage plan (Autostow-style)

Spec: `docs/specs/stowage-plan.md` (approved 2026-10-22, D1 = a, D2 = a; updated 2026-10-25 for the Ashdod port). Spike: `docs/spikes/stowage-plan.md` (GO, re-run on the Ashdod port: GO).
Status: **waiting for Shalom's approval**.

## 1. Current architecture (what this touches)
`index.html` only. `startWork(v)` creates one DISCHARGE job per import on board and one LOAD job per export in the yard. `cycle()` runs DISCHARGE before LOAD, then by creation time. `complete()` makes a loaded unit `LOADED` with no position on the ship. `addVisit` / `addUnit` use `Math.random` for weights and holds. `depart(v)` counts rolled exports. Saved state is at `STATE_VER = 2` with `MIGRATE` steps.

## 2. Thin end-to-end slice
Data and plan rules first (testable without the screen), then plan-driven loading and discharge, then the Stowage Plan screen, then the gate POD choice and old saves.

## 3. Changes by file
- `index.html`
  - **Data:** `ROUTES` = a fixed route of 3 ports per line (real UN/LOCODE port codes, Ashdod is the loading port). `SHIP` = one layout for every vessel: 20' bays 01 and 03, 40' bay 06, 4 rows, tiers 02 / 04 (hold) and 82 / 84 (deck), so 32 slots for 20' and 16 for 40'. Visit gains `route` and `plan` (`{ slots: { '01-02-82': { unit, status, warn } } }` or `null` = not planned). Unit gains `pod` (1 = first port on the route) and `vslot`.
  - **Deterministic random:** a small seeded generator kept in the state replaces `Math.random` for weights, holds and seeded PODs, so a test can repeat a day exactly.
  - **Plan rules (pure):** `buildPlan(v)` at "Start work": exports in the yard, split by size, sorted by POD (later first), then weight (heavier first), then height in the yard stack (higher first, the spike's tie-break), filled tier by tier from the bottom. `slotBelow(slot)`, `planWarnings(v)` (a later-POD or heavier unit above an earlier-POD or lighter one). Imports on an arriving vessel get slots the same way when the visit is created.
  - **Loading:** LOAD jobs follow the plan order; a LOAD waits with note "Slot below not loaded" until the slot below is loaded. DISCHARGE goes top tier first; a slot waits until the slot above is empty. Visits with `plan = null` (old saves) keep today's order.
  - **Late gate-in** (export arrives while its vessel is WORKING): the lowest free slot of the right size whose slot below is taken; if that breaks a rule it is a warning (D2 = a). No slot of that size left: no LOAD job, the unit stays in the yard and is logged as short-shipped.
  - **Depart:** planned-not-loaded slots are cleared and counted as rolled.
  - **Screens:** new page **Stowage Plan** under Vessel: visit select, bay select with Prev / Next, bay drawn as rows across and tiers up with a thick hatch line, colour mode POD (default) or weight, planned = dashed outline, loaded = solid, warning = red border + "!" + reason. Each slot is a `<button>` with a full `aria-label`; clicking it shows the unit, POD, weight, yard position and the one-line Hebrew reason in a side panel. Summary "Planned N / Loaded N / Warnings N" and "yard rehandles for this vessel". Vessel Visits gets a "Plan" column and a "Stowage plan" button. Gate-in form gets a POD select from the chosen visit's route. Mapping page: Autostow row.
  - **Help:** `SCREEN_TIPS.stowage`, a Hebrew tooltip on every new control (bay buttons, Prev / Next, colour mode, slot buttons, POD select), yellow help box on the new screen.
  - **Saved state:** `STATE_VER = 3`; `MIGRATE[2]` gives visits a route and `plan = null`, gives exports a POD, keeps everything else.
- `tools/smoke.mjs` - new checks (section 6); `stowage` joins the tooltip audit.
- `tools/fixtures/save-v2.json` - a real save captured from today's build (before any change).
- `HANDOFF.md`, `DECISIONS.md` - status at the end.

## 4. Behaviour on failure
- No room of the right size: unit is short-shipped and logged, loading continues.
- Old visit without a plan: loads in the old order, the Stowage screen says "No plan (started before version 3)".
- Broken save: the version 2 rule still applies (fresh port with a message).

## 5. UI state
`UI.stowVisit`, `UI.bay`, `UI.stowMode`, `UI.slot` (not saved). Everything shown is derived from `S` on each `render()`.

## 6. Tests (cheapest layer first)
- Plan rules called directly: after Start work every yard export has a slot; no later-POD above earlier-POD; same POD no heavier above lighter; no 40' in a 20' bay.
- Loading: at no cycle is a slot loaded while the slot below is empty; at the end every planned slot is loaded and every unit `LOADED`; imports leave top tier first.
- Late gate-in gets a slot (or a warning); a full plan short-ships.
- Friday 13:00 start: loading stops at 15:00 with part of the plan loaded and finishes the same plan after Saturday 20:00 with no rule break.
- Saves: `save-v2.json` and `save-v1.json` load with no error and reach version 3; their working vessels finish.
- Stowage page renders, slots reachable with the keyboard, tooltip audit passes, 390 px no sideways scroll.
- Screenshot of a bay mid-loading, checked by eye.

## 7. Risks, rollback, non-goals
- Risk: making random seeded changes the demo's weights and holds. The scripted day must not depend on which unit has a hold; it already picks one by looking.
- Risk: `index.html` grows past the "about 1000 lines" note in `HANDOFF.md`. If it does, splitting into plain `<script src>` files becomes its own small step, not hidden in this version.
- Rollback: one commit; saves at version 3 would need "Reset demo" after a revert.
- Non-goals (spec): editing the plan (v4), stability, lashing, reefer plugs, dangerous goods, real BAPLIE, crane split by bay (v6).

## 8. Order, with a check after each step
1. Capture `save-v2.json` from today's build. Check: file has a working vessel.
2. Seeded random + routes + POD + `MIGRATE[2]`. Check: smoke + both fixtures.
3. Ship layout + `buildPlan` + warnings. Check: plan-rule tests.
4. Plan-driven LOAD and top-first DISCHARGE, late gate-in, depart. Check: loading tests, Friday test.
5. Stowage Plan screen, Vessel column and button, gate POD select. Check: render, keyboard, tooltips, 390 px, screenshot.
6. Mapping and help texts. Check: tooltip audit.
7. Change review, full smoke, `HANDOFF.md` / `DECISIONS.md`, commit (no push).

## Built (2026-10-25)
- Bay selector: bay buttons plus Prev / Next. A slot with an import still on board and an export planned shows both ("then XXX").
- Change review: REPAIR. Blocker found and fixed: a late export could be planned on top of an import that was about to be discharged, so its LOAD waited forever and the vessel never completed. `lateSlot` and `ruleBreak` now look only at exports (planned or loaded). Test added (vessel with 20 imports and 2 late exports completes). Smoke passes.
