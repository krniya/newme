import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { TimeWindow } from '@/domain/habit/definition';
import { formatMinute, parseMinute, windowLength, wrapsMidnight } from '@/domain/habit/window';
import { useTheme } from '../theme';
import { radius, space, type } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

export interface TimeRangeFieldProps {
  label: string;
  value: TimeWindow | null;
  onChange: (next: TimeWindow | null) => void;
  error?: string | null;
}

const DEFAULT_WINDOW: TimeWindow = { start: 420, end: 540 }; // 07:00–09:00

/**
 * Two clock inputs for a habit's time window.
 *
 * Deliberately plain text entry rather than a native picker: a picker costs
 * two modal round-trips to set a range, and this field sits inside a creation
 * flow that is already at risk of being abandoned (spec §3.1). Typing "7:30"
 * is faster than spinning a wheel.
 *
 * A window ending before it starts is valid and means it spans midnight, so
 * the field says so rather than treating it as a mistake.
 */
export function TimeRangeField({ label, value, onChange, error }: TimeRangeFieldProps) {
  const theme = useTheme();
  const [startText, setStartText] = useState(value ? formatMinute(value.start) : '');
  const [endText, setEndText] = useState(value ? formatMinute(value.end) : '');

  useEffect(() => {
    setStartText(value ? formatMinute(value.start) : '');
    setEndText(value ? formatMinute(value.end) : '');
  }, [value]);

  const commit = (rawStart: string, rawEnd: string) => {
    const start = parseMinute(rawStart);
    const end = parseMinute(rawEnd);
    if (start === null || end === null || start === end) return;
    onChange({ start, end });
  };

  if (!value) {
    return (
      <View style={styles.root}>
        <Text variant="label" tone="secondary">
          {label}
        </Text>
        <Button
          label="Add a time window"
          variant="ghost"
          onPress={() => onChange(DEFAULT_WINDOW)}
        />
        <Text variant="caption" tone="muted">
          Doing a habit at a consistent time makes it automatic faster.
        </Text>
      </View>
    );
  }

  const inputStyle = [
    styles.input,
    type.body,
    {
      color: theme.color.textPrimary,
      backgroundColor: theme.color.surfaceRaised,
      borderColor: error ? theme.color.caution : theme.color.border,
    },
  ];

  return (
    <View style={styles.root}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>

      <View style={styles.row}>
        <TextInput
          accessibilityLabel={`${label} start`}
          value={startText}
          onChangeText={setStartText}
          onBlur={() => commit(startText, endText)}
          placeholder="07:00"
          placeholderTextColor={theme.color.textMuted}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          style={inputStyle}
        />
        <Text variant="body" tone="muted">
          to
        </Text>
        <TextInput
          accessibilityLabel={`${label} end`}
          value={endText}
          onChangeText={setEndText}
          onBlur={() => commit(startText, endText)}
          placeholder="09:00"
          placeholderTextColor={theme.color.textMuted}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          style={inputStyle}
        />
      </View>

      {error ? (
        <Text variant="caption" tone="caution">
          {error}
        </Text>
      ) : (
        <Text variant="caption" tone="muted">
          {wrapsMidnight(value)
            ? `Overnight — ${windowLength(value)} minutes across midnight.`
            : `${windowLength(value)} minutes.`}
        </Text>
      )}

      <Button label="Remove window" variant="ghost" onPress={() => onChange(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: 48,
    textAlign: 'center',
  },
});
