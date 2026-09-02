import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { radius, space } from '../tokens';
import { Text } from './Text';

export interface StatPillProps {
  label: string;
  value: string | number;
  color?: string;
  accessibilityLabel?: string;
}

export function StatPill({ label, value, color, accessibilityLabel }: StatPillProps) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
      style={[styles.pill, { backgroundColor: theme.color.surfaceRaised, borderColor: theme.color.border }]}
    >
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="label" numeric style={color ? { color } : undefined}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
});
