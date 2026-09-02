import { Pressable, StyleSheet, View } from 'react-native';
import type { HabitDefinition } from '@/domain/habit/definition';
import { hasIntention } from '@/domain/habit/definition';
import { formatWindow } from '@/domain/habit/window';
import { BASE_XP } from '@/domain/xp/constants';
import { Text } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { attributeColors, radius, space } from '@/ui/tokens';
import { weekdayOptions } from './options';

export function describeSchedule(habit: HabitDefinition): string {
  const schedule = habit.schedule;
  switch (schedule.type) {
    case 'weekdays':
      if (schedule.days.length === 7) return 'Every day';
      return schedule.days
        .map((day) => weekdayOptions.find((o) => o.value === String(day))?.label ?? '')
        .filter(Boolean)
        .join(' ');
    case 'times_per_week':
      return `${schedule.times}× a week`;
    case 'every_n_days':
      return schedule.n === 1 ? 'Every day' : `Every ${schedule.n} days`;
    case 'none':
      return 'Whenever';
  }
}

export function HabitRow({ habit, onPress }: { habit: HabitDefinition; onPress: () => void }) {
  const theme = useTheme();
  const accent = attributeColors[habit.attributes[0] ?? 'focus'];

  const detail = [
    describeSchedule(habit),
    habit.window ? formatWindow(habit.window) : null,
    habit.target.value > 1 ? `${habit.target.value} ${habit.target.unit}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${habit.title}, ${detail}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.stripe, { backgroundColor: accent }]} />

      <View style={styles.body}>
        <Text variant="heading">{habit.title}</Text>
        <Text variant="caption" tone="muted">
          {detail}
        </Text>
        {habit.cue ? (
          <Text variant="caption" tone="secondary">
            {habit.cue}
          </Text>
        ) : (
          // Spec §3.1: the app asks for the anchor again later rather than
          // blocking creation on it.
          <Text variant="caption" tone="caution">
            No anchor yet
          </Text>
        )}
      </View>

      <View style={styles.meta}>
        <Text variant="label" numeric tone="muted">
          +{BASE_XP[habit.difficulty]}
        </Text>
        {!hasIntention(habit) ? null : (
          <Text variant="caption" tone="muted">
            ⚓
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    minHeight: 72,
  },
  stripe: { width: 4 },
  body: { flex: 1, padding: space.lg, gap: 2 },
  meta: { padding: space.lg, alignItems: 'flex-end', justifyContent: 'center', gap: space.xs },
});
