import React from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { PUBLIC_LINKS } from '@/config/publicLinks';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';

const openPublicLink = (url: string) => {
  void Linking.openURL(url).catch(() => {
    Alert.alert('Link indisponivel', 'Nao foi possivel abrir esta pagina agora.');
  });
};

export const LoginScreen: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Campos obrigatorios', 'Preencha e-mail e senha.');
      return;
    }

    try {
      await login({ email, password });
      // O Stack.Protected troca automaticamente o grupo de auth pelo grupo privado.
    } catch (error: any) {
      Alert.alert('Falha no login', error?.message || 'Nao foi possivel realizar o login.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>ConcursoMestre</Text>
        <Text style={styles.title}>Entrar</Text>
        <Text style={styles.subtitle}>Acesse sua conta para continuar seus estudos.</Text>

        <View style={styles.form}>
          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="voce@exemplo.com"
          />
          <TextField
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Sua senha"
          />
          <PrimaryButton
            label="Entrar"
            onPress={handleLogin}
            loading={isLoading}
          />
        </View>

        <PrimaryButton
          label="Criar conta"
          onPress={() => router.push('/cadastro')}
          disabled={isLoading}
        />

        <View style={styles.legalLinks} accessibilityRole="text">
          <Pressable accessibilityRole="link" onPress={() => openPublicLink(PUBLIC_LINKS.privacy)}>
            <Text style={styles.legalLink}>Privacidade</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>•</Text>
          <Pressable accessibilityRole="link" onPress={() => openPublicLink(PUBLIC_LINKS.terms)}>
            <Text style={styles.legalLink}>Termos</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>•</Text>
          <Pressable accessibilityRole="link" onPress={() => openPublicLink(PUBLIC_LINKS.support)}>
            <Text style={styles.legalLink}>Suporte</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 12,
  },
  brand: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.primary,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  form: {
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  legalLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  legalSeparator: {
    color: colors.muted,
    fontSize: 12,
  },
});
