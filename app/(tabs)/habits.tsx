import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useActiveHabits } from '@/features/habits/useHabits';
import { HabitRow } from '@/features/habits/HabitRow';
import { Button, Card, EmptyState, Screen, Text } from '@/ui/primitives';
import { space } from '@/ui/tokens';

/**
 * The Habits tab. Spec §4.1.
 *
 * A count is shown once there are five or more, because habit count is the
 * strongest early predictor of churn (§14): over-adding on day one is how
 * people end up with fifteen habits and none of them kept.
 */
export default function HabitsScreen() {
  const router = useRouter();
  const { habits, loading } = useActiveHabits();

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Habits</Text>
        {habits.length > 0 ? (
          <Text variant="caption" tone={habits.length > 8 ? 'caution' : 'muted'}>
            {habits.length} active
            {habits.length > 8 ? ' — that is a lot to hold at once' : ''}
          </Text>
        ) : null}
      </View>

      {loading ? null : habits.length === 0 ? (
        <Card>
          <EmptyState
            title="No habits yet"
            body="Start with one, and make it smaller than feels worthwhile. You can always raise it once it is automatic."
            actionLabel="Add your first habit"
            onAction={() => router.push('/habit/new')}
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {habits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onPress={() => router.push(`/habit/${habit.id}`)}
            />
          ))}
        </View>
      )}

      {habits.length > 0 ? (
        <Button label="Add a habit" onPress={() => router.push('/habit/new')} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs, paddingTop: space.xxl },
  list: { gap: space.md },
});
