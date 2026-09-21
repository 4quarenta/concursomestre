import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";

export type AppearanceTheme = "light" | "dark" | "system";
export type AppearanceAccent = "blue" | "violet" | "emerald" | "rose" | "amber";
export type AppearanceFontSize = "sm" | "md" | "lg";

type AppearanceContextValue = {
  theme: AppearanceTheme;
  accent: AppearanceAccent;
  fontSize: AppearanceFontSize;
  setTheme: (value: AppearanceTheme) => void;
  setAccent: (value: AppearanceAccent) => void;
  setFontSize: (value: AppearanceFontSize) => void;
};

const STORAGE_KEY = "concursomestre.appearance";
const AppearanceContext = React.createContext<AppearanceContextValue | null>(null);

const isTheme = (value: unknown): value is AppearanceTheme =>
  value === "light" || value === "dark" || value === "system";

const isAccent = (value: unknown): value is AppearanceAccent =>
  value === "blue" ||
  value === "violet" ||
  value === "emerald" ||
  value === "rose" ||
  value === "amber";

const isFontSize = (value: unknown): value is AppearanceFontSize =>
  value === "sm" || value === "md" || value === "lg";

export function AppearanceProvider({
  children,
}: React.PropsWithChildren) {
  const [theme, setTheme] = React.useState<AppearanceTheme>("system");
  const [accent, setAccent] = React.useState<AppearanceAccent>("blue");
  const [fontSize, setFontSize] = React.useState<AppearanceFontSize>("md");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((rawValue) => {
        if (!mounted || !rawValue) return;

        try {
          const saved = JSON.parse(rawValue) as Record<string, unknown>;
          if (isTheme(saved.theme)) setTheme(saved.theme);
          if (isAccent(saved.accent)) setAccent(saved.accent);
          if (isFontSize(saved.fontSize)) setFontSize(saved.fontSize);
        } catch {
          // Preferences are optional; invalid local data falls back to defaults.
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;

    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme, accent, fontSize }),
    ).catch(() => undefined);
  }, [accent, fontSize, hydrated, theme]);

  const value = React.useMemo<AppearanceContextValue>(
    () => ({
      theme,
      accent,
      fontSize,
      setTheme,
      setAccent,
      setFontSize,
    }),
    [accent, fontSize, theme],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = React.useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used inside AppearanceProvider");
  }
  return context;
}
