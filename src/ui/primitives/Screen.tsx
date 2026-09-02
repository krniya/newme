import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { space } from '../tokens';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
}

export function Screen({ children, scroll = true, padded = true, style }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const content: ViewStyle = {
    padding: padded ? space.lg : 0,
    paddingBottom: (padded ? space.lg : 0) + insets.bottom + space.xxl,
    gap: space.lg,
  };

  if (!scroll) {
    return (
      <View style={[styles.root, { backgroundColor: theme.color.background }, content, style]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.color.background }]}
      contentContainerStyle={[content, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
