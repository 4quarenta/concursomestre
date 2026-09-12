import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList } from '@/navigation/types';
import { useAuth } from '@/providers/AuthProvider';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { QuestionsScreen } from '@/screens/QuestionsScreen';
import { SimulationsScreen } from '@/screens/SimulationsScreen';
import { ModulePlaceholderScreen } from '@/screens/ModulePlaceholderScreen';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

const Tab = createBottomTabNavigator<MainTabParamList>();
type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

type MvpTabName = 'Questoes' | 'Simulados' | 'Perfil';

const TAB_ICONS: Record<MvpTabName, TabIconName> = {
  Questoes: 'help-circle-outline',
  Simulados: 'timer-outline',
  Perfil: 'person-circle-outline',
};

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

/**
 * Navegacao temporaria do MVP durante a migracao para Expo Router.
 * Os demais modulos permanecem preservados no repositorio, mas nao sao expostos
 * na navegacao principal desta fase.
 */
export const MainTabs: React.FC = () => {
  const { isFeatureEnabled } = useAuth();
  const theme = useAppTheme();
  const canAccessQuestions = isFeatureEnabled('practiceEnabled');
  const canAccessSimulations = isFeatureEnabled('simulationsEnabled');

  return (
    <Tab.Navigator
      initialRouteName="Questoes"
      screenOptions={({ route }) => ({
        headerTitleStyle: {
          fontWeight: typography.weight.extrabold,
        },
        headerStyle: {
          backgroundColor: theme.surface,
        },
        headerTintColor: theme.text,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: {
          fontSize: typography.size.xs,
          fontWeight: typography.weight.bold,
        },
        tabBarStyle: {
          height: 64,
          paddingBottom: spacing[2],
          paddingTop: spacing[2],
          borderTopColor: theme.border,
          backgroundColor: theme.surface,
        },
        tabBarItemStyle: {
          borderRadius: radius.lg,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={TAB_ICONS[route.name as MvpTabName] || 'ellipse-outline'}
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Questoes"
        component={canAccessQuestions ? QuestionsScreen : QuestionsDisabledScreen}
        options={{ title: 'Questoes' }}
      />
      <Tab.Screen
        name="Simulados"
        component={canAccessSimulations ? SimulationsScreen : SimulationsDisabledScreen}
        options={{ title: 'Simulados' }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{ title: 'Conta', tabBarLabel: 'Conta' }}
      />
    </Tab.Navigator>
  );
};
