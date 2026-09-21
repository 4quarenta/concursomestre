import "react-native-gesture-handler";
import React from "react";
import { Alert, BackHandler, Image, StyleSheet, Text, View } from "react-native";
import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { AppProviders } from "@/providers/AppProviders";
import { useAuth } from "@/providers/AuthProvider";
import { useAppTheme } from "@/theme/useAppTheme";
import { darkTheme, palette } from "@/theme/tokens";
import { analyticsService } from "@/services/analytics/analyticsService";

function RootNavigator() {
  const { user, isBootstrapped } = useAuth();
  const theme = useAppTheme();
  const pathname = usePathname();
  const statusBarStyle =
    user || theme.background === darkTheme.background ? "light" : "dark";

  React.useEffect(() => {
    if (!isBootstrapped) return undefined;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (router.canGoBack()) {
          router.back();
          return true;
        }

        Alert.alert(
          "Sair do aplicativo?",
          "Você deseja encerrar o ConcursoMestre?",
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Sair", style: "destructive", onPress: () => BackHandler.exitApp() },
          ],
        );
        return true;
      },
    );

    return () => subscription.remove();
  }, [isBootstrapped]);

  React.useEffect(() => {
    if (!isBootstrapped) return;
    void analyticsService.logScreenView(pathname);
  }, [isBootstrapped, pathname]);

  if (!isBootstrapped) {
    return (
      <>
        <StatusBar style="light" />
        <SplashView />
      </>
    );
  }

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Protected guard={Boolean(user)}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>

        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

function SplashView() {
  return (
    <LinearGradient
      colors={[palette.brand.lavender, palette.brand.navy]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.splash}
    >
      <Image
        accessibilityLabel="ConcursoMestre"
        resizeMode="contain"
        source={require("../assets/splash.png")}
        style={styles.splashLogo}
      />
      <Text style={styles.splashTagline}>
        Estude com propósito. Passe com confiança.
      </Text>
    </LinearGradient>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  splash: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  splashLogo: {
    height: 92,
    width: 300,
  },
  splashTagline: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 20,
  },
});
