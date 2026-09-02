import { StyleSheet, View } from 'react-native';
import type { Schedule, ScheduleType } from '@/domain/types';
import { localDateOf } from '@/domain/time/localDate';
import { ChipGroup, Stepper, Text, type ChipOption } from '@/ui/primitives';
import { space } from '@/ui/tokens';
import { toWeekdays, weekdayOptions } from './options';

const typeOptions: ChipOption<ScheduleType>[] = [
  { value: 'weekdays', label: 'Certain days' },
  { value: 'times_per_week', label: 'X per week' },
  { value: 'every_n_days', label: 'Every N days' },
  { value: 'none', label: 'Whenever' },
];

export interface ScheduleEditorProps {
  value: Schedule;
  onChange: (next: Schedule) => void;
  error?: string | null;
}

/**
 * Schedule picker. Spec §4.1.
 *
 * "X per week" is presented as a first-class option rather than buried,
 * because flexible frequency is the strongest defence against the
 * what-the-hell effect (§3.7): a habit you owe three times a week cannot be
 * broken by one bad Tuesday.
 */
export function ScheduleEditor({ value, onChange, error }: ScheduleEditorProps) {
  const switchType = (type: ScheduleType) => {
    switch (type) {
      case 'weekdays':
        onChange({ type: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] });
        break;
      case 'times_per_week':
        onChange({ type: 'times_per_week', times: 3 });
        break;
      case 'every_n_days':
        onChange({ type: 'every_n_days', n: 2, anchor: localDateOf(new Date()) });
        break;
      case 'none':
        onChange({ type: 'none' });
        break;
    }
  };

  return (
    <View style={styles.root}>
      <ChipGroup
        label="How often"
        options={typeOptions}
        selected={[value.type]}
        onChange={(next) => next[0] && switchType(next[0])}
        error={error}
      />

      {value.type === 'weekdays' ? (
        <ChipGroup
          options={weekdayOptions}
          multiple
          selected={value.days.map(String)}
          onChange={(next) => onChange({ type: 'weekdays', days: toWeekdays(next) })}
          hint="Missing a day you did not pick never breaks a streak."
        />
      ) : null}

      {value.type === 'times_per_week' ? (
        <View style={styles.inline}>
          <Stepper
            value={value.times}
            target={7}
            unit="per week"
            onChange={(times) =>
              onChange({ type: 'times_per_week', times: Math.min(7, Math.max(1, times)) })
            }
          />
          <Text variant="caption" tone="muted" style={styles.grow}>
            Any days you like. The streak counts weeks, so one bad day costs nothing.
          </Text>
        </View>
      ) : null}

      {value.type === 'every_n_days' ? (
        <View style={styles.inline}>
          <Stepper
            value={value.n}
            target={30}
            unit="days"
            onChange={(n) => onChange({ ...value, n: Math.max(1, n) })}
          />
          <Text variant="caption" tone="muted" style={styles.grow}>
            Counting from today.
          </Text>
        </View>
      ) : null}

      {value.type === 'none' ? (
        <Text variant="caption" tone="muted">
          Always available, never owed. Good for things you want to encourage but not schedule.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
});
