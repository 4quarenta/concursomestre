import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList } from '@/navigation/types';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { QuestionsScreen } from '@/screens/QuestionsScreen';
import { PlansScreen } from '@/screens/PlansScreen';
import { SimulationsScreen } from '@/screens/SimulationsScreen';
import { RankingsScreen } from '@/screens/RankingsScreen';
import { MarketplaceScreen } from '@/screens/MarketplaceScreen';
import { colors } from '@/theme/colors';

const Tab = createBottomTabNavigator<MainTabParamList>();
type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof MainTabParamList, TabIconName> = {
  Dashboard: 'grid-outline',
  Questoes: 'help-circle-outline',
  Planos: 'card-outline',
  Simulados: 'timer-outline',
  Ranking: 'trophy-outline',
  Marketplace: 'bag-handle-outline',
  Perfil: 'person-circle-outline',
};

export const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleStyle: {
          fontWeight: '800',
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarStyle: {
          height: 62,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard', tabBarLabel: 'Inicio' }}
      />
      <Tab.Screen
        name="Questoes"
        component={QuestionsScreen}
        options={{ title: 'Questoes' }}
      />
      <Tab.Screen
        name="Planos"
        component={PlansScreen}
        options={{ title: 'Planos' }}
      />
      <Tab.Screen
        name="Simulados"
        component={SimulationsScreen}
        options={{ title: 'Simulados' }}
      />
      <Tab.Screen
        name="Ranking"
        component={RankingsScreen}
        options={{ title: 'Ranking' }}
      />
      <Tab.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{ title: 'Marketplace', tabBarLabel: 'Materiais' }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{ title: 'Perfil' }}
      />
    </Tab.Navigator>
  );
};
