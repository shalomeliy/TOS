# Spec - Version 2: Ashdod South Port (scaled x4) + saved-state versioning

Status: **draft, waiting for Shalom's approval** (2026-10-22). Roadmap: `docs/ROADMAP.md` row 2. Decisions already made: `DECISIONS.md`. Facts: `docs/research/ashdod-south-port.md`.

## Context and observed problem
The simulator is a generic terminal: 4 blocks with 1 ASC each, 2 QC, no quays, a clock that never stops, a gate that is always open, and storage counted in 24-hour blocks (`daysIn`, `index.html:216`). It does not look or behave like a real port the learner knows. Saved games have no version number and are loaded as-is (`load()`, `index.html:280`), so any change to the data shape can break an old save.

## Target user and decision
Shalom, learning. After this version he should be able to answer: "how is a real port laid out (quays, cranes, yard blocks, rail), and why does nothing move on Shabbat?"

## Outcome
- The terminal in the simulator is a scaled-down Ashdod South Port (HCT).
- The work week follows the port: no work on Shabbat, a gate with real hours, and Saturday not charged as a storage day.
- Old saves keep working, and future versions can change the data safely.

## Goal
1. **Layout (x4 down, decided):** quay 27 (800 m -> 200 m) and quay 28 (445 m -> about 111 m); 2 quay cranes; 4 yard blocks with **2 ASC each (8 in total)**; horizontal transport by AGV; one rail siding shown on the map (no trains until version 7).
2. **Berth:** each vessel visit is assigned quay 27 or 28. The learner picks it when creating a visit (default 27). Only one vessel per quay while it is ARRIVED or WORKING; a second vessel for a busy quay waits as INBOUND with the reason shown.
3. **Work calendar (decided):** from Friday 15:00 to Saturday 20:00 no new work is sent to any equipment. Jobs already running at 15:00 finish.
4. **Gate hours (official site):** Sunday-Thursday 05:00-24:00, Friday 05:00-14:45, Saturday closed. A truck outside these hours is **rejected** with a reason that names the rule and the next opening time, like a customs hold today.
5. **Storage (decided):** Saturday is not counted as a storage day. Free days and the daily rate stay as they are.
6. **Clock:** starts Thursday 22-10-2026 06:00 (unchanged) and shows the weekday plus a status chip: `WORKING` / `GATE CLOSED` / `SHABBAT - no work until Sat 20:00`.
7. **Saved state:** the state gets a version number. Loading an older save converts it to the new shape. A save that cannot be converted starts a fresh port with a clear message, never a broken screen.
8. **How it maps to N4** page: says that HCT most likely runs a Konecranes TOS, not N4 (single source), and that the simulator stays "N4-style" as a learning model.

## Non-goals
- Berth planning with time windows and crane split per vessel (version 6).
- Trains, wagons, rail work (version 7).
- Truck appointments (version 8).
- Travel distances and times (version 13). Two ASCs in a block work as "any free one", no waterside/landside split.
- Holidays and holiday eves (only the weekly Shabbat for now).
- Summer/winter clock change. The clock is one "port time".

## Assumptions (defaults, easy to change)
- Quay 28 = 445 m (sources conflict, 445 vs 500).
- Quay-to-yard transport = AGV (not found in research). 4 AGVs kept.
- Yard block size stays as today (6 bays x 2 rows x 4 tiers). The research did not find the real number of slots.
- The clock is port local time, no time zone, no daylight saving.
- A vessel can arrive at its quay during Shabbat, but work on it starts only after Saturday 20:00.

## Decisions for Shalom
- **D1 - how to count storage without Saturday.**
  (a) Count every calendar day the container was in the yard for any part of the day, except Saturday (recommended: easy to check by hand on a calendar).
  (b) Count hours in the yard, subtract Shabbat hours, and round up to days.
- **D2 - what the clock does on Shabbat.**
  (a) Time keeps running and nothing moves; the chip and the log say why (recommended: you see Shabbat happen, and "jump one day" just works).
  (b) The clock skips straight from Friday 15:00 to Saturday 20:00.
- **D3 - old saves from version 1.**
  (a) Convert them: add the missing parts (second ASC per block, quay, version) and keep everything else (recommended).
  (b) Ignore them and start a fresh port.

## Proposed experience
- **Top bar:** `Thu 22-Oct 06:00` plus the status chip in text (not color alone). The status bar repeats the state instead of "Ready".
- **Overview:** new "Terminal layout" panel: two quays drawn to scale with the vessel on each, the 4 blocks with their 2 ASCs, the rail siding. A note: "scaled down x4 from Ashdod South Port".
- **Vessel Visits:** new "Quay" column and a quay select in the create form. A waiting vessel shows "Waiting for quay 27".
- **Gate:** a rejected truck appears in the list with `REJECTED` and "Gate closed: Fri 14:45 - Sun 05:00". Buttons stay clickable, because the rejection teaches the rule.
- **Equipment:** 8 ASC rows (two per block). During Shabbat every idle machine shows "Shabbat".
- **Billing / unit details:** storage line shows "N days (Saturday not counted)".
- **Log:** one line when Shabbat starts and one when work resumes. Not one line per idle cycle.
- Every new control, column and panel gets a Hebrew tooltip, and each changed screen gets an updated Hebrew help box (version 1.1 rule).

## System / data implications (no file plan here)
- Equipment: add the second ASC per block with a new id. Existing ids are kept, so a running job in an old save still finds its crane.
- Visit gains a quay. Old visits get quay 27.
- One rule each for "is work allowed now", "is the gate open now", and "storage days between two times". They depend only on the clock, so they can be tested without the screen.
- State gains a version number. Loading runs one conversion step per version and never trusts the saved object blindly.

## Acceptance criteria (observable)
1. The Overview shows 2 quays, 4 blocks with 2 ASCs each, and a rail siding; the Equipment screen lists 2 QC, 4 AGV, 8 ASC.
2. Clock shows the weekday. Thu 22-Oct 06:00 at start.
3. Fri 14:45: gate accepts a truck. Fri 15:00 (the next slot): gate rejects with a reason and creates no container.
4. Fri 15:00 to Sat 19:45: no job is dispatched; jobs dispatched before 15:00 complete. Sat 20:00: dispatch resumes.
5. Saturday 20:00-24:00: work runs but the gate still rejects. Sunday 05:00: gate opens.
6. A container in the yard from Fri 10:00 to Sun 10:00 is charged 2 storage days (Fri, Sun) under D1 (a).
7. "Jump one day" from Friday lands in Saturday and shows the Shabbat state; the next jump lands on Sunday.
8. A second vessel for a busy quay waits and says why; it berths when the quay is free.
9. Loading a real version 1 save works with no console error and keeps the clock, units and invoices; the save is then at the new version.
10. A broken or unknown save starts a fresh port and says so.
11. The "How it maps to N4" page mentions Konecranes.
12. Page works at 390 px width with no sideways scroll; the layout panel scrolls inside its own box.
13. `node tools/smoke.mjs` passes.

## States
- **Working**: normal.
- **Gate closed, yard working** (Fri 14:45-15:00, Sat 20:00-Sun 05:00, nights 00:00-05:00): chip `GATE CLOSED`.
- **Shabbat**: chip `SHABBAT`, idle equipment shows the reason, auto-run keeps going.
- **Quay busy**: vessel waits with a reason.
- **Old save**: converted silently, one log line "Save upgraded from version 1".
- **Broken save**: fresh port and a message.

## Accessibility, security, privacy
- State and rejections shown as text, not color alone. Layout drawing has a text alternative.
- Phone width 390 px: panels scroll inside, page does not.
- SECURITY NOT TRIGGERED: no login, no network, no new dependency. The only outside input is the browser's own saved state, which is now checked before use.

## Verification plan
- The three time rules are tested directly on the 15-minute grid (Fri 14:45, Fri 15:00, Sat 19:45, Sat 20:00, Sun 05:00, a container spanning Shabbat).
- Through the page: gate-in at Fri 15:00 and on Saturday is refused; "jump one day" from Friday; a busy quay.
- A real version 1 save captured from today's build is loaded in the test; a broken save too.
- The existing scripted day still passes (it runs Thursday into early Friday, before the gate closes), plus one scripted Friday-to-Sunday run.
- Screenshot of the Overview layout reviewed by eye.

## Spike (before plan)
Every part is already proven in this project (equipment list, rejection path, saves) except one: does the scripted day and the stowage spike still behave once 2 ASCs share a block and Shabbat pauses dispatch? The spike runs the current smoke day and the stowage spike with 8 ASCs and the Shabbat rule patched in, and checks that nothing stalls or loads twice.

## Expert input (fan-in)
- Product: do the save version first; write the learning outcome as a check Shalom can do himself (acceptance 6). Risk: time zone and day boundaries.
- Architecture: "any free ASC" needs no new dispatch rule; let time pass idle on Shabbat; keep old equipment ids when converting saves or a running job crashes.
- Design: weekday and a text chip by the clock; reuse the gate rejection; don't let "jump one day" hide Shabbat; yard and layout must scroll inside at 390 px.
- QA: test the time rules without the screen on the 15-minute grid; test with a real version 1 save; the current scripted day stops before Friday 14:45, so add a Friday-Sunday run.
- Resolved conflict: product and design suggested asking about waterside/landside ASCs; architecture showed "any free one" is enough for now, so it is a non-goal.
