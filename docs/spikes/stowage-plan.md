# Spike - stowage plan (roadmap version 3)

Date: 2026-10-22. Code: `spikes/stowage-plan/spike.mjs` (throwaway, patches the live `index.html` functions inside the page). Run: `node spikes/stowage-plan/spike.mjs`.

Note: run against the version 1 yard (4 blocks, 1 ASC each, 2 QC). Re-check after the Ashdod layout (version 2) changes the equipment.

## Question
Riskiest assumption from the spec: loading in plan order (later POD lower, heavier lower, bottom tier before top) through today's yard stacking still finishes in reasonable time, and the extra yard rehandles stay understandable.

## Setup
Seeded random, same yard for both modes. Visit V002 with 10 exports (demo) and 24 exports (demo + 14), POD 1-3 random. Ship: 20' bays 01/03, 40' bay 06, 4 rows, tiers 02/04/82/84. Baseline = today's order (creation order). Plan = sorted plan sequence plus "slot below must be loaded first".

## Result

| exports | cycles base / plan | yard rehandles base / plan | rule breaks if base order were stowed | floating slots in plan mode | loaded |
|---|---|---|---|---|---|
| 10 (5 seeds) | 17 / 17 | 7 / 0-4 | 1-3 | 0 | 10/10 |
| 24 (5 seeds) | 31 / 31 | 18 / 7-12 | 4-10 | 0 | 24/24 |

No page errors.

## Findings
- The feared yard cost did not appear. Plan order gave **fewer** yard rehandles than today's order, because creation order loads the bottom of each yard stack first and digs every time.
- Time is the same: the bottleneck is one ASC per block, not the sequence.
- "Slot below first" gating never deadlocked and never produced a floating container.
- Loading in arrival order would break the stowage rules 1-10 times per vessel. That is the lesson the screen should show.
- Bonus for the plan: when two units are equal for the ship (same POD, same size, similar weight), prefer the one higher in its yard stack. Cheap, and it ties yard and ship planning together.

## Verdict: **GO**
Build as specced. Add the yard-tier tie-break above. Keep the "yard rehandles for this vessel" counter, since it now tells a positive story (plan order vs arrival order).

## Re-run on the Ashdod port (version 2), 2026-10-25

| exports | cycles base / plan | yard rehandles base / plan | rule breaks if base order were stowed | floating | loaded |
|---|---|---|---|---|---|
| 10 (5 seeds) | 9 / 9 | 7 / 0-4 | 1-3 | 0 | 10/10 |
| 24 (5 seeds) | 16 / 16 | 18 / 7-12 | 4-10 | 0 | 24/24 |

Two ASCs per block roughly halve the time. Plan order still costs no time and saves yard rehandles. Verdict stays **GO**.
