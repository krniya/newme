import { StyleSheet, View } from 'react-native';
import { Card, EmptyState, Screen, Text } from '@/ui/primitives';
import { space } from '@/ui/tokens';

export default function HabitsScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Habits</Text>
      </View>

      <Card>
        <EmptyState
          title="No habits yet"
          body="Creation flow arrives in Phase 1, with the cue, window and dose fields that make an implementation intention (spec §3.3). The database schema for all of it already exists."
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs, paddingTop: space.xxl },
});
