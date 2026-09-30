import React from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { borders, darkTheme, layout, motion, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type MotionPressableProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

/** Press target compartilhado com resposta tátil visual curta e consistente. */
export function MotionPressable({
  disabled = false,
  onPressIn,
  onPressOut,
  style,
  ...props
}: MotionPressableProps) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = React.useState(false);

  const animateScale = (toValue: number, duration: number) => {
    Animated.timing(scale, { toValue, duration, useNativeDriver: true }).start();
  };

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        setPressed(true);
        if (!disabled) animateScale(motion.pressScale, motion.pressInDuration);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        animateScale(1, motion.pressOutDuration);
        onPressOut?.(event);
      }}
      style={[(typeof style === "function" ? style({ pressed }) : style), { transform: [{ scale }] }]}
    />
  );
}

export type AppTextVariant = keyof typeof typography.role;

type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  tone?: "primary" | "muted" | "subtle" | "onPrimary" | "danger" | "success";
};

export function AppText({
  variant = "body",
  tone = "primary",
  style,
  ...props
}: AppTextProps) {
  const theme = useAppTheme();
  const toneColor = {
    primary: theme.text,
    muted: theme.textMuted,
    subtle: theme.textSubtle,
    onPrimary: theme.onPrimary,
    danger: theme.danger,
    success: theme.success,
  }[tone];

  return <Text {...props} style={[{ ...typography.role[variant], color: toneColor } as TextStyle, style]} />;
}

type AppButtonVariant = "primary" | "secondary" | "danger" | "quiet" | "dangerQuiet";
type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Botão de ação com raio, tipografia, altura e resposta tátil padronizados. */
export function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  leading,
  trailing,
  style,
}: AppButtonProps) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createButtonStyles(theme), [theme]);
  const unavailable = disabled || loading;
  const variantStyle = {
    primary: styles.primary,
    secondary: styles.secondary,
    danger: styles.danger,
    quiet: styles.quiet,
    dangerQuiet: styles.dangerQuiet,
  }[variant];
  const textStyle = {
    primary: styles.primaryText,
    secondary: styles.secondaryText,
    danger: styles.dangerText,
    quiet: styles.quietText,
    dangerQuiet: styles.dangerQuietText,
  }[variant];
  const busyColor = variant === "primary" || variant === "danger" ? theme.onPrimary : theme.primary;

  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [styles.base, variantStyle, pressed && !unavailable && styles.pressed, unavailable && styles.disabled, style]}
    >
      {loading ? <ActivityIndicator size="small" color={busyColor} /> : leading}
      <Text style={textStyle}>{label}</Text>
      {!loading && trailing}
    </MotionPressable>
  );
}

export function AppLink({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <MotionPressable accessibilityRole="link" onPress={onPress} style={style}>
      <Text style={[typography.role.link, { color: theme.primary }]}>{label}</Text>
    </MotionPressable>
  );
}

type AppSurfaceProps = React.PropsWithChildren<{
  variant?: "plain" | "outlined" | "elevated" | "subtle";
  style?: StyleProp<ViewStyle>;
}>;

export function AppSurface({ children, variant = "plain", style }: AppSurfaceProps) {
  const theme = useAppTheme();
  const isDark = theme === darkTheme;
  const variantStyle = {
    plain: { backgroundColor: theme.surface },
    outlined: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: borders.hairline,
    },
    elevated: {
      backgroundColor: theme.surface,
      ...(isDark ? shadows.cardDark : shadows.card),
    },
    subtle: { backgroundColor: theme.surfaceSubtle },
  }[variant];

  return <View style={[styles.surface, variantStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: radius.card,
    padding: spacing[4],
  },
});

const createButtonStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radius.button,
    borderWidth: borders.subtle,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    minHeight: layout.buttonHeight,
    paddingHorizontal: spacing[3],
  },
  primary: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  secondary: { backgroundColor: theme.surface, borderColor: theme.border },
  danger: { backgroundColor: theme.danger, borderColor: theme.danger },
  quiet: { backgroundColor: "transparent", borderColor: "transparent" },
  dangerQuiet: { backgroundColor: "transparent", borderColor: "transparent" },
  primaryText: { ...typography.role.button, color: theme.onPrimary },
  secondaryText: { ...typography.role.button, color: theme.text },
  dangerText: { ...typography.role.button, color: theme.onPrimary },
  quietText: { ...typography.role.button, color: theme.primary },
  dangerQuietText: { ...typography.role.button, color: theme.danger },
  pressed: { opacity: 0.94 },
  disabled: { opacity: 0.55 },
});
