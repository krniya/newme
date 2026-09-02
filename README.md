# NewMe

A habit tracker and day planner with an RPG progression layer: your character levels up from
things you actually do.

**100% on-device.** No backend, no accounts, no cloud sync, no AI. Data safety comes from a
first-class export/import system, not a server. See
[`docs/PRODUCT_AND_TECH_SPEC.md`](docs/PRODUCT_AND_TECH_SPEC.md) — it is the authority on every
decision here, and code comments reference its sections.

---

## Status: Phase 0 complete · Phase 1 M1 (event spine) complete

| Exit criterion | State |
|---|---|
| **Phase 0** | |
| Expo app scaffold, TypeScript strict, expo-router | done |
| Design tokens + UI primitives | done — 11 primitives |
| Drizzle schema v1 + migrations | done — 11 tables, `0000_init` |
| Domain engines, fully unit-tested, **before any UI** | done |
| Dev build installed on a physical device | **not done — needs your hardware** (see below) |
| **M1 · event spine** | |
| Event log, reducer, `rebuildProjections()` | done |
| Replay of ~3 years of use in <1s | done — 50k events in ~166ms |
| Deterministic replay, golden state | done — 213 tests |

The Today / Habits tabs are still placeholders. The **Character tab is the M1 acceptance
harness**: it drives the real spine end to end — appends events to SQLite, folds them in memory,
persists projections, and survives a restart. Nothing on it is faked.

Next up is M2 (habit CRUD). See [the plan](#next-milestones).

---

## Commands

```bash
npm test           # domain suite (vitest) — 161 tests, ~1s
npm run typecheck  # tsc --noEmit
npm start          # metro, expects a dev client
npm run db:generate  # regenerate Drizzle migrations after editing schema.ts
npm run db:studio    # browse the schema
```

## Getting a dev build onto your phone

You are on Windows, so iOS builds go through EAS Cloud rather than a local Xcode.

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform android   # APK, sideload it
eas build --profile development --platform ios       # needs an Apple Developer account
npm start                                            # then scan the QR from the dev client
```

Expo Go will **not** work: the app uses `expo-sqlite` with a change listener and will need
more native modules (health, widgets, Rive) as it grows. A dev client is required from day one.

## Layout

```
app/                    expo-router routes — thin, wiring only
src/
  domain/               PURE TypeScript. No React, no RN, no DB, no clock reads.
    time/               calendar arithmetic on YYYY-MM-DD (UTC-based, DST-proof)
    xp/                 level curve, multipliers, daily cap, gold
    momentum/           the anti-HP system + Rescue Mode
    scheduling/         "owed today?" vs "available today?"
    streak/             streak resolution, freezes, repair
    insights/           automaticity meter
    events/             event types, the reducer, projection state  ← the spine
  data/
    db/                 Drizzle schema, migrations, client
    repos/              append-only event writer
    projections/        rebuild + save, derived from the log
  features/             app services (progression store)
  lib/                  uuidv7 and other impure helpers
  ui/                   tokens, theme, primitives
docs/                   the spec
```

### How progression works

Nothing stores XP, gold, streaks or momentum as truth. An **append-only event log** is the
source of truth, and everything else is a projection rebuilt from it (spec §8.2).

An event records *what happened* — "a medium Vitality habit was done, in its window, planned
the night before" — never *what it was worth*. That is what lets the level curve be retuned
years from now and replayed without corrupting history. Difficulty and attributes are
snapshotted, though, so editing a habit from Easy to Epic can't retroactively inflate a year of
completions.

Replay never reads habit definitions. The daily rollover resolves schedules once and records its
conclusions in `day.closed`, so an imported backup folds correctly even if the habits it
references have since been edited or deleted.

Undo appends a compensating event and rebuilds, rather than subtracting XP — progress stays
monotonic, and the undone completion leaves no trace in the daily cap either.

### The one rule that matters

`src/domain` imports nothing outside itself — no React, no React Native, no database, and it
never reads the clock or `Math.random`. This is enforced by
[`src/domain/__tests__/purity.test.ts`](src/domain/__tests__/purity.test.ts), which will fail the
build if violated.

It is not style policing. The whole progression system has to be replayable over the event log:
that is what makes import work, what lets the level curve be retuned years later without
corrupting anyone's history, and — with no server to repair a device remotely — what makes
corruption survivable by rebuilding rather than by support ticket.

### The golden level table

[`src/domain/xp/goldenLevelTable.test.ts`](src/domain/xp/goldenLevelTable.test.ts) pins the
entire progression curve. Changing `LEVEL_CURVE_K` or `LEVEL_CURVE_E` retroactively changes every
user's level, because levels are derived rather than stored. The test exists so that can never
happen by accident — it will always surface as an explicit diff.

## Next milestones

1. ~~**M1** Event log + reducer + `rebuildProjections()`~~ ✅
2. **M2** Habit CRUD with implementation-intention fields
3. **M3** Today screen: timeline, one-tap check-off, undo snackbar, daily rollover
4. **M4** Rituals + Ritual Player + the rolling 7-day notification scheduler
5. **M5** **Backup subsystem** — snapshots, `.newme` export, import with both modes, round-trip
   property test. Ships in the MVP, not later: the moment there are 30 days of real history in
   the app, losing it becomes unacceptable, and a backup system retro-fitted onto a schema that
   never anticipated it is painful.
6. **M6** Character screen, onboarding, gold and user-defined rewards

Phase 1 is done when you have used it daily for 14 days *and* have wiped the app, restored from a
`.newme` file, and verified your level and streaks came back identical.
