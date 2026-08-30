import React from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';
import { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'TwoFactor'>;

export const TwoFactorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { verifyTwoFactor, isLoading } = useAuth();
  const [code, setCode] = React.useState('');

  const submit = async () => {
    const normalizedCode = code.replace(/\D+/g, '');
    if (normalizedCode.length !== 6) {
      Alert.alert('Codigo invalido', 'Informe o codigo de 6 digitos.');
      return;
    }

    try {
      await verifyTwoFactor(route.params.email, normalizedCode);
    } catch (error: any) {
      Alert.alert('Falha na verificacao', error?.message || 'Nao foi possivel validar o codigo.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Verificacao em duas etapas</Text>
        <Text style={styles.subtitle}>Digite o codigo do seu aplicativo autenticador.</Text>
        <TextField
          label="Codigo"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          placeholder="000000"
        />
        <PrimaryButton label="Validar" onPress={submit} loading={isLoading} />
        <PrimaryButton label="Voltar" onPress={() => navigation.goBack()} disabled={isLoading} />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.card, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, lineHeight: 20 },
});
