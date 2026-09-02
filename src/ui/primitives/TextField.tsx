import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme';
import { radius, space, type } from '../tokens';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Shown under the field in a caution tone; also marks the border. */
  error?: string | null;
  hint?: string | null;
  optional?: boolean;
}

export function TextField({ label, error, hint, optional, ...rest }: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.root}>
      <View style={styles.labelRow}>
        <Text variant="label" tone="secondary">
          {label}
        </Text>
        {optional ? (
          <Text variant="caption" tone="muted">
            optional
          </Text>
        ) : null}
      </View>

      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.color.textMuted}
        style={[
          styles.input,
          type.body,
          {
            color: theme.color.textPrimary,
            backgroundColor: theme.color.surfaceRaised,
            borderColor: error ? theme.color.caution : theme.color.border,
          },
        ]}
        {...rest}
      />

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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: 48,
  },
});
