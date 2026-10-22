# Spike - Ashdod South Port (roadmap version 2)

Date: 2026-10-22. Code: `spikes/ashdod-south-port/spike.mjs` (throwaway, patches the live `index.html` inside the page). Run: `node spikes/ashdod-south-port/spike.mjs`.

## Question
Riskiest assumption from the spec: with 2 ASCs sharing a block ("any free one") and dispatch paused from Fri 15:00 to Sat 20:00, the day still finishes with no stall, no double move and no broken stack. Everything else in the spec (rejection path, equipment list, saves) is already proven in this project.

## Setup
Both demo vessels arrived and started together (discharge + load at once, the heaviest mix). 4 ASC (today) vs 8 ASC (2 per block). Start Thu 06:00 (normal) and Fri 13:00 (runs into Shabbat). 10 exports and 24 exports. 3 seeds each.

## Result

| start | exports | ASC | cycles | finished | dispatched during Shabbat | stack / position errors | not loaded | yard rehandles | page errors |
|---|---|---|---|---|---|---|---|---|---|
| Thu 06:00 | 10 | 4 | 24 | Thu 12:00 | - | 0 | 0 | 7 | 0 |
| Thu 06:00 | 10 | 8 | 13 | Thu 09:15 | - | 0 | 0 | 7 | 0 |
| Thu 06:00 | 24 | 4 | 38 | Thu 15:30 | - | 0 | 0 | 18 | 0 |
| Thu 06:00 | 24 | 8 | 20 | Thu 11:00 | - | 0 | 0 | 18 | 0 |
| Fri 13:00 | 10 | 4 | 140 | Sun 00:00 | 0 | 0 | 0 | 7 | 0 |
| Fri 13:00 | 10 | 8 | 129 | Sat 21:15 | 0 | 0 | 0 | 7 | 0 |
| Fri 13:00 | 24 | 4 | 154 | Sun 03:30 | 0 | 0 | 0 | 18 | 0 |
| Fri 13:00 | 24 | 8 | 136 | Sat 23:00 | 0 | 0 | 0 | 18 | 0 |

All 3 seeds gave the same numbers.

## Findings
- Two ASCs per block work with no new dispatch rule: the work takes about half the time, no stack goes over height, no unit is in two places, every export loads.
- Rehandles do not change with the second ASC. The yard rules, not the cranes, decide them.
- The Shabbat pause holds: nothing was dispatched between Fri 15:00 and Sat 20:00, jobs started before 15:00 finished, and work resumed at Sat 20:00 by itself.
- A Friday afternoon vessel now visibly finishes on Saturday night. That is the lesson.
- For the stowage spike (version 3): the bottleneck there was one ASC per block, so cycle counts will drop. Re-run it after version 2, as `HANDOFF.md` already says.

## Verdict: **GO**
Build as specced.
