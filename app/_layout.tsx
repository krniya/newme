import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import { configurePragmas, db } from '@/data/db/client';
import migrations from '@/data/db/migrations/migrations';
import { ThemeProvider } from '@/ui/theme';
import { Text } from '@/ui/primitives';
import { darkTheme, space } from '@/ui/tokens';

export default function RootLayout() {
  useEffect(() => {
    configurePragmas();
  }, []);

  /**
   * Migrations run on every launch, before anything reads the database.
   *
   * With no backend there is no way to repair a device remotely, so a failed
   * migration must be loud rather than silently degrading into an app that
   * appears to have lost the user's history.
   */
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: darkTheme.color.background }]}>
        <ThemeProvider>
          <Text variant="heading">Couldn&apos;t open your data</Text>
          <Text variant="body" tone="muted" style={styles.message}>
            The database didn&apos;t finish setting up. Your existing data has not been changed.
            {'\n\n'}
            {error.message}
          </Text>
        </ThemeProvider>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={[styles.center, { backgroundColor: darkTheme.color.background }]}>
        <ActivityIndicator color={darkTheme.color.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  message: { textAlign: 'center' },
});
