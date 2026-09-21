import { useColorScheme } from "react-native";
import { useAppearance } from "@/providers/AppearanceProvider";
import { darkTheme, lightTheme } from "@/theme/tokens";

/**
 * Tema semantico do ConcursoMestre seguindo a preferencia do sistema.
 * Novos componentes devem preferir este hook em vez do adaptador `colors` legado.
 */
export const useAppTheme = () => {
  const colorScheme = useColorScheme();
  const { theme: themePreference } = useAppearance();
  const isDark =
    themePreference === "dark" ||
    (themePreference === "system" && colorScheme === "dark");

  return isDark ? darkTheme : lightTheme;
};

export type ResolvedAppTheme = ReturnType<typeof useAppTheme>;
