import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { MIN_TOUCH_TARGET, radius, space } from '../tokens';
import { Text } from './Text';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  /** Overrides the accent when selected — used for attribute colours. */
  color?: string;
}

export interface ChipGroupProps<T extends string> {
  label?: string;
  options: ChipOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
  /** Single-select behaves like a segmented control. */
  multiple?: boolean;
  /** Selecting beyond this replaces the oldest rather than refusing. */
  max?: number;
  error?: string | null;
  hint?: string | null;
}

/**
 * Selection chips — difficulty, attributes, weekdays.
 *
 * When `max` is reached, another tap drops the oldest selection instead of
 * doing nothing. A control that silently ignores a tap reads as broken; one
 * that swaps is at worst surprising, and always makes progress.
 */
export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
  multiple = false,
  max,
  error,
  hint,
}: ChipGroupProps<T>) {
  const theme = useTheme();

  const toggle = (value: T) => {
    void Haptics.selectionAsync();

    if (!multiple) {
      onChange([value]);
      return;
    }

    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
      return;
    }

    const next = [...selected, value];
    onChange(max !== undefined && next.length > max ? next.slice(next.length - max) : next);
  };

  return (
    <View style={styles.root}>
      {label ? (
        <Text variant="label" tone="secondary">
          {label}
        </Text>
      ) : null}

      <View style={styles.chips}>
        {options.map((option) => {
          const active = selected.includes(option.value);
          const activeColor = option.color ?? theme.color.accent;

          return (
            <Pressable
              key={option.value}
              onPress={() => toggle(option.value)}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: active }}
              accessibilityLabel={option.label}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? activeColor : theme.color.surfaceRaised,
                  borderColor: active ? activeColor : theme.color.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                variant="label"
                style={{ color: active ? theme.color.onAccent : theme.color.textSecondary }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text variant="caption" tone="caution">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: MIN_TOUCH_TARGET - 8,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
  },
});
