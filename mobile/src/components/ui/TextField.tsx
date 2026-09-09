import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/theme/colors';
import { layout, radius, spacing, typography } from '@/theme/tokens';

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
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={styles.input}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing[2],
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.muted,
  },
  input: {
    minHeight: layout.controlHeight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    paddingHorizontal: spacing[4],
  },
});
