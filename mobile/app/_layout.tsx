import "react-native-gesture-handler";
import React from "react";
import { Alert, BackHandler, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router, Stack, usePathname } from "expo-router";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { AppProviders } from "@/providers/AppProviders";
import { useAuth } from "@/providers/AuthProvider";
import { useAppTheme } from "@/theme/useAppTheme";
import { darkTheme, palette } from "@/theme/tokens";
import { analyticsService } from "@/services/analytics/analyticsService";
import { isAppVersionBelow } from "@/services/system/appVersionPolicy";

function RootNavigator() {
  const { user, isBootstrapped, systemSettings } = useAuth();
  const theme = useAppTheme();
  const pathname = usePathname();
  const statusBarStyle =
    user || theme.background === darkTheme.background ? "light" : "dark";
  const updatePolicy = systemSettings.mobileAppUpdatePolicy;
  const installedVersion = String(Constants.nativeAppVersion || Constants.expoConfig?.version || "");
  const minimumUpdateRequired = updatePolicy.enabled
    && isAppVersionBelow(installedVersion, updatePolicy.minimumVersion);
  const recommendedUpdateAvailable = updatePolicy.enabled
    && !minimumUpdateRequired
    && isAppVersionBelow(installedVersion, updatePolicy.latestVersion);
  const storeUrl = (Platform.OS === "ios" ? updatePolicy.iosStoreUrl : updatePolicy.androidStoreUrl)
    || updatePolicy.androidStoreUrl
    || updatePolicy.iosStoreUrl;
  const recommendedPromptedVersion = React.useRef("");

  React.useEffect(() => {
    if (!isBootstrapped || !recommendedUpdateAvailable || recommendedPromptedVersion.current === updatePolicy.latestVersion) return;
    recommendedPromptedVersion.current = updatePolicy.latestVersion;
    Alert.alert(
      "Atualização disponível",
      updatePolicy.message || `A versão ${updatePolicy.latestVersion} do ConcursoMestre está disponível.`,
      [
        { text: "Depois", style: "cancel" },
        ...(storeUrl ? [{ text: "Atualizar", onPress: () => void Linking.openURL(storeUrl).catch(() => undefined) }] : []),
      ],
    );
  }, [isBootstrapped, recommendedUpdateAvailable, storeUrl, updatePolicy.latestVersion, updatePolicy.message]);

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

  if (minimumUpdateRequired) {
    return (
      <>
        <StatusBar style="dark" />
        <View style={styles.updateGate}>
          <View style={styles.updatePanel}>
            <Text style={styles.updateEyebrow}>ATUALIZAÇÃO OBRIGATÓRIA</Text>
            <Text style={styles.updateTitle}>Atualize o ConcursoMestre</Text>
            <Text style={styles.updateMessage}>
              {updatePolicy.message || `Esta versão não é mais compatível. Instale a versão ${updatePolicy.minimumVersion} ou superior para continuar.`}
            </Text>
            <Text style={styles.updateVersion}>Instalada: {installedVersion || "desconhecida"} · Mínima: {updatePolicy.minimumVersion}</Text>
            {storeUrl ? (
              <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(storeUrl).catch(() => Alert.alert("Não foi possível abrir a loja", "Acesse a loja de aplicativos e atualize o ConcursoMestre."))} style={styles.updateButton}>
                <Text style={styles.updateButtonText}>Atualizar aplicativo</Text>
              </Pressable>
            ) : (
              <Text style={styles.updateUnavailable}>O link da loja ainda não foi configurado. Entre em contato com o suporte.</Text>
            )}
          </View>
        </View>
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
  updateGate: {
    alignItems: "center",
    backgroundColor: "#f4f6fb",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  updatePanel: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe3f0",
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: 480,
    padding: 24,
    width: "100%",
  },
  updateEyebrow: { color: "#4f46e5", fontSize: 12, fontWeight: "800", letterSpacing: 1.1 },
  updateTitle: { color: "#111827", fontSize: 23, fontWeight: "800", marginTop: 12 },
  updateMessage: { color: "#475569", fontSize: 15, lineHeight: 23, marginTop: 10 },
  updateVersion: { color: "#64748b", fontSize: 12, marginTop: 16 },
  updateButton: { alignItems: "center", backgroundColor: "#3157d5", borderRadius: 10, marginTop: 22, paddingHorizontal: 16, paddingVertical: 14 },
  updateButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  updateUnavailable: { color: "#9a3412", fontSize: 13, lineHeight: 19, marginTop: 18 },
});
