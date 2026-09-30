import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { borders, layout, radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme, type ResolvedAppTheme } from '@/theme/useAppTheme';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  helperText?: string;
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
  error,
  helperText,
}) => {
  const [focused, setFocused] = React.useState(false);
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
        placeholderTextColor={theme.textSubtle}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          focused && !error && styles.inputFocused,
          error && styles.inputError,
        ]}
      />
      {error || helperText ? (
        <Text style={[styles.helper, error && styles.errorText]} accessibilityLiveRegion="polite">
          {error || helperText}
        </Text>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ResolvedAppTheme) => StyleSheet.create({
  wrapper: {
    gap: spacing[1],
  },
  label: {
    fontSize: typography.role.label.fontSize,
    lineHeight: typography.role.label.lineHeight,
    fontWeight: typography.role.label.fontWeight,
    color: theme.text,
  },
  input: {
    minHeight: layout.controlHeight,
    borderRadius: radius.field,
    borderWidth: borders.subtle,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    color: theme.text,
    fontSize: 13,
    paddingHorizontal: spacing[3],
  },
  inputFocused: { borderColor: theme.primary, borderWidth: 1.5 },
  inputError: { borderColor: theme.danger, borderWidth: 1.5 },
  helper: { color: theme.textMuted, fontSize: 10, lineHeight: 14 },
  errorText: { color: theme.danger },
});
