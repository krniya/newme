import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { automaticity, isInternalised } from '@/domain';
import { Button, Card, ProgressBar, Screen, Text } from '@/ui/primitives';
import { space } from '@/ui/tokens';

/**
 * Phase 0: exercises the automaticity meter (spec §10.4), which replaces the
 * streak counter as a habit's headline metric after ~day 60.
 */
export default function InsightsScreen() {
  const [days, setDays] = useState(7);

  const score = automaticity({
    adherence28: 0.85,
    daysSinceStart: days,
    completionHours: [6.5, 7, 7.25, 6.75, 7],
  });

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Insights</Text>
      </View>

      <Card>
        <Text variant="heading">Automaticity</Text>
        <Text variant="caption" tone="muted">
          A habit at 85% adherence, done around 7am. Drag the day count to watch it mature.
        </Text>

        <View style={styles.readout}>
          <Text variant="display" numeric>
            {score}
          </Text>
          <Text variant="label" tone={isInternalised(score) ? 'positive' : 'muted'}>
            {isInternalised(score) ? 'Internalised' : `day ${days}`}
          </Text>
        </View>

        <ProgressBar fraction={score / 100} height={8} accessibilityLabel="Automaticity" />

        <View style={styles.buttons}>
          <Button
            label="−7 days"
            variant="ghost"
            onPress={() => setDays((d) => Math.max(0, d - 7))}
            style={styles.grow}
          />
          <Button
            label="+7 days"
            variant="ghost"
            onPress={() => setDays((d) => d + 7)}
            style={styles.grow}
          />
        </View>

        <Text variant="caption" tone="muted">
          Past 70 the UI stops leading with the streak and starts leading with identity — a habit
          held this long is won, even if the streak broke twice (spec §3.6).
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs, paddingTop: space.xxl },
  readout: { alignItems: 'center', gap: space.xs, marginVertical: space.lg },
  buttons: { flexDirection: 'row', gap: space.sm, marginVertical: space.md },
  grow: { flexGrow: 1 },
});
