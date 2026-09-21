import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

export const AdPlaceholder = () => { const theme = useAppTheme(); return <View style={[styles.container, { backgroundColor: theme.surfaceSubtle }]}><Text style={[styles.label, { color: theme.textMuted }]}>PUBLICIDADE</Text><Text style={[styles.text, { color: theme.textMuted }]}>Espaço de anúncio</Text></View>; };
const styles = StyleSheet.create({ container: { alignItems: 'center', borderRadius: 12, gap: 4, padding: spacing[4] }, label: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1 }, text: { fontSize: typography.size.xs } });
