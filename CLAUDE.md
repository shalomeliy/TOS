# CLAUDE.md

Reply to the user in Hebrew (masculine form), short and direct, no emojis.

## Project facts

- Project name: `TOS Navis N4`
- Project type: **web app** (educational simulator, runs locally in the browser).
- What it is: an educational terminal operating system (TOS) simulator modelled on public Navis N4 concepts (vessel, yard, gate, work queues, equipment, billing), so the user can learn how such a system works. The look is "N4-style" classic desktop, not a copy. Original code only: never copy code, assets or screenshots from Navis/Kaleris or any commercial TOS.
- Stack: single-file vanilla HTML/CSS/JS (`index.html`), no dependencies, no build step. State is in memory (optionally `localStorage`).
- Run: open `index.html` in a browser, or serve the folder (`.claude/launch.json`, `npx http-server -p 8080`).
- Verify command: `node tools/smoke.mjs` (loads `index.html` in headless Chromium via Playwright, runs a scripted day, fails on any console error).
- Performance budget: not a public website; target instant load (< 1s) and no console errors.
- Product direction: `docs/PRODUCT-DIRECTION.md`.
- Git: remote `origin` = https://github.com/shalomeliy/TOS (branch `main`). The repo's earlier N4 Lab prototype is kept as `lab-v1.html`; `HANDOFF.md` and `N4-data-model-research.md` came from the repo. Always push to `origin main` after each commit (user's standing instruction, 2026-10-26); every push also updates the live site https://shalomeliy.github.io/TOS/ (GitHub Pages).

## Project skills

Base skills (inherited from the template): `architecture-plan`, `ce-compound`, `ce-compound-refresh`, `ce-debug`, `ce-simplify-code`, `drop-generic-design`, `feature-spike`, `loop-engineering`, `rtl-chat`, `ui-ux-review`, `write-feature-spec`, and the agents `architecture-expert`, `change-reviewer`, `design-expert`, `product-expert`, `qa-expert`, `security-expert`.

Skills added for this project only:

- (none yet)

### Adding a skill or agent to this project

Before calling it done:

1. Fill it with this project's real values from "Project facts". No `TBD` left where a value is known.
2. If it only applies to part of the project, say so in its `description`.
3. Point any file paths it writes at the folders in "Where outputs go"; add a row if it needs a new one.
4. Add it to the list above and a row to "Skill routing" (or "Agents").
5. If it references skills that are not installed, add them to the substitutes table.

**Check at the start of every session:** list `.claude/skills/` and `.claude/agents/`. Anything not in the base set or the project list above was added without registration. Run steps 1 to 5 on it and tell the user what was registered.

## Where outputs go

| Output | Path | Written by |
|---|---|---|
| Feature spec | `docs/specs/<feature>.md` | `write-feature-spec` |
| Spike code (throwaway) | `spikes/<feature>/` | `feature-spike` |
| Spike result and verdict | `docs/spikes/<feature>.md` | `feature-spike` |
| Implementation plan | `docs/plans/<feature>-PLAN.md` | `architecture-plan` |
| Solved-problem learnings | `docs/solutions/` | `ce-compound` |

## Skill routing: which skill when

| Situation | Use | Not |
|---|---|---|
| New feature or vague request | `write-feature-spec` | jumping to code |
| Spec approved, new capability | `feature-spike` (small experiment first) | building the full feature on an untested idea |
| Spike verdict GO, need a technical plan | `architecture-plan` | re-opening product decisions |
| Plan approved, build it | `loop-engineering` | building without an approved plan |
| Any frontend work (spec, build, review) | `ui-ux-review` + `drop-generic-design` (via `design-expert`) | decorative polish first |
| Bug, failing test, slow behavior | `ce-debug` | guessing fixes |
| Fix verified and the reasoning is non-obvious | `ce-compound` | documenting routine fixes |
| Feature built and tests pass, code feels messy | `ce-simplify-code` | changing behavior while cleaning |
| `docs/solutions/` may be stale or duplicated | `ce-compound-refresh` | editing product code |
| User asks for RTL widgets in Cowork | `rtl-chat` | turning it on just because text is Hebrew |

Small, clear changes (typo, one-line copy edit, a config value) skip the pipeline. The pipeline is for features.

## Rule: a Hebrew tooltip on every control and every screen (permanent)

The user is new to port operations. Every button, link, field and checkbox, existing and added in any future version, has a Hebrew tooltip (`data-tip` or an entry in `TIPS`). Every screen title has a tooltip from `SCREEN_TIPS` that says what you see on the screen and what you can do on it. Every part of a screen that shows information also explains itself: section titles (`legend`), table columns (`th`), status tags (`.tag`), number tiles (`.kpi`), legend items and map parts. They are looked up by their text in `INFO` (selector `INFO_SEL`); a new heading, column or status needs an `INFO` entry. A new screen is not done until it has its `SCREEN_TIPS` entry. `tools/smoke.mjs` fails on any control or screen without one (checked at the start and at the end of the scripted day).

## Rule: a full Hebrew test guide for every version (permanent)

The user has never worked with a TOS. Every version ends with `docs/guides/v<N>-test-guide.md` in Hebrew, also copied into `HANDOFF.md`: every action in the simulator in working order, what to click, what should appear on screen, what it is in N4 terms, and what means it is broken. Words like WI, QC, AGV, ASC, POD are explained the first time. The version is not done without it.

## Rule: version number top right (permanent)

`APP_VERSION` / `APP_DATE` in `index.html` are shown in the title bar so the user can see an upgrade arrived. Bump on every push: `v<roadmap version>.<fix number inside it>` (a new roadmap version starts at `.0`), and tell the user the number in the reply.

## Rule: spike before building

The user builds many capabilities from scratch. Before writing the full code of any new capability, always write a small experiment first (`feature-spike`): minimal code that tests the riskiest assumption and shows whether the feature is feasible and worth developing. Only after a GO verdict and the user's approval, plan and build the full capability. Skip only for small, clear changes, or when every part is already proven in this project (say so).

## Feature pipeline

```
write-feature-spec  ->  [user approves spec]
  fan-out: product-expert, architecture-expert, design-expert, qa-expert
           (+ security-expert only on a trust-boundary trigger)
feature-spike       ->  small experiment, verdict GO | CHANGE | NO-GO  ->  [user decides]
architecture-plan   ->  [user approves plan]
loop-engineering    ->  build / check / repair, max 3 cycles
  change-reviewer   ->  PASS | REPAIR | REPLAN | HUMAN DECISION
ce-compound         ->  only if the work taught something non-obvious
```

Bugs found during `loop-engineering` go to `ce-debug`, then back into the loop.

## Agents

| Agent | Called by | Preloaded skills |
|---|---|---|
| `product-expert` | `write-feature-spec` | none |
| `architecture-expert` | `write-feature-spec` | `architecture-plan` |
| `design-expert` | `write-feature-spec`, frontend reviews | `ui-ux-review`, `drop-generic-design` |
| `qa-expert` | `write-feature-spec`, acceptance criteria | none |
| `security-expert` | trust-boundary changes only | none |
| `change-reviewer` | `loop-engineering`, after every build | none |

All agents are read-only. Only the main session edits files.

## compound-engineering skills

`ce-debug`, `ce-compound`, `ce-simplify-code` and `ce-compound-refresh` come from the compound-engineering plugin (EveryInc). They are **copied into `.claude/skills/` on purpose**, because the plugin was not active in the user's Claude Code and a copy travels with the project. Do not also install the full plugin in the same project: that shows each skill twice.

The plugin also ships skills that overlap this project's own pipeline. For features, use the pipeline above, not these:

| Plugin skill | Use instead |
|---|---|
| `ce-brainstorm` | `write-feature-spec` |
| `ce-plan` | `architecture-plan` |
| `ce-work`, `lfg` | `loop-engineering` |
| `ce-code-review` | `change-reviewer` agent |

Git and PR skills (`ce-commit`, `ce-commit-push-pr`, `ce-babysit-pr`, `ce-resolve-pr-feedback`) run only when the user asks.
