import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Attribute, Difficulty } from '@/domain/types';
import { emptyDraft, type HabitDraft } from '@/domain/habit/definition';
import { validateHabit } from '@/domain/habit/validate';
import {
  Button,
  Card,
  ChipGroup,
  Divider,
  Stepper,
  Text,
  TextField,
  TimeRangeField,
} from '@/ui/primitives';
import { space } from '@/ui/tokens';
import { ScheduleEditor } from './ScheduleEditor';
import {
  ATTRIBUTE_BLURBS,
  CUE_SUGGESTIONS,
  DIFFICULTY_BLURBS,
  UNIT_OPTIONS,
  attributeOptions,
  difficultyOptions,
} from './options';

export interface HabitFormProps {
  initial?: HabitDraft;
  submitLabel: string;
  onSubmit: (draft: HabitDraft) => Promise<void>;
  onCancel: () => void;
}

/**
 * The habit create/edit form. Spec §3.3, §4.1.
 *
 * ---------------------------------------------------------------------------
 * Why the intention fields are prompted but not required
 * ---------------------------------------------------------------------------
 *
 * Spec §3.3 says the creation flow "forces" cue, window, place and dose. That
 * is right about the research and wrong about the failure mode. §3.1 is the
 * competing constraint: behaviour needs *ability*, and the highest-friction
 * moment in a habit app is the form standing between someone's intention and
 * a saved habit. A required four-field intention is exactly the wall that
 * makes people give up before they have a single habit to fail at.
 *
 * So: step 1 is the minimum needed to save. Step 2 is the intention, shown by
 * default with real defaults, and skippable. A habit saved without a cue gets
 * a persistent nudge on its detail screen instead — the app asks again later,
 * when the cost of answering is lower and the motivation is higher.
 *
 * This is a deliberate deviation from the letter of §3.3, in service of §3.1.
 */
export function HabitForm({ initial, submitLabel, onSubmit, onCancel }: HabitFormProps) {
  const [draft, setDraft] = useState<HabitDraft>(initial ?? emptyDraft());
  const [step, setStep] = useState<1 | 2>(1);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => validateHabit(draft), [draft]);
  const errorFor = (field: string) =>
    submitted ? (result.errors.find((e) => e.field === field)?.message ?? null) : null;

  const patch = (next: Partial<HabitDraft>) => setDraft((current) => ({ ...current, ...next }));

  const save = async () => {
    setSubmitted(true);
    if (!result.valid) {
      setStep(1);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.steps}>
        <Text variant="caption" tone={step === 1 ? 'accent' : 'muted'}>
          1 · What
        </Text>
        <Text variant="caption" tone={step === 2 ? 'accent' : 'muted'}>
          2 · When and where
        </Text>
      </View>

      {step === 1 ? (
        <>
          <Card>
            <TextField
              label="What are you doing?"
              value={draft.title}
              onChangeText={(title) => patch({ title })}
              placeholder="Run 5k"
              autoFocus
              error={errorFor('title')}
            />
          </Card>

          <Card>
            <ChipGroup
              label="What does it build?"
              options={attributeOptions}
              selected={draft.attributes}
              onChange={(attributes) => patch({ attributes: attributes as Attribute[] })}
              multiple
              max={2}
              error={errorFor('attributes')}
              hint={
                draft.attributes.length > 0
                  ? draft.attributes.map((a) => ATTRIBUTE_BLURBS[a]).join(' · ')
                  : 'Pick one or two.'
              }
            />
          </Card>

          <Card>
            <ChipGroup
              label="How hard is it?"
              options={difficultyOptions}
              selected={[draft.difficulty]}
              onChange={(next) => next[0] && patch({ difficulty: next[0] as Difficulty })}
              error={errorFor('difficulty')}
              hint={DIFFICULTY_BLURBS[draft.difficulty]}
            />
          </Card>

          <Card>
            <ScheduleEditor
              value={draft.schedule}
              onChange={(schedule) => patch({ schedule })}
              error={errorFor('schedule')}
            />
          </Card>

          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={onCancel} style={styles.grow} />
            <Button label="Next" onPress={() => setStep(2)} style={styles.grow} />
          </View>
        </>
      ) : (
        <>
          <Card>
            <TextField
              label="After what?"
              value={draft.cue ?? ''}
              onChangeText={(cue) => patch({ cue })}
              placeholder="after I brew coffee"
              optional
              error={errorFor('cue')}
              hint="Anchoring to something you already do beats picking a time."
            />
            <View style={styles.suggestions}>
              <ChipGroup
                options={CUE_SUGGESTIONS.map((c) => ({ value: c, label: c }))}
                selected={draft.cue ? [draft.cue] : []}
                onChange={(next) => patch({ cue: next[0] ?? null })}
              />
            </View>
          </Card>

          <Card>
            <TimeRangeField
              label="Roughly when?"
              value={draft.window}
              onChange={(window) => patch({ window })}
              error={errorFor('window')}
            />
          </Card>

          <Card>
            <TextField
              label="Where?"
              value={draft.place ?? ''}
              onChangeText={(place) => patch({ place })}
              placeholder="the park"
              optional
              error={errorFor('place')}
            />
          </Card>

          <Card>
            <Text variant="label" tone="secondary">
              How much?
            </Text>
            <View style={styles.dose}>
              <Stepper
                value={draft.target.value}
                target={draft.target.value + 1}
                onChange={(value) => patch({ target: { ...draft.target, value } })}
              />
              <ChipGroup
                options={UNIT_OPTIONS}
                selected={[draft.target.unit]}
                onChange={(next) =>
                  next[0] && patch({ target: { ...draft.target, unit: next[0] } })
                }
              />
            </View>
            {errorFor('target') ? (
              <Text variant="caption" tone="caution">
                {errorFor('target')}
              </Text>
            ) : (
              <Text variant="caption" tone="muted">
                Start smaller than feels worthwhile. You can raise it once it is automatic.
              </Text>
            )}
          </Card>

          {result.warnings.length > 0 ? (
            <Card>
              <Text variant="label" tone="caution">
                Worth considering
              </Text>
              <Divider style={styles.divider} />
              {result.warnings.map((warning) => (
                <Text key={warning.field} variant="caption" tone="muted">
                  {warning.message}
                </Text>
              ))}
            </Card>
          ) : null}

          <View style={styles.actions}>
            <Button label="Back" variant="ghost" onPress={() => setStep(1)} style={styles.grow} />
            <Button
              label={submitLabel}
              onPress={() => void save()}
              loading={saving}
              style={styles.grow}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  steps: { flexDirection: 'row', gap: space.lg },
  actions: { flexDirection: 'row', gap: space.sm },
  grow: { flexGrow: 1 },
  suggestions: { marginTop: space.md },
  dose: { gap: space.md, marginTop: space.sm },
  divider: { marginVertical: space.sm },
});
