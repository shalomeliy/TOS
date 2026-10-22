# Spec - Version 2: Automatic stowage plan (Autostow-style)

Status: **draft, waiting for user decisions D1 and D2**. Roadmap: `docs/ROADMAP.md` row 2.

## Context and observed problem
Today a vessel is a black box: LOAD work instructions run in creation order and loaded units just become `LOADED` with no position (`complete`, `cycle` in `index.html`). The learner never sees *where* a container goes on the ship, or why order matters. In real terminals that is the vessel planner's core job (public N4 concept: Vessel Autostow).

## Target user and decision
Shalom, learning. The question he should be able to answer after this version: "why does this container go in this slot, and why is it loaded before that one?"

## Outcome
- Learner sees a vessel bay plan fill up as loading runs, with a plain reason per slot.
- Learner sees the tradeoff between ship order and yard order (yard rehandles go up when the ship order fights the yard stacking).

## Goal
1. Each vessel visit has a small ship layout: bays, rows across, tiers up, hold below deck and deck above.
2. Each vessel visit has a route of ports (e.g. 3 ports). Each export unit has a port of discharge (POD) on that route.
3. When work starts, the system builds a plan: every export bound for the vessel gets a planned slot by fixed rules:
   - later POD lower (so it is not dug out at an earlier port),
   - within the same POD, heavier lower,
   - 20' units only in 20' bays, 40' units only in 40' bays (no mixing in v2).
4. LOAD work follows the plan: bottom tier before top tier in each stack; a LOAD is not sent to the crane until the slot below it is filled.
5. Imports on an arriving vessel start in vessel slots too; DISCHARGE goes top tier first.
6. New screen "Stowage Plan" (under Vessel) shows one bay at a time; planned vs loaded vs violation are visible as text and shape, not only color.

## Non-goals (v2)
- Learner editing the plan, drag and drop, "find the mistakes" exercise (that is version 3).
- Ship stability, lashing, reefer plugs, dangerous goods, visibility line.
- Real BAPLIE / EDI.
- Splitting Unit vs Unit Visit (version 4).

## Assumptions
- One ship layout shared by all vessels in the demo (e.g. 4 bays x 4 rows x 2 hold tiers + 2 deck tiers), sized so the demo vessels fit with some free slots.
- Slot address shown as bay-row-tier with real-style numbers (hold tiers 02, 04..., deck tiers 82, 84...).
- Weights stay seeded, but seeding becomes deterministic so tests are stable.

## Proposed experience
- **Vessel Visits**: new "Plan" column: `not planned` / `18 planned, 7 loaded` / `2 warnings`. Button "Stowage plan" opens the screen for that visit.
- **Stowage Plan screen**: header + N4 concept line + Hebrew help box (same pattern as other screens). Bay selector with Prev/Next. Bay drawn as a cross-section: rows across, tiers up, thick hatch line between hold and deck. Color mode switch: by POD (default) or by weight.
  - Planned slot: dashed outline, light tint, POD code text.
  - Loaded slot: solid fill.
  - Violation: red border + "!" + reason in the side panel.
  - Click a slot: side panel shows unit, POD, weight, yard position, planned/loaded, and the one-line Hebrew reason ("נמל אחרון, לכן למטה" / "כבדה, לכן למטה").
  - Summary line: "Planned 18 / Loaded 7 / Warnings 2".
- **Gate in**: export form gets a POD select from the chosen visit's route.
- **Overview / Yard**: rehandle counter already exists; Stowage screen also shows "yard rehandles caused by this load".
- **How it maps to N4** page: row updated for Autostow.

## System / data implications (no file plan here)
- Visit gains route and bay plan; unit gains POD and planned vessel slot.
- Saved state from version 1 lacks these fields: loading an old save must not crash; old visits already working keep the old unplanned behavior.
- Plan is built when work starts and is then frozen, except for late arrivals (see states).

## Acceptance criteria (observable)
1. After "Start work", every export of that visit that is in the yard has a planned slot shown on the Stowage screen.
2. In the plan, no slot has a later-POD unit above an earlier-POD unit, and within the same POD no heavier unit above a lighter one.
3. No 40' unit in a 20' bay and the reverse.
4. During loading, a slot is never shown loaded while the slot below it is empty.
5. When loading finishes, every planned slot is loaded and every such unit is `LOADED`.
6. Imports are discharged top tier first; their slots empty in that order.
7. The Stowage screen shows planned / loaded / warning as text or outline, not color alone; slots are keyboard reachable buttons.
8. Loading a version 1 save works with no console error.
9. Reset builds a fresh demo with no plan left over.

## States
- **Empty**: visit not started: "No stowage plan yet. It is built when work starts." plus a preview.
- **Partial**: counter + filled slots.
- **Complete**: COMPLETE tag.
- **Late gate-in** (export arrives while vessel WORKING): gets the best still-free valid slot; if that breaks a rule, it is a **warning** (see D2).
- **Plan full / no size fit**: unit gets no slot, stays in yard, logged, counted as "short-shipped" at depart.
- **Unit on hold** (future: holds on exports): not loaded until released.
- **Depart with planned-not-loaded**: those units are "rolled": slot cleared, unit stays in yard, count shown.

## Accessibility, security, privacy
- Slots are `<button>`s with full aria-label (slot, unit, POD, weight, status). Meaning never by color alone.
- Phone width 390px: bay drawing scrolls inside its panel; page itself does not scroll sideways.
- SECURITY NOT TRIGGERED: no auth, no external input beyond the local form, no network, no new dependency.

## Verification plan
- `node tools/smoke.mjs` extended: Stowage page renders; plan obeys rules 2-3 after start; loading never floats (rule 4); all planned slots loaded at end; late gate-in gets a slot; old-save JSON injected and loaded; 390px check on the Stowage page.
- Deterministic seed for weights/holds in tests.
- Screenshot of the bay plan mid-loading, reviewed by eye.

## Spike (before plan)
Riskiest assumption: loading in plan order (POD, weight) through the current yard stacking still finishes in a reasonable number of cycles, and the extra yard rehandles stay understandable rather than looking like a bug. Spike measures cycles and rehandles for the demo vessel with plan-order loading vs today's order.

## Open decisions
- **D1 - where POD comes from**: (a) each line has a fixed route, seeded exports get a random POD from it, gate-in form lets you pick (recommended); (b) random only; (c) always picked by hand.
- **D2 - rule break**: (a) warning only, loading continues (recommended for v2; the auto-planner itself never breaks rules, only late arrivals can); (b) block the load until fixed.
- Decided without asking (reversible): 20'/40' in separate bays; one ship layout for all vessels; "watch the planner" now, "be the planner" in version 3.

## Expert input (fan-in)
- Product: smallest valuable version is a readable automatic plan; drag mode is a separate feature (moved to v3). Risk: plan order fights yard order, so show yard rehandles on purpose.
- Architecture: keep plan on the visit and slot on the unit, single file, add state normalization on load, gate LOAD on "slot below filled", discharge top first.
- Design: one bay at a time like a real bay plan, fill = POD, outline = loaded vs planned, weight as a mode switch, violations by border + "!" + text, slots as buttons.
- QA: rules must be testable without the UI, deterministic seed, old-save test, define late gate-in and full-plan behavior before building.
