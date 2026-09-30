import { View } from 'react-native';
import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import { HomeDrawerVisibilityProvider, useHomeDrawerVisibility } from '@/features/home/HomeDrawerVisibilityContext';

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
  const bottomPadding = Math.max(spacing[2], bottomInset);
  const tabStyles = {
    iconSlot: {
      alignItems: 'center' as const,
      height: 32,
      justifyContent: 'center' as const,
      position: 'relative' as const,
      width: 44,
    },
    activeIcon: {
      alignItems: 'center' as const,
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.sm,
      height: 28,
      justifyContent: 'center' as const,
      width: 36,
    },
    indicator: {
      backgroundColor: theme.primary,
      borderBottomLeftRadius: 3,
      borderBottomRightRadius: 3,
      height: 3,
      position: 'absolute' as const,
      top: -spacing[3],
      width: 28,
    },
  };

  const renderTabIcon = (
    name: ComponentProps<typeof Ionicons>['name'],
    focused: boolean,
  ) => (
    <View style={tabStyles.iconSlot}>
      {focused ? <View style={tabStyles.indicator} /> : null}
      <View style={focused ? tabStyles.activeIcon : undefined}>
        <Ionicons name={name} color={focused ? theme.text : theme.textMuted} size={21} />
      </View>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: typography.weight.extrabold },
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          // Keep the bar tall enough for its content even if Android reports
          // no bottom inset; the minimum padding is included in the height.
          height: 64 + bottomPadding,
          paddingTop: spacing[2],
          paddingBottom: bottomPadding,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          backgroundColor: theme.surface,
          elevation: 0,
          zIndex: 10,
          ...(homeDrawerVisible ? { display: 'none' as const } : null),
        },
        tabBarItemStyle: { paddingTop: spacing[1] },
        tabBarIconStyle: { marginTop: 0 },
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: typography.role.caption.fontSize,
          lineHeight: typography.role.caption.lineHeight,
          fontWeight: typography.weight.medium,
          marginTop: spacing[1],
        },
      }}
    >
      <Tabs.Screen
        name="inicio"
        options={{
          title: 'Inicio',
          tabBarAccessibilityLabel: 'Início',
          tabBarIcon: ({ focused }) => renderTabIcon('home-outline', focused),
        }}
      />
      <Tabs.Screen
        name="questoes"
        options={{
          title: 'Questões',
          tabBarAccessibilityLabel: 'Praticar questões',
          tabBarIcon: ({ focused }) => renderTabIcon('create-outline', focused),
        }}
      />
      <Tabs.Screen
        name="simulados"
        options={{
          title: 'Simulados',
          tabBarAccessibilityLabel: 'Simulados',
          tabBarIcon: ({ focused }) => renderTabIcon('clipboard-outline', focused),
        }}
      />
      <Tabs.Screen
        name="desempenho"
        options={{
          title: 'Desempenho',
          tabBarAccessibilityLabel: 'Desempenho',
          tabBarIcon: ({ focused }) => renderTabIcon('stats-chart-outline', focused),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarAccessibilityLabel: 'Perfil',
          tabBarIcon: ({ focused }) => renderTabIcon('person-outline', focused),
        }}
      />
      <Tabs.Screen name="conta" options={{ href: null }} />
    </Tabs>
  );
}
