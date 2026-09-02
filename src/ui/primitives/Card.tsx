import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { radius, space } from '../tokens';

export interface CardProps extends ViewProps {
  raised?: boolean;
  padded?: boolean;
  style?: ViewStyle;
}

export function Card({ raised = false, padded = true, style, ...rest }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: raised ? theme.color.surfaceRaised : theme.color.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.color.border,
          padding: padded ? space.lg : 0,
        },
        style,
      ]}
      {...rest}
    />
  );
}
