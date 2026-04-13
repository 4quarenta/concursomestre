import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/providers/AuthProvider';
import { AuthNavigator } from '@/navigation/AuthNavigator';
import { MainTabs } from '@/navigation/MainTabs';
import { AppStackParamList } from '@/navigation/types';
import { CheckoutScreen } from '@/screens/CheckoutScreen';
import { SimulationConfigScreen } from '@/screens/SimulationConfigScreen';
import { SimulationRunScreen } from '@/screens/SimulationRunScreen';
import { colors } from '@/theme/colors';

const Stack = createNativeStackNavigator<AppStackParamList>();

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
    <NavigationContainer>
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
