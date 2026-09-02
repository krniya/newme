import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { HabitDraft } from '@/domain/habit/definition';
import { create } from '@/data/repos/habitRepo';
import { HabitForm } from '@/features/habits/HabitForm';
import { Screen, Text } from '@/ui/primitives';
import { space } from '@/ui/tokens';

export default function NewHabitScreen() {
  const router = useRouter();

  const save = async (draft: HabitDraft) => {
    await create(draft);
    // The Habits list is a live query, so it already has the new row by the
    // time this navigation lands — no refetch, no invalidation.
    router.back();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">New habit</Text>
      </View>

      <HabitForm submitLabel="Create habit" onSubmit={save} onCancel={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs, paddingTop: space.lg },
});
