import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList } from '@/navigation/types';
import { useAuth } from '@/providers/AuthProvider';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { QuestionsScreen } from '@/screens/QuestionsScreen';
import { PlansScreen } from '@/screens/PlansScreen';
import { SimulationsScreen } from '@/screens/SimulationsScreen';
import { RankingsScreen } from '@/screens/RankingsScreen';
import { MarketplaceScreen } from '@/screens/MarketplaceScreen';
import { ModulePlaceholderScreen } from '@/screens/ModulePlaceholderScreen';
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

const hiddenTabButton = () => null;

const QuestionsDisabledScreen: React.FC = () => (
  <ModulePlaceholderScreen
    title="Questoes"
    cardTitle="Modulo indisponivel"
    description="O modulo Questoes esta desativado no momento para o seu perfil."
  />
);

const SimulationsDisabledScreen: React.FC = () => (
  <ModulePlaceholderScreen
    title="Simulados"
    cardTitle="Modulo indisponivel"
    description="O modulo Simulados esta desativado no momento para o seu perfil."
  />
);

const RankingsDisabledScreen: React.FC = () => (
  <ModulePlaceholderScreen
    title="Ranking"
    cardTitle="Modulo indisponivel"
    description="O modulo Ranking esta desativado no momento para o seu perfil."
  />
);

const MarketplaceDisabledScreen: React.FC = () => (
  <ModulePlaceholderScreen
    title="Marketplace"
    cardTitle="Modulo indisponivel"
    description="O modulo Marketplace esta desativado no momento para o seu perfil."
  />
);

export const MainTabs: React.FC = () => {
  const { isFeatureEnabled } = useAuth();
  const canAccessQuestions = isFeatureEnabled('practiceEnabled');
  const canAccessSimulations = isFeatureEnabled('simulationsEnabled');
  const canAccessRankings = isFeatureEnabled('rankingsEnabled');
  const canAccessMarketplace = isFeatureEnabled('marketplaceEnabled');

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
        component={canAccessQuestions ? QuestionsScreen : QuestionsDisabledScreen}
        options={{
          title: 'Questoes',
          tabBarButton: canAccessQuestions ? undefined : hiddenTabButton,
        }}
      />
      <Tab.Screen
        name="Planos"
        component={PlansScreen}
        options={{ title: 'Planos' }}
      />
      <Tab.Screen
        name="Simulados"
        component={canAccessSimulations ? SimulationsScreen : SimulationsDisabledScreen}
        options={{
          title: 'Simulados',
          tabBarButton: canAccessSimulations ? undefined : hiddenTabButton,
        }}
      />
      <Tab.Screen
        name="Ranking"
        component={canAccessRankings ? RankingsScreen : RankingsDisabledScreen}
        options={{
          title: 'Ranking',
          tabBarButton: canAccessRankings ? undefined : hiddenTabButton,
        }}
      />
      <Tab.Screen
        name="Marketplace"
        component={canAccessMarketplace ? MarketplaceScreen : MarketplaceDisabledScreen}
        options={{
          title: 'Marketplace',
          tabBarLabel: 'Materiais',
          tabBarButton: canAccessMarketplace ? undefined : hiddenTabButton,
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{ title: 'Perfil' }}
      />
    </Tab.Navigator>
  );
};
