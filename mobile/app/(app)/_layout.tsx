import React from "react";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { palette, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

export default function AppLayout() {
  const theme = useAppTheme();

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: palette.brand.lavender }}
    >
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: typography.weight.extrabold },
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="flashcards/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="flashcards/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="noticias/index" options={{ headerShown: false }} />
        <Stack.Screen name="noticias/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="novidades/index" options={{ headerShown: false }} />
        <Stack.Screen
          name="lei-comentada/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="lei-comentada/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="trilhas/index" options={{ headerShown: false }} />
        <Stack.Screen name="revisao/index" options={{ headerShown: false }} />
        <Stack.Screen name="ranking/index" options={{ headerShown: false }} />
        <Stack.Screen name="planos/index" options={{ headerShown: false }} />
        <Stack.Screen
          name="notificacoes/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="ajuda/index" options={{ headerShown: false }} />
        <Stack.Screen name="indicar/index" options={{ headerShown: false }} />
        <Stack.Screen name="perfil/editar" options={{ headerShown: false }} />
        <Stack.Screen
          name="configuracoes/estudo"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="configuracoes/metas"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="configuracoes/notificacoes"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="configuracoes/aparencia"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="configuracoes/privacidade"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="configuracoes/conta"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="questao/[id]" options={{ headerShown: false }} />
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
    </SafeAreaView>
  );
}
