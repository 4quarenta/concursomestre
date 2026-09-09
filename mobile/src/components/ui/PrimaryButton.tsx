import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { layout, radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme, type ResolvedAppTheme } from '@/theme/useAppTheme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Adaptador visual legado. Sera substituido por controle de plataforma na fase Expo UI.
 */
export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  loading = false,
  disabled = false,
}) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.onPrimary} />
      ) : (
        <Text style={styles.text}>{label}</Text>
      )}
    </Pressable>
  );
};

const createStyles = (theme: ResolvedAppTheme) => StyleSheet.create({
  button: {
    minHeight: layout.controlHeight,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    backgroundColor: theme.primary,
  },
  buttonPressed: {
    backgroundColor: theme.primaryPressed,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  text: {
    color: theme.onPrimary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
});
