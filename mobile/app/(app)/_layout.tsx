import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { motion, palette, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import { StudyMetricsBridge } from "@/services/statistics/StudyMetricsBridge";

export default function AppLayout() {
  const theme = useAppTheme();

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: palette.brand.navy }}
    >
      <Stack
        screenOptions={{
          animation: motion.routeAnimation,
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: typography.weight.extrabold },
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="configuracoes/aparencia" options={{ headerShown: false }} />
        <Stack.Screen name="configuracoes/conta" options={{ headerShown: false }} />
        <Stack.Screen name="trilhas/index" options={{ headerShown: false }} />
        <Stack.Screen name="planos/index" options={{ headerShown: false }} />
        <Stack.Screen
          name="notificacoes/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="ajuda/index" options={{ headerShown: false }} />
        <Stack.Screen name="perfil/editar" options={{ headerShown: false }} />
        <Stack.Screen name="questao/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="questao/detalhe/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="questoes/filtro/[type]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="simulados/novo"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="simulados/filtro/[type]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="simulados/executar"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="simulados/historico/[simulationId]"
          options={{ headerShown: false }}
        />
      </Stack>
      <StudyMetricsBridge />
    </SafeAreaView>
  );
}
