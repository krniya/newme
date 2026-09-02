import { create } from 'zustand';
import type { Attribute, Difficulty, LocalDate } from '@/domain/types';
import { applyEvent } from '@/domain/events/reducer';
import { emptyState, type ProgressionState } from '@/domain/events/state';
import { localDateOf } from '@/domain/time/localDate';
import { levelFromXp } from '@/domain/xp/curve';
import type { DomainEvent } from '@/domain/events/types';
import { append } from '@/data/repos/eventRepo';
import { rebuildProjections, saveProjections } from '@/data/projections/rebuild';

/**
 * The progression spine's public surface. Spec §8.2.
 *
 * Holds the folded state in memory and keeps SQLite behind it. Two rules
 * shape the design:
 *
 *   1. **The UI never waits for a projection write.** A completion appends
 *      its event, folds it in memory, and updates the screen immediately;
 *      persistence happens after. Spec §6.2 budgets the whole check-off
 *      animation at 400ms, which a synchronous projection write would eat.
 *
 *   2. **The event append is awaited.** Losing the projection cache is
 *      harmless — it rebuilds. Losing the event is data loss, and with no
 *      backend it is unrecoverable. So the log write is the one thing that
 *      blocks.
 */

interface ProgressionStore {
  state: ProgressionState;
  ready: boolean;
  /** Set when the last projection save failed; the cache is stale, not lost. */
  saveError: string | null;

  initialize: () => Promise<void>;
  completeHabit: (input: CompleteHabitInput) => Promise<CompletionOutcome>;
  undoCompletion: (habitId: string, eventId: string) => Promise<void>;
  rebuild: () => Promise<void>;
}

export interface CompleteHabitInput {
  habitId: string;
  difficulty: Difficulty;
  attributes: Attribute[];
  plannedAhead?: boolean;
  inWindow?: boolean;
  hasEvidence?: boolean;
  quantity?: number;
  scheduledToday?: boolean;
  weeklyStreak?: boolean;
  /** Injectable for tests and for backfilling; defaults to now. */
  at?: Date;
}

export interface CompletionOutcome {
  /** The appended event's id — hand this to `undoCompletion`. */
  eventId: string;
  xpGained: number;
  goldGained: number;
  leveledUp: boolean;
  newLevel: number;
}

export const useProgression = create<ProgressionStore>((set, get) => ({
  state: emptyState(),
  ready: false,
  saveError: null,

  /**
   * Cold start rebuilds from the log rather than reading the projection
   * tables back. It costs ~10ms for a realistic first year and removes an
   * entire class of bug: the cache can never silently disagree with the log,
   * because the cache is never trusted.
   */
  initialize: async () => {
    const result = await rebuildProjections();
    set({ state: result.state, ready: true, saveError: null });
  },

  completeHabit: async (input) => {
    const before = get().state;
    const localDate: LocalDate = localDateOf(input.at ?? new Date());

    const event = await append({
      type: 'habit.completed',
      subjectId: input.habitId,
      localDate,
      occurredAt: (input.at ?? new Date()).getTime(),
      payload: {
        habitId: input.habitId,
        difficulty: input.difficulty,
        attributes: input.attributes,
        plannedAhead: input.plannedAhead ?? false,
        inWindow: input.inWindow ?? false,
        hasEvidence: input.hasEvidence ?? false,
        quantity: input.quantity ?? 1,
        scheduledToday: input.scheduledToday ?? false,
        weeklyStreak: input.weeklyStreak ?? false,
      },
    });

    const after = applyEvent(before, event as DomainEvent);
    set({ state: after });

    void persist(after, set);

    return {
      eventId: event.id,
      xpGained: after.xpTotal - before.xpTotal,
      goldGained: after.gold - before.gold,
      leveledUp: levelOf(after) > levelOf(before),
      newLevel: levelOf(after),
    };
  },

  /**
   * Undo appends a compensating event and then rebuilds.
   *
   * Reversing the award incrementally would need the daily-cap context as it
   * stood at the time, which is gone. Rebuilding is provably correct, and at
   * ~10ms for a realistic log it is imperceptible inside the 5-second undo
   * snackbar.
   */
  undoCompletion: async (habitId, eventId) => {
    await append({
      type: 'habit.uncompleted',
      subjectId: habitId,
      localDate: localDateOf(new Date()),
      payload: { habitId, targetEventId: eventId },
    });

    const result = await rebuildProjections();
    set({ state: result.state });
  },

  rebuild: async () => {
    const result = await rebuildProjections();
    set({ state: result.state, saveError: null });
  },
}));

function levelOf(state: ProgressionState): number {
  return levelFromXp(state.xpTotal);
}

async function persist(
  state: ProgressionState,
  set: (partial: Partial<ProgressionStore>) => void,
): Promise<void> {
  try {
    await saveProjections(state);
    set({ saveError: null });
  } catch (error) {
    // Not fatal: the event log is already durable, so the next launch
    // rebuilds correctly. Surfaced so a persistent failure is visible rather
    // than silently accumulating.
    set({ saveError: error instanceof Error ? error.message : String(error) });
  }
}
