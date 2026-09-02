import { StyleSheet, View } from 'react-native';
import type { Attribute } from '@/domain/types';
import { attributeColors, space } from '../tokens';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

const LABELS: Record<Attribute, string> = {
  vitality: 'Vitality',
  focus: 'Focus',
  discipline: 'Discipline',
  spirit: 'Spirit',
  bond: 'Bond',
};

export interface AttributeBarProps {
  attribute: Attribute;
  level: number;
  fraction: number;
}

/**
 * One row of the attribute readout. Spec §5.3.
 *
 * Five of these stacked is the app's best insight surface: a user sitting at
 * Focus 22 / Bond 4 is shown something no streak counter can tell them.
 */
export function AttributeBar({ attribute, level, fraction }: AttributeBarProps) {
  const color = attributeColors[attribute];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="label" tone="secondary">
          {LABELS[attribute]}
        </Text>
        <Text variant="label" numeric style={{ color }}>
          {level}
        </Text>
      </View>
      <ProgressBar
        fraction={fraction}
        color={color}
        height={5}
        accessibilityLabel={`${LABELS[attribute]}, level ${level}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
