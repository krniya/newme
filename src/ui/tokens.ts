import type { TextStyle } from 'react-native';
import type { Attribute } from '@/domain/types';

/**
 * Design tokens. Spec §6.3.
 *
 * Semantic names only — a component must never reference a raw hex value.
 * The accent shifts with the user's dominant attribute, so the app's colour
 * becomes a readout of what they have actually been doing.
 */

export const attributeColors: Record<Attribute, string> = {
  vitality: '#F0A458', // warm amber
  focus: '#5B9BF8', // cold blue
  discipline: '#C7D0DC', // steel white
  spirit: '#A98BF5', // violet
  bond: '#5FC79B', // green
};

/** A balanced character earns a prismatic accent — rarer, and better looking. */
export const balancedAccent = '#8DD3E8';

const palette = {
  ink900: '#05070B',
  ink800: '#0B0D12',
  ink700: '#12151C',
  ink600: '#1A1E27',
  ink500: '#252A36',
  ink400: '#3A404F',
  slate300: '#6B7382',
  slate200: '#9AA3B2',
  slate100: '#C9D0DA',
  paper: '#FFFFFF',
  paper50: '#F7F8FA',
  paper100: '#EDEFF3',
  paper200: '#DDE1E8',
  positive: '#5FC79B',
  caution: '#F0A458',
  danger: '#E8735F',
} as const;

export interface Theme {
  name: 'dark' | 'light';
  color: {
    background: string;
    surface: string;
    surfaceRaised: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    onAccent: string;
    positive: string;
    caution: string;
    /** Reserved for genuine errors only. A missed habit is never "danger" —
     *  it goes grey and sinks down the list (spec §6.2). */
    danger: string;
  };
}

export const darkTheme: Theme = {
  name: 'dark',
  color: {
    background: palette.ink800,
    surface: palette.ink700,
    surfaceRaised: palette.ink600,
    border: palette.ink500,
    textPrimary: palette.paper50,
    textSecondary: palette.slate100,
    textMuted: palette.slate300,
    accent: balancedAccent,
    onAccent: palette.ink900,
    positive: palette.positive,
    caution: palette.caution,
    danger: palette.danger,
  },
};

export const lightTheme: Theme = {
  name: 'light',
  color: {
    background: palette.paper50,
    surface: palette.paper,
    surfaceRaised: palette.paper,
    border: palette.paper200,
    textPrimary: palette.ink800,
    textSecondary: palette.ink500,
    textMuted: palette.slate300,
    accent: '#2E7E97',
    onAccent: palette.paper,
    positive: '#2E9B6E',
    caution: '#C97A22',
    danger: '#C2503C',
  },
};

/** 4pt base scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Numbers are the hero of this UI, so they get their own scale and are always
 * rendered with tabular figures — a level bar that jitters as digits change
 * width undermines the one animation the whole product rests on.
 */
export const type = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

/**
 * Tabular figures. Kept out of the `type` scale above because that object is
 * `as const`, which would make `fontVariant` readonly and unassignable to
 * React Native's mutable `TextStyle`.
 */
export const numericStyle: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Motion budget (spec §6.3):
 *   utility <= 200ms, reward <= 1500ms, nothing blocks input.
 */
export const motion = {
  instant: 120,
  utility: 200,
  emphasis: 320,
  reward: 900,
  celebration: 1500,
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

/** Minimum interactive target, per spec §6.5. */
export const MIN_TOUCH_TARGET = 44;
