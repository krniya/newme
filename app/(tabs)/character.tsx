import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ATTRIBUTES,
  type Attribute,
  type Difficulty,
  type MomentumState,
  applyDayMomentum,
  attributeLevelFromXp,
  awardXp,
  currentCapRate,
  levelProgress,
  momentumState,
  tierForLevel,
  tierName,
  totalXpForAttributeLevel,
} from '@/domain';
import {
  AttributeBar,
  Button,
  Card,
  Divider,
  ProgressBar,
  Screen,
  StatPill,
  Text,
} from '@/ui/primitives';
import { attributeColors, space } from '@/ui/tokens';

const DIFFICULTIES: Difficulty[] = ['trivial', 'easy', 'medium', 'hard', 'epic'];

/**
 * Phase 0 engine harness.
 *
 * Not the real Character screen — this is a sandbox that drives the domain
 * engines with fake input so the maths can be checked on a physical device,
 * not just in Vitest. It proves the pieces the whole product rests on: the
 * level curve, the multiplier stack, the daily soft cap, attribute tracks,
 * momentum bands and Rescue Mode.
 *
 * Replaced in Phase 1 by the real screen, which reads from SQLite.
 */
export default function CharacterScreen() {
  const [xp, setXp] = useState(0);
  const [gold, setGold] = useState(0);
  const [rawToday, setRawToday] = useState(0);
  const [streak, setStreak] = useState(0);
  const [momentum, setMomentum] = useState(60);
  const [attrXp, setAttrXp] = useState<Record<Attribute, number>>({
    vitality: 0,
    focus: 0,
    discipline: 0,
    spirit: 0,
    bond: 0,
  });
  const [lastAward, setLastAward] = useState<string | null>(null);

  const state: MomentumState = momentumState(momentum);
  const progress = useMemo(() => levelProgress(xp), [xp]);
  const tier = tierForLevel(progress.level);

  const complete = (difficulty: Difficulty, attribute: Attribute) => {
    const award = awardXp(difficulty, {
      streak,
      plannedAhead: true,
      inWindow: true,
      hasEvidence: false,
      momentumState: state,
      rawSoFarToday: rawToday,
    });

    setXp((x) => x + award.banked);
    setGold((g) => g + award.gold);
    setRawToday((r) => r + award.raw);
    setStreak((s) => s + 1);
    setMomentum((m) => applyDayMomentum(m, { itemCompleted: 1 }));
    setAttrXp((prev) => ({ ...prev, [attribute]: prev[attribute] + award.banked }));

    const bonuses = award.breakdown.map((b) => b.label).join(', ');
    setLastAward(
      `${difficulty} → +${award.banked} XP` +
        (award.banked !== award.raw ? ` (capped from ${award.raw})` : '') +
        (bonuses ? ` · ${bonuses}` : ''),
    );
  };

  const missDay = () => {
    setMomentum((m) => applyDayMomentum(m, { itemMissed: 3 }));
    setStreak(0);
    setLastAward('Missed 3 items — momentum down, XP untouched');
  };

  const reset = () => {
    setXp(0);
    setGold(0);
    setRawToday(0);
    setStreak(0);
    setMomentum(60);
    setAttrXp({ vitality: 0, focus: 0, discipline: 0, spirit: 0, bond: 0 });
    setLastAward(null);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="caption" tone="muted">
          PHASE 0 · ENGINE HARNESS
        </Text>
        <Text variant="display" numeric>
          Level {progress.level}
        </Text>
        <Text variant="label" tone="accent">
          Tier {tier} · {tierName(tier)}
        </Text>
      </View>

      <Card>
        <ProgressBar
          fraction={progress.fraction}
          height={10}
          accessibilityLabel={`Level ${progress.level}, ${progress.xpIntoLevel} of ${progress.xpForLevel} XP`}
        />
        <View style={styles.spread}>
          <Text variant="caption" tone="muted" numeric>
            {progress.xpIntoLevel} / {progress.xpForLevel} XP
          </Text>
          <Text variant="caption" tone="muted" numeric>
            {xp} total
          </Text>
        </View>
      </Card>

      <View style={styles.pills}>
        <StatPill label="Gold" value={gold} />
        <StatPill label="Streak" value={`${streak}d`} />
        <StatPill
          label="Momentum"
          value={momentum}
          color={state === 'dormant' || state === 'fading' ? undefined : attributeColors.bond}
        />
        <StatPill label="State" value={state} />
        <StatPill label="Cap rate" value={`${Math.round(currentCapRate(rawToday) * 100)}%`} />
      </View>

      {state === 'dormant' ? (
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
          {ATTRIBUTES.map((attribute) => {
            const value = attrXp[attribute];
            const level = attributeLevelFromXp(value);
            const floor = totalXpForAttributeLevel(level);
            const ceiling = totalXpForAttributeLevel(level + 1);
            const fraction = ceiling > floor ? (value - floor) / (ceiling - floor) : 0;
            return (
              <AttributeBar
                key={attribute}
                attribute={attribute}
                level={level}
                fraction={fraction}
              />
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="heading">Complete something</Text>
        <Text variant="caption" tone="muted">
          Awards assume planned-ahead and in-window bonuses.
        </Text>
        <View style={styles.buttons}>
          {DIFFICULTIES.map((difficulty, i) => (
            <Button
              key={difficulty}
              label={difficulty}
              variant="secondary"
              onPress={() => complete(difficulty, ATTRIBUTES[i % ATTRIBUTES.length]!)}
              style={styles.grow}
            />
          ))}
        </View>

        {lastAward ? (
          <>
            <Divider style={styles.divider} />
            <Text variant="caption" tone="secondary">
              {lastAward}
            </Text>
          </>
        ) : null}
      </Card>

      <View style={styles.buttons}>
        <Button label="Miss a day" variant="ghost" onPress={missDay} style={styles.grow} />
        <Button label="Reset" variant="ghost" onPress={reset} style={styles.grow} />
      </View>
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
