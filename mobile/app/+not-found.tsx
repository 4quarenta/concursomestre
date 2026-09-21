import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

export default function NotFoundScreen() {
  const theme = useAppTheme();
  const styles = React.useMemo(() => StyleSheet.create({
    screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background, padding: spacing[6] },
    card: { width: '100%', maxWidth: 520, gap: spacing[3], backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: radius.lg, padding: spacing[5] },
    title: { color: theme.text, fontSize: typography.size.xl, fontWeight: typography.weight.extrabold },
    text: { color: theme.textMuted, fontSize: typography.size.sm, lineHeight: 20 },
    button: { alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: radius.md, backgroundColor: theme.primary, paddingHorizontal: spacing[4] },
    buttonText: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  }), [theme]);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Pagina nao encontrada</Text>
        <Text style={styles.text}>Este link nao corresponde a uma tela valida do ConcursoMestre.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/inicio')} style={styles.button}>
          <Text style={styles.buttonText}>Ir para Inicio</Text>
        </Pressable>
      </View>
    </View>
  );
}
