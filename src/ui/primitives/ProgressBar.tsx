import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ReduceMotion,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { radius } from '../tokens';

export interface ProgressBarProps {
  /** 0–1. Values outside the range are clamped rather than overflowing. */
  fraction: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/**
 * The level bar. Spec §6.2.
 *
 * Runs on the UI thread via Reanimated, so filling it never competes with a
 * React render — this is the animation the whole check-off moment hangs on,
 * and a dropped frame here is felt. Honours reduced-motion by settling
 * instantly rather than by not moving, so the value is still correct.
 */
export function ProgressBar({
  fraction,
  height = 6,
  color,
  trackColor,
  style,
  accessibilityLabel,
}: ProgressBarProps) {
  const theme = useTheme();
  const progress = useSharedValue(clamp01(fraction));

  useEffect(() => {
    progress.value = withSpring(clamp01(fraction), {
      damping: 20,
      stiffness: 140,
      reduceMotion: ReduceMotion.System,
    });
  }, [fraction, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp01(fraction) * 100) }}
      style={[
        styles.track,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: trackColor ?? theme.color.border,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          fill,
          { height, borderRadius: radius.pill, backgroundColor: color ?? theme.color.accent },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
});

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
