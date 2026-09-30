import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/theme/useAppTheme";
import { motion, palette } from "@/theme/tokens";

export default function AuthLayout() {
  const theme = useAppTheme();

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: palette.brand.navy }}
    >
      <Stack screenOptions={{ headerShown: false, animation: motion.routeAnimation }}>
        <Stack.Screen name="bem-vindo" />
        <Stack.Screen name="login" />
        <Stack.Screen name="cadastro" />
        <Stack.Screen name="esqueci-senha" />
      </Stack>
    </SafeAreaView>
  );
}
