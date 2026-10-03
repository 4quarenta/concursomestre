import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import { HomeDrawerVisibilityProvider, useHomeDrawerVisibility } from '@/features/home/HomeDrawerVisibilityContext';
import { AppBottomNavigation, type AppBottomNavigationRoute } from '@/components/navigation/AppBottomNavigation';
import { BottomBannerAd } from '@/components/ads/BottomBannerAd';
import { View } from 'react-native';

export const unstable_settings = {
  initialRouteName: 'inicio',
};

export default function TabsLayout() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  // Use the device's measured safe area. A fixed Android minimum can push the
  // tab bar away from the system navigation area or make it overlap on devices
  // with a different navigation mode.
  const bottomInset = insets.bottom;

  return (
    <HomeDrawerVisibilityProvider>
      <TabsLayoutContent theme={theme} bottomInset={bottomInset} />
    </HomeDrawerVisibilityProvider>
  );
}

function TabsLayoutContent({
  theme,
  bottomInset,
}: {
  theme: ReturnType<typeof useAppTheme>;
  bottomInset: number;
}) {
  const { visible: homeDrawerVisible } = useHomeDrawerVisibility();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: typography.weight.extrabold },
        tabBarHideOnKeyboard: true,
        freezeOnBlur: true,
      }}
      tabBar={({ state, navigation }) => (
        <View style={{ display: homeDrawerVisible ? 'none' : 'flex', backgroundColor: theme.surface }}>
          <BottomBannerAd />
          <AppBottomNavigation
            activeRoute={(state.routes[state.index]?.name as AppBottomNavigationRoute | undefined) ?? null}
            bottomInset={bottomInset}
            visible={!homeDrawerVisible}
            onNavigate={(route) => {
              if (state.routes[state.index]?.name === route) return;
              navigation.navigate(route as never);
            }}
          />
        </View>
      )}
    >
      <Tabs.Screen
        name="inicio"
        options={{
          title: 'Inicio',
          tabBarAccessibilityLabel: 'Início',
        }}
      />
      <Tabs.Screen
        name="questoes"
        options={{
          title: 'Questões',
          tabBarAccessibilityLabel: 'Praticar questões',
        }}
      />
      <Tabs.Screen
        name="simulados"
        options={{
          title: 'Simulados',
          tabBarAccessibilityLabel: 'Simulados',
        }}
      />
      <Tabs.Screen
        name="desempenho"
        options={{
          title: 'Desempenho',
          tabBarAccessibilityLabel: 'Desempenho',
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarAccessibilityLabel: 'Perfil',
        }}
      />
      <Tabs.Screen name="conta" options={{ href: null }} />
    </Tabs>
  );
}
