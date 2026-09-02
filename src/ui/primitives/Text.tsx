import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { numericStyle, type } from '../tokens';

type Variant = keyof typeof type;
type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'positive' | 'caution';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  /** Tabular figures. On by default for the display variant, where a level
   *  number that shifts width as it animates reads as a glitch. */
  numeric?: boolean;
}

export function Text({
  variant = 'body',
  tone = 'primary',
  numeric,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();

  const toneColor: Record<Tone, string> = {
    primary: theme.color.textPrimary,
    secondary: theme.color.textSecondary,
    muted: theme.color.textMuted,
    accent: theme.color.accent,
    positive: theme.color.positive,
    caution: theme.color.caution,
  };

  const useTabular = numeric ?? variant === 'display';

  return (
    <RNText
      style={[
        type[variant] as TextStyle,
        { color: toneColor[tone] },
        useTabular ? numericStyle : null,
        style,
      ]}
      {...rest}
    />
  );
}
