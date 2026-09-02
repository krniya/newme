import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export function Divider({ style }: { style?: ViewStyle }) {
  const theme = useTheme();
  return <View style={[{ height: 1, backgroundColor: theme.color.border }, style]} />;
}
