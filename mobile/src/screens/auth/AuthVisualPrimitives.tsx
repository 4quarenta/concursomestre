import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  type KeyboardTypeOptions,
  type TextInputProps,
  type ViewStyle,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import { AppButton } from "@/components/ui/Primitives";

type AuthHeroProps = {
  title: string;
  subtitle: string;
};

export function AuthHero({ title, subtitle }: AuthHeroProps) {
  return (
    <View style={styles.hero}>
      <Image
        accessibilityLabel="Logotipo ConcursoMestre"
        resizeMode="contain"
        source={require("../../../assets/splash.png")}
        style={styles.brandLogo}
      />
      <View style={styles.heroCopy}>
        <Text style={styles.kicker}>PREPARAÇÃO PARA CONCURSOS</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

type AuthFieldProps = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  secureTextEntry?: boolean;
  autoCorrect?: boolean;
  accessory?: React.ReactNode;
  textContentType?: TextInputProps["textContentType"];
};

export function AuthField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = "none",
  secureTextEntry = false,
  autoCorrect = false,
  accessory,
  textContentType,
}: AuthFieldProps) {
  const theme = useAppTheme();
  const [focused, setFocused] = React.useState(false);
  const fieldStyles = React.useMemo(() => createFieldStyles(theme), [theme]);

  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={[fieldStyles.inputShell, focused && fieldStyles.inputShellFocused]}>
        <Ionicons name={icon} size={17} color={theme.textMuted} />
        <TextInput
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={theme.textSubtle}
          secureTextEntry={secureTextEntry}
          style={[fieldStyles.input, focused && fieldStyles.inputFocused]}
          textContentType={textContentType}
          value={value}
        />
        {accessory}
      </View>
    </View>
  );
}

type AuthSubmitProps = {
  label: string;
  busyLabel?: string;
  loading: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export function AuthSubmitButton({
  label,
  busyLabel,
  loading,
  onPress,
  disabled = false,
  style,
}: AuthSubmitProps) {
  const theme = useAppTheme();
  return (
    <AppButton
      label={loading ? busyLabel || "Aguarde..." : label}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      trailing={!loading ? <Ionicons name="arrow-forward" size={17} color={theme.onPrimary} /> : undefined}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: palette.brand.navy,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    minHeight: 228,
    paddingBottom: 44,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  brandLogo: { height: 48, width: 190 },
  heroCopy: { marginTop: spacing[4] },
  kicker: {
    color: "#C7CBF3",
    fontSize: 9,
    fontWeight: typography.weight.bold,
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  heroTitle: {
    color: palette.white,
    fontSize: 25,
    fontWeight: typography.weight.bold,
    letterSpacing: -0.5,
    lineHeight: 30,
    maxWidth: 330,
  },
  heroSubtitle: {
    color: "#E0E2FF",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
});

const createFieldStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    wrapper: { gap: 6 },
    label: {
      color: theme.text,
      fontSize: typography.role.label.fontSize,
      lineHeight: typography.role.label.lineHeight,
      fontWeight: typography.role.label.fontWeight,
    },
    inputShell: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.field,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[3],
      minHeight: 48,
      paddingHorizontal: spacing[3],
    },
    inputShellFocused: { borderColor: theme.primary, borderWidth: 1.5 },
    input: {
      color: theme.text,
      flex: 1,
      fontSize: 13,
      minHeight: 48,
      paddingVertical: 0,
    },
    inputFocused: { borderColor: theme.primary, borderWidth: 1.5 },
  });

