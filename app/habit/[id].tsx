import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { HabitDefinition, HabitDraft } from '@/domain/habit/definition';
import { hasIntention } from '@/domain/habit/definition';
import { archive, findById, remove, update } from '@/data/repos/habitRepo';
import { HabitForm } from '@/features/habits/HabitForm';
import { describeSchedule } from '@/features/habits/HabitRow';
import { Button, Card, Divider, EmptyState, Screen, Text } from '@/ui/primitives';
import { space } from '@/ui/tokens';

function toDraft(habit: HabitDefinition): HabitDraft {
  return {
    title: habit.title,
    kind: habit.kind,
    polarity: habit.polarity,
    difficulty: habit.difficulty,
    attributes: habit.attributes,
    cue: habit.cue,
    window: habit.window,
    place: habit.place,
    target: habit.target,
    schedule: habit.schedule,
    dueDate: habit.dueDate,
    ritualId: habit.ritualId,
    ritualOrder: habit.ritualOrder,
  };
}

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [habit, setHabit] = useState<HabitDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setHabit(await findById(id));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Screen />;

  if (!habit) {
    return (
      <Screen>
        <Card>
          <EmptyState
            title="That habit is gone"
            body="It may have been deleted on this device."
            actionLabel="Back"
            onAction={() => router.back()}
          />
        </Card>
      </Screen>
    );
  }

  if (editing) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text variant="title">Edit habit</Text>
        </View>
        <HabitForm
          initial={toDraft(habit)}
          submitLabel="Save changes"
          onSubmit={async (draft) => {
            await update(habit.id, draft);
            await load();
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">{habit.title}</Text>
        <Text variant="caption" tone="muted">
          {describeSchedule(habit)} · {habit.difficulty}
        </Text>
      </View>

      {/**
       * The nudge the form defers to. Rather than blocking creation on an
       * anchor (spec §3.3 vs §3.1), the app asks again here — later, when
       * answering is cheap and the habit already exists to improve.
       */}
      {!hasIntention(habit) ? (
        <Card raised>
          <Text variant="heading">Give it an anchor</Text>
          <Text variant="body" tone="muted">
            Habits tied to something you already do — &ldquo;after I brew coffee&rdquo; — stick far
            better than ones tied to a time. It takes ten seconds.
          </Text>
          <View style={styles.nudge}>
            <Button label="Add an anchor" onPress={() => setEditing(true)} />
          </View>
        </Card>
      ) : null}

      <Card>
        <Text variant="label" tone="secondary">
          The intention
        </Text>
        <Divider style={styles.divider} />
        <Detail label="After" value={habit.cue} />
        <Detail
          label="When"
          value={habit.window ? `${habit.window.start} → ${habit.window.end}` : null}
        />
        <Detail label="Where" value={habit.place} />
        <Detail label="How much" value={`${habit.target.value} ${habit.target.unit}`} />
        <Detail label="Builds" value={habit.attributes.join(', ')} />
      </Card>

      <View style={styles.actions}>
        <Button label="Edit" onPress={() => setEditing(true)} style={styles.grow} />
        <Button
          label="Archive"
          variant="ghost"
          onPress={async () => {
            await archive(habit.id);
            router.back();
          }}
          style={styles.grow}
        />
      </View>

      <Card>
        <Text variant="caption" tone="muted">
          Archiving keeps every completion you have logged and just takes it off Today. Deleting
          hides it too — your history stays either way.
        </Text>
        <View style={styles.nudge}>
          <Button
            label="Delete"
            variant="ghost"
            onPress={async () => {
              await remove(habit.id);
              router.back();
            }}
          />
        </View>
      </Card>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.detail}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="body" tone={value ? 'primary' : 'muted'}>
        {value ?? 'not set'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs, paddingTop: space.lg },
  divider: { marginVertical: space.sm },
  detail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs },
  actions: { flexDirection: 'row', gap: space.sm },
  grow: { flexGrow: 1 },
  nudge: { marginTop: space.md },
});
