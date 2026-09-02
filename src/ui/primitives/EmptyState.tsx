import { StyleSheet, View } from 'react-native';
import { space } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Empty states are copy-sensitive here. The app never shames (spec §14.1), so
 * an empty list is an invitation, not a reprimand — "nothing planned yet",
 * never "you have not done anything".
 */
export function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <Text variant="heading" tone="secondary" style={styles.centered}>
        {title}
      </Text>
      {body ? (
        <Text variant="body" tone="muted" style={styles.centered}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  centered: { textAlign: 'center' },
});
