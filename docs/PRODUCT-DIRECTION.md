# Product direction

## Problem
The user wants to understand how a container terminal operating system (TOS) such as Navis N4 works. Real N4 is commercial, screens are not public, and it cannot be tried hands-on.

## Target user
The user himself: a non-programmer learning terminal operations concepts.

## Main job
Run a small simulated terminal day: vessel arrives, containers are discharged to the yard, trucks come through the gate, containers are loaded, equipment is assigned, and the terminal bills for it. Then see how each part maps to the N4 concept it imitates.

## Success
- Opens in a browser with one file, no install.
- Every main N4 area (vessel, yard, gate, work queues, equipment, billing) has a working, explainable screen.
- A "how it maps to N4" page explains each concept in plain words.

## Non-goals
- Not a real TOS, not for production use.
- No copied code, assets, screenshots or trademarks styling from Navis/Kaleris. The look is "N4-style" (classic desktop), not a copy.
- No real EDI, no real equipment control.

## Assumptions (not yet confirmed by the user)
- Single user, in-memory state; saving between sessions is optional.
- Next areas (rail, appointments, stowage planning, rule-based decking, roles) are chosen by the user one at a time.

## Public sources behind the concepts
kaleris.com Automation Product Sheet, Long Beach Container Terminal case study, porttechnology.org "Navis N4 3.8" article.
