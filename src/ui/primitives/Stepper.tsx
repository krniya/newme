import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { MIN_TOUCH_TARGET, radius, space } from '../tokens';
import { Text } from './Text';

export interface StepperProps {
  value: number;
  target: number;
  unit?: string;
  onChange: (next: number) => void;
  disabled?: boolean;
}

/**
 * Inline counter for quantitative habits ("water 6/8"). Spec §6.2.
 *
 * Incrementing in place beats opening a sheet: a habit you log eight times a
 * day has to cost one tap, or it stops being logged.
 */
export function Stepper({ value, target, unit, onChange, disabled = false }: StepperProps) {
  const theme = useTheme();
  const complete = value >= target;

  const step = (delta: number) => {
    if (disabled) return;
    const next = Math.max(0, value + delta);
    if (next === value) return;
    void Haptics.selectionAsync();
    onChange(next);
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => step(-1)}
        disabled={disabled || value === 0}
        accessibilityRole="button"
        accessibilityLabel={`Decrease, currently ${value} of ${target}`}
        hitSlop={8}
        style={[styles.button, { borderColor: theme.color.border, opacity: value === 0 ? 0.35 : 1 }]}
      >
        <Text variant="heading" tone="secondary">
          −
        </Text>
      </Pressable>

      <View style={styles.readout}>
        <Text variant="label" numeric tone={complete ? 'positive' : 'primary'}>
          {value}/{target}
        </Text>
        {unit && unit !== 'count' ? (
          <Text variant="caption" tone="muted">
            {unit}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => step(1)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Increase, currently ${value} of ${target}`}
        hitSlop={8}
        style={[styles.button, { borderColor: theme.color.border }]}
      >
        <Text variant="heading" tone="secondary">
          +
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  button: {
    minWidth: MIN_TOUCH_TARGET - 8,
    minHeight: MIN_TOUCH_TARGET - 8,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readout: { minWidth: 56, alignItems: 'center' },
});
