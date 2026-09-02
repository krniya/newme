import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { MIN_TOUCH_TARGET, motion } from '../tokens';
import { Text } from './Text';

export interface CheckButtonProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
  size?: number;
}

/**
 * The one-tap check-off. Spec §6.2.
 *
 * "No confirmation dialog, ever" — undo lives in a snackbar instead, because
 * a dialog on the single most repeated action in the app would make the whole
 * product feel like paperwork. The scale pop plus a haptic is deliberately
 * over-invested in: this ~300ms is the moment the user is actually buying.
 */
export function CheckButton({
  checked,
  onToggle,
  label,
  disabled = false,
  size = 28,
}: CheckButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const fill = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    fill.value = withTiming(checked ? 1 : 0, {
      duration: motion.instant,
      reduceMotion: ReduceMotion.System,
    });
  }, [checked, fill]);

  const handlePress = () => {
    if (disabled) return;

    if (!checked) {
      scale.value = withSequence(
        withSpring(1.18, { damping: 12, stiffness: 400, reduceMotion: ReduceMotion.System }),
        withSpring(1, { damping: 14, stiffness: 260, reduceMotion: ReduceMotion.System }),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onToggle();
  };

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: fill.value > 0.5 ? theme.color.accent : 'transparent',
    borderColor: fill.value > 0.5 ? theme.color.accent : theme.color.border,
  }));

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      hitSlop={12}
      style={styles.pressable}
    >
      <Animated.View
        style={[styles.box, { width: size, height: size, borderRadius: size / 2 }, boxStyle]}
      >
        {checked ? (
          <Text variant="label" style={{ color: theme.color.onAccent }}>
            ✓
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
