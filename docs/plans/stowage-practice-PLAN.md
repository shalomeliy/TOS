# Plan - Version 4: Stowage planning practice

Spec: `docs/specs/stowage-practice.md` (D1 = a, D2 = b). Spike skipped (see spec). Status: **waiting for Shalom's approval**.

## 1. Current architecture
`index.html`: stowage block (`SHIP`, `shipSlots`, `slotBelow/Above`, `buildPlan`, `ruleBreak`, `exportAt`, `slotReason`), `VIEWS.stowage`, `ACTIONS.slot/bay/...`, `TIPS`, `INFO`. `STATE_VER = 3`.

## 2. Changes (all in `index.html` unless said)
- **Data:** `visit.practice = { slots: { key: unitId } } | null`. Never read by loading. `STATE_VER = 4`, `MIGRATE[3]` = version bump only.
- **Rules (pure, on the practice board):** `practiceAt(v, k)`; `canPlace(v, u, k)` returns a Hebrew refusal or null (wrong bay size; slot taken; nothing exported under it); `canRemove(v, k)` (refused if a box is on top); `practiceBreaks(v, k)` (port order, weight vs the box directly under, in Hebrew); `extraMoves(v)` = for each box, the number of earlier-stop boxes anywhere under it in its stack; `practiceWaiting(v)` = the vessel's exports in the yard with no practice slot.
- **"Let the computer plan the rest":** the version 3 order (later stop, heavier, higher in yard) over `practiceWaiting`, into the lowest legal free slot of each bay bottom-up; no slot left = listed as "does not fit".
- **Comparison:** build the automatic plan on a scratch copy (same function as `buildPlan`, without writing to the visit) and show breaks and extra moves side by side.
- **Screen (`VIEWS.stowage`):** for an INBOUND / ARRIVED vessel, buttons "Plan it myself (practice)" / "Clear practice" / "Let the computer plan the rest" / "Compare with the automatic plan"; "Waiting to be placed" list (row buttons); "Picked: ..." line with Cancel; slots green when allowed for the picked box, grey when not; refusal and warning text in an `aria-live` area; score line "Placed N / M, rule breaks K (port order X, weight Y), extra moves at later ports Z". After Start work: practice board read-only next to the real plan.
- **UI state:** `UI.pick`, `UI.view` ('real' | 'practice'). Not saved.
- **Help:** `TIPS` for every new button, `INFO` for every new heading / tag / score part, help box text, `SCREEN_TIPS.stowage` updated, mapping row updated.
- **Version label:** `APP_VERSION = 'v4.0'`.
- `tools/smoke.mjs`: practice checks (section 4); `tools/fixtures/save-v3.json` captured from the current build.
- `docs/guides/v4-test-guide.md` (Hebrew, full) + copy in `HANDOFF.md`; older guide copies move out of `HANDOFF.md` (they stay in `docs/guides/`).

## 3. Failure behaviour
Refused move: Hebrew reason, nothing changes. Practice on a working vessel: read-only. Old saves: version bump, no practice board.

## 4. Tests
- Direct: 40' into a 20' bay refused; box over an empty slot refused; box over an import-only slot refused; stop-3 over stop-1 allowed with 1 port-order break; removing a box with a box on top refused; removing the top one clears its warning; `extraMoves` counts every earlier-stop box underneath; computer-fill-the-rest leaves no float and adds no break of its own; automatic comparison = 0 breaks, 0 extra moves.
- Page: full practice on MV Harbor Lesson by clicks (pick, place, refusal message, remove, compare), then Start work still loads with the automatic plan and completes.
- Tooltip audit, 390 px, v3 save loads.

## 5. Order
1. Capture `save-v3.json`. 2. Data + rules + tests. 3. Screen + help + tests. 4. Change review, full smoke, guide, HANDOFF, commit and push.

## 6. Risks / non-goals
Risk: the stowage screen gets crowded on a phone; mitigated by the "Picked" line and list below the drawing. Non-goals: drag and drop, saving attempts, scores across sessions (version 19).

## Built (2026-10-26)
- Change review: REPAIR. Fixed: the comparison after Start work showed the computer with 0 boxes (it now reads the real plan once one exists); remove / clear / fill now refuse when practice is closed; the test now proves the real plan is identical with and without practice, and checks the comparison after work started. Smoke passes.
