import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { Attribute } from '@/domain/types';
import { attributeColors, balancedAccent, darkTheme, lightTheme, type Theme } from './tokens';

interface ThemeContextValue extends Theme {
  /** The attribute currently tinting the UI, or null when balanced. */
  dominantAttribute: Attribute | null;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  dominantAttribute = null,
}: {
  children: ReactNode;
  dominantAttribute?: Attribute | null;
}) {
  const scheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    // Dark is the default: `useColorScheme` returns null before the system
    // value is known, and flashing light-then-dark on every cold start is
    // worse than briefly being dark for a light-mode user.
    const base = scheme === 'light' ? lightTheme : darkTheme;
    const accent = dominantAttribute ? attributeColors[dominantAttribute] : balancedAccent;

    return {
      ...base,
      color: { ...base.color, accent },
      dominantAttribute,
    };
  }, [scheme, dominantAttribute]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
