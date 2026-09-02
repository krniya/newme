# NewMe

A habit tracker and day planner with an RPG progression layer: your character levels up from
things you actually do.

**100% on-device.** No backend, no accounts, no cloud sync, no AI. Data safety comes from a
first-class export/import system, not a server. See
[`docs/PRODUCT_AND_TECH_SPEC.md`](docs/PRODUCT_AND_TECH_SPEC.md) — it is the authority on every
decision here, and code comments reference its sections.

---

## Status: Phase 0 complete

| Phase 0 exit criterion | State |
|---|---|
| Expo app scaffold, TypeScript strict, expo-router | done |
| Design tokens + UI primitives | done — 11 primitives |
| Drizzle schema v1 + migrations | done — 11 tables, `0000_init` |
| Domain engines, fully unit-tested, **before any UI** | done — 161 tests |
| `npm test` covers the progression spec in §5 | done |
| Dev build installed on a physical device | **not done — needs your hardware** (see below) |

Phase 1 (the real Today screen, habit CRUD, event log, backup subsystem) has not started.
The Today / Habits tabs are placeholders; the Character and Insights tabs are Phase 0 harnesses
that drive the real domain engines with fake input so the maths can be sanity-checked on a device.

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
  data/db/              Drizzle schema, migrations, client
  ui/                   tokens, theme, primitives
docs/                   the spec
```

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

## Next: Phase 1

In build order:

1. Event log + reducer + `rebuildProjections()`
2. Habit CRUD with implementation-intention fields
3. Today screen: timeline, one-tap check-off, undo snackbar
4. Rituals + Ritual Player
5. Local notifications with the rolling 7-day window scheduler
6. **Backup subsystem** — snapshots, `.newme` export, import with both modes, round-trip
   property test. Ships in the MVP, not later: the moment there are 30 days of real history in
   the app, losing it becomes unacceptable, and a backup system retro-fitted onto a schema that
   never anticipated it is painful.

Phase 1 is done when you have used it daily for 14 days *and* have wiped the app, restored from a
`.newme` file, and verified your level and streaks came back identical.
