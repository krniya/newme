import { StyleSheet, View } from 'react-native';
import { Card, EmptyState, Screen, Text } from '@/ui/primitives';
import { localDateOf } from '@/domain';
import { space } from '@/ui/tokens';

/**
 * Today — the default route, and the screen ~80% of usage lives in (spec §6.1).
 * Built for real in Phase 1; this is a placeholder that pins the day boundary.
 */
export default function TodayScreen() {
  const today = localDateOf(new Date());

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="caption" tone="muted">
          {today}
        </Text>
        <Text variant="title">Today</Text>
      </View>

      <Card>
        <EmptyState
          title="Nothing planned yet"
          body="The timeline, one-tap check-off and ritual player land in Phase 1. The engine behind them is already built and tested — see the Character tab."
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs, paddingTop: space.xxl },
});
