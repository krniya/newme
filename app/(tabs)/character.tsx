import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ATTRIBUTES, type Attribute, type Difficulty } from '@/domain/types';
import {
  selectAttributes,
  selectDaily,
  selectLevel,
  selectMomentumState,
  selectTier,
} from '@/domain/events/state';
import { currentCapRate } from '@/domain/xp/dailyCap';
import { tierName } from '@/domain/xp/curve';
import { localDateOf } from '@/domain/time/localDate';
import { useProgression, type CompletionOutcome } from '@/features/progression/progressionStore';
import {
  AttributeBar,
  Button,
  Card,
  Divider,
  EmptyState,
  ProgressBar,
  Screen,
  StatPill,
  Text,
} from '@/ui/primitives';
import { attributeColors, space } from '@/ui/tokens';

const DIFFICULTIES: Difficulty[] = ['trivial', 'easy', 'medium', 'hard', 'epic'];

/**
 * M1 acceptance harness.
 *
 * Not the real Character screen — this drives the actual event spine so the
 * whole path can be checked on a physical device: append to SQLite, fold in
 * memory, persist projections, survive a restart, and rebuild identically.
 *
 * Everything here is real. Nothing is faked. Replaced in M6 by the screen
 * that reads from live habits instead of these buttons.
 */
export default function CharacterScreen() {
  const { state, ready, saveError, initialize, completeHabit, undoCompletion, rebuild } =
    useProgression();

  const [last, setLast] = useState<(CompletionOutcome & { habitId: string }) | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!ready) {
    return (
      <Screen>
        <EmptyState title="Rebuilding from your event log…" />
      </Screen>
    );
  }

  const level = selectLevel(state);
  const tier = selectTier(state);
  const momentum = selectMomentumState(state);
  const today = selectDaily(state, localDateOf(new Date()));

  const onComplete = async (difficulty: Difficulty, attribute: Attribute) => {
    setBusy(true);
    try {
      const habitId = `harness-${attribute}`;
      const outcome = await completeHabit({
        habitId,
        difficulty,
        attributes: [attribute],
        plannedAhead: true,
        inWindow: true,
        scheduledToday: true,
      });
      setLast({ ...outcome, habitId });
      setNote(
        `${difficulty} → +${outcome.xpGained} XP, +${outcome.goldGained}g` +
          (outcome.leveledUp ? ` · LEVEL ${outcome.newLevel}` : ''),
      );
    } finally {
      setBusy(false);
    }
  };

  const onUndo = async () => {
    if (!last) return;
    setBusy(true);
    try {
      await undoCompletion(last.habitId, last.eventId);
      setNote('Undone — the completion was erased, not subtracted');
      setLast(null);
    } finally {
      setBusy(false);
    }
  };

  const onRebuild = async () => {
    setBusy(true);
    try {
      await rebuild();
      setNote('Rebuilt every projection from the log');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="caption" tone="muted">
          M1 · EVENT SPINE
        </Text>
        <Text variant="display" numeric>
          Level {level.level}
        </Text>
        <Text variant="label" tone="accent">
          Tier {tier} · {tierName(tier)}
        </Text>
      </View>

      <Card>
        <ProgressBar
          fraction={level.fraction}
          height={10}
          accessibilityLabel={`Level ${level.level}, ${level.xpIntoLevel} of ${level.xpForLevel} XP`}
        />
        <View style={styles.spread}>
          <Text variant="caption" tone="muted" numeric>
            {level.xpIntoLevel} / {level.xpForLevel} XP
          </Text>
          <Text variant="caption" tone="muted" numeric>
            {state.eventCount} events
          </Text>
        </View>
      </Card>

      <View style={styles.pills}>
        <StatPill label="Gold" value={state.gold} />
        <StatPill label="Momentum" value={state.momentum} />
        <StatPill label="State" value={momentum} />
        <StatPill label="Freezes" value={state.freezeTokens} />
        <StatPill
          label="Today raw"
          value={today.rawXp}
          color={currentCapRate(today.rawXp) < 1 ? attributeColors.vitality : undefined}
        />
        <StatPill label="Cap" value={`${Math.round(currentCapRate(today.rawXp) * 100)}%`} />
      </View>

      {momentum === 'dormant' ? (
        <Card raised>
          <Text variant="heading">Let&apos;s just do this one.</Text>
          <Text variant="body" tone="muted">
            That&apos;s the whole day. Worth triple, and your streaks are frozen while you&apos;re
            here.
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text variant="heading">Attributes</Text>
        <View style={styles.attributes}>
          {selectAttributes(state).map((attribute) => (
            <AttributeBar
              key={attribute.attribute}
              attribute={attribute.attribute}
              level={attribute.level}
              fraction={attribute.fraction}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text variant="heading">Complete something</Text>
        <Text variant="caption" tone="muted">
          Writes a real event to SQLite. Kill and reopen the app — it comes back.
        </Text>
        <View style={styles.buttons}>
          {DIFFICULTIES.map((difficulty, i) => (
            <Button
              key={difficulty}
              label={difficulty}
              variant="secondary"
              disabled={busy}
              onPress={() => void onComplete(difficulty, ATTRIBUTES[i % ATTRIBUTES.length]!)}
              style={styles.grow}
            />
          ))}
        </View>

        {note ? (
          <>
            <Divider style={styles.divider} />
            <Text variant="caption" tone="secondary">
              {note}
            </Text>
          </>
        ) : null}
      </Card>

      <View style={styles.buttons}>
        <Button
          label="Undo last"
          variant="ghost"
          disabled={busy || !last}
          onPress={() => void onUndo()}
          style={styles.grow}
        />
        <Button
          label="Rebuild"
          variant="ghost"
          disabled={busy}
          onPress={() => void onRebuild()}
          style={styles.grow}
        />
      </View>

      {saveError ? (
        <Card>
          <Text variant="label" tone="caution">
            Projection save failed
          </Text>
          <Text variant="caption" tone="muted">
            Your events are safe — the cache rebuilds on next launch. {saveError}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs, paddingTop: space.xxl },
  spread: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  attributes: { gap: space.md, marginTop: space.md },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  grow: { flexGrow: 1 },
  divider: { marginVertical: space.md },
});
