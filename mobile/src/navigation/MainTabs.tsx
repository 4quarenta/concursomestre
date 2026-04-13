import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '@/navigation/types';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { QuestionsScreen } from '@/screens/QuestionsScreen';
import { PlansScreen } from '@/screens/PlansScreen';
import { SimulationsScreen } from '@/screens/SimulationsScreen';
import { RankingsScreen } from '@/screens/RankingsScreen';
import { colors } from '@/theme/colors';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleStyle: {
          fontWeight: '800',
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
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
        name="Perfil"
        component={ProfileScreen}
        options={{ title: 'Perfil' }}
      />
    </Tab.Navigator>
  );
};
