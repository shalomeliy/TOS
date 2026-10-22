# Plan - Version 2: Ashdod South Port (scaled x4) + saved-state versioning

Spec: `docs/specs/ashdod-south-port.md` (approved, D1 = a, D2 = a, D3 = a). Spike: `docs/spikes/ashdod-south-port.md` (GO).
Status: **waiting for Shalom's approval**.

## 1. Current architecture (what this touches)
Single file `index.html`. Global state `S`, built by `fresh()` or read by `load()` (raw `JSON.parse`, no checks). Clock `S.clock` = minutes after `T0` (Thu 22-Oct-2026 06:00, shown by `fmt()`). `cycle()` adds 15 min, completes DISPATCHED jobs, arrives vessels by ETA, then calls `tryDispatch()` on PLANNED jobs. `tryDispatch()` picks the first IDLE machine of each type from `needs()` (`'ASC-' + block`). Gate: `FORMS.gatein` creates the unit then the tx; `FORMS.gateout` already rejects on holds. Storage: `daysIn()` = 24-hour blocks, `storageDue()`, `chargeStorage()` at load / gate out. Screens in `VIEWS`, buttons in `ACTIONS`, tooltips in `TIPS` / `SCREEN_TIPS`.

## 2. Thin end-to-end slice
Save versioning first (it protects everything after it), then the calendar rules as pure functions, then the equipment and quays, then the screens.

## 3. Changes by file
- `index.html`
  - **Constants:** `STATE_VER = 2`; `QUAYS = [{ id: '27', len: 200 }, { id: '28', len: 111 }]` with the real lengths in the label; work and gate windows as data.
  - **Time rules (pure, only depend on minutes):** `dayIndex(m)`, `weekday(m)`, `isWorkTime(m)` (false Fri 15:00 to Sat 20:00), `isGateOpen(m)` (Sun-Thu 05:00-24:00, Fri 05:00-14:45), `nextGateOpen(m)`, `storageDays(inM, outM)` (calendar days touched, Saturday skipped). `daysIn()` uses `storageDays()`.
  - **State:** `fresh()` sets `ver`, gives each visit a `quay` (V001 -> 27, V002 -> 28), creates `ASC-A1`, `ASC-A2` ... `ASC-D2` (type stays `ASC-A` etc., so `needs()` and `tryDispatch()` do not change).
  - **Load:** `load()` parses, checks the basic shape, then `normalize(raw)` runs one step per version. Step 1 -> 2: visits get `quay` (active visits spread over free quays), `ASC-X` renamed `ASC-X1` everywhere (machine list and every job's `eq` list), `ASC-X2` added, `ver = 2`, one log line. Unknown future version, bad shape or any error -> `fresh()` plus a message. Failure never leaves a half-loaded state.
  - **Cycle:** dispatch loop skipped when `!isWorkTime(S.clock)` (jobs get note "Shabbat"); completions still run. Log one line when Shabbat starts and one when work resumes (compare previous clock to the new one, so "jump one day" is covered too).
  - **Quays:** `arrive()` only if the visit's quay has no ARRIVED / WORKING vessel; otherwise the visit stays INBOUND with `wait = 'Waiting for quay 27'`. "Arrive now" says the same in a flash. Create form gets a quay select.
  - **Gate:** both forms check `isGateOpen()` first. Closed -> a REJECTED tx with "Gate closed until Sun 05:00" style reason, and for gate-in **no unit is created**. Gate table handles a tx with no unit.
  - **Screens:** clock shows weekday plus a text chip (`WORKING` / `GATE CLOSED` / `SHABBAT`); status bar repeats it. Overview gets a "Terminal layout" panel (two quays to scale with their vessel, 4 blocks with their 2 ASCs, a rail siding, "scaled x4" note), scrolling inside its own box. Vessel table gets a Quay column and the waiting reason. Equipment shows idle machines as "Shabbat" during the pause. Storage note says "N days (Saturday not counted)". Mapping page: an Ashdod row with the Konecranes note.
  - **Help:** Hebrew tooltips for every new control, chip and column; `SCREEN_TIPS` and the yellow help boxes updated for Overview, Vessels, Gate, Equipment, Billing.
- `tools/smoke.mjs` - new checks (section 6).
- `tools/fixtures/save-v1.json` - a real save captured from today's build (before any change), with jobs in progress.
- `HANDOFF.md`, `docs/ROADMAP.md`, `DECISIONS.md` - status at the end.

## 4. Behaviour on failure
- Broken / unknown save: fresh port, flash "Saved game could not be read, started a new port", no console error.
- Gate closed: rejection with reason, nothing else changes.
- Quay busy: vessel waits, no error.

## 5. UI state
No new UI state beyond what `S` holds; the chip and the layout panel are derived from `S.clock`, `S.visits`, `S.eq` on each `render()`.

## 6. Tests (cheapest layer first)
- Time rules called directly in the page: Fri 14:45 / 15:00, Sat 19:45 / 20:00, Sat 20:00 gate still closed, Sun 05:00 gate open, nights 00:00-05:00 closed, Fri 10:00 -> Sun 10:00 = 2 storage days, a seed unit with negative time.
- Through the page: gate-in at Fri 15:00 rejected and no unit created; gate-out on Saturday rejected; "jump one day" from Friday shows SHABBAT; a second vessel for quay 27 waits.
- Save: load `save-v1.json` -> no error, `ver = 2`, 8 ASCs, clock and invoices kept, cycles finish its jobs; a broken save -> fresh port with the message.
- The existing scripted day stays green (it ends early Friday, before the gate closes), plus the tooltip audit.
- Equipment list = 2 QC, 4 AGV, 8 ASC; 390 px no sideways scroll.

## 7. Risks, rollback, non-goals
- Risk: the scripted day drifts into Friday 14:45 if timings change. Mitigation: the test checks the clock before the gate steps.
- Risk: storage amounts change for everyone (calendar days instead of 24-hour blocks). That is intended (D1).
- Rollback: one commit; old saves from v1 are converted, so reverting would need "Reset demo".
- Non-goals: berth windows (v6), trains (v7), appointments (v8), travel times (v13), holidays, daylight saving.

## 8. Order, with a check after each step
1. Capture `save-v1.json` from today's build. Check: file has jobs in progress.
2. Versioned load + `normalize()` + equipment ids. Check: smoke + fixture test.
3. Time rules + storage days. Check: time-rule tests.
4. Shabbat pause in `cycle()` + log lines + chip. Check: Friday-Sunday test.
5. Gate hours. Check: gate rejection tests.
6. Quays + create form + waiting. Check: busy-quay test.
7. Layout panel, mapping row, help texts, tooltips. Check: tooltip audit, 390 px, screenshot by eye.
8. Full smoke, update `HANDOFF.md` / `ROADMAP.md` / `DECISIONS.md`, commit (no push).

## Built (2026-10-22): deviations from the spec, on purpose
- A quay stays taken while its vessel is COMPLETE too, not only ARRIVED / WORKING: a finished vessel is still alongside until it departs.
- Converting a version 1 save renames `ASC-A` to `ASC-A1` (and so on) in the machine list and in every job together, so the names match a fresh port. Old log lines keep the old names.
- Converting gives old visits that are not at a quay alternating quays (27, 28), not all 27, so two old vessels do not queue for the same quay.
- Loading also fills missing counters and settings, and refuses a save whose units point at yard slots that do not exist.
- Change review: REPAIR (two criteria had no test evidence). Fixed: a test that a waiting vessel berths when the quay frees, and a version 1 save with an invoice whose invoices and charges are kept. Smoke passes.
