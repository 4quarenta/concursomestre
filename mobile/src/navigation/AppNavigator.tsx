import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/providers/AuthProvider';
import { AuthNavigator } from '@/navigation/AuthNavigator';
import { MainTabs } from '@/navigation/MainTabs';
import { AppStackParamList } from '@/navigation/types';
import { CheckoutScreen } from '@/screens/CheckoutScreen';
import { SimulationConfigScreen } from '@/screens/SimulationConfigScreen';
import { SimulationRunScreen } from '@/screens/SimulationRunScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { RankingDetailScreen } from '@/screens/RankingDetailScreen';
import { PerformanceSubjectsScreen } from '@/screens/PerformanceSubjectsScreen';
import { MaterialDetailScreen } from '@/screens/MaterialDetailScreen';
import { colors } from '@/theme/colors';

const Stack = createNativeStackNavigator<AppStackParamList>();

const linking: LinkingOptions<AppStackParamList> = {
  prefixes: [
    'concursomestre://',
    'https://concursomestre.com.br',
    'https://www.concursomestre.com.br',
  ],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Dashboard: 'dashboard',
          Questoes: 'questoes',
          Planos: 'planos',
          Simulados: 'simulados',
          Ranking: 'ranking',
          Marketplace: 'materiais',
          Perfil: 'perfil',
        },
      },
      Notifications: 'notificacoes',
      RankingDetail: 'ranking/:rankingId',
      SimulationConfig: 'simulados/novo',
      PerformanceSubjects: 'desempenho/materias',
      MaterialDetail: 'material/:materialId',
    },
  },
};

export const AppNavigator: React.FC = () => {
  const { user, isBootstrapped } = useAuth();

  if (!isBootstrapped) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      {user ? (
        <Stack.Navigator>
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={{ title: 'Checkout' }}
          />
          <Stack.Screen
            name="SimulationConfig"
            component={SimulationConfigScreen}
            options={{ title: 'Novo Simulado' }}
          />
          <Stack.Screen
            name="SimulationRun"
            component={SimulationRunScreen}
            options={{ title: 'Simulado em andamento' }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ title: 'Notificacoes' }}
          />
          <Stack.Screen
            name="RankingDetail"
            component={RankingDetailScreen}
            options={{ title: 'Ranking' }}
          />
          <Stack.Screen
            name="PerformanceSubjects"
            component={PerformanceSubjectsScreen}
            options={{ title: 'Materias' }}
          />
          <Stack.Screen
            name="MaterialDetail"
            component={MaterialDetailScreen}
            options={{ title: 'Material' }}
          />
        </Stack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
