import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { layout, radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme, type ResolvedAppTheme } from '@/theme/useAppTheme';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

/**
 * Adaptador visual legado. Sera substituido por controle de plataforma na fase Expo UI.
 */
export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  autoCapitalize = 'none',
}) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={styles.input}
      />
    </View>
  );
};

const createStyles = (theme: ResolvedAppTheme) => StyleSheet.create({
  wrapper: {
    gap: spacing[2],
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: theme.textMuted,
  },
  input: {
    minHeight: layout.controlHeight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    color: theme.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    paddingHorizontal: spacing[4],
  },
});
