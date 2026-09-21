import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AdPlaceholder } from '@/features/content/components/AdPlaceholder';
import { ContentHeader } from '@/features/content/components/ContentHeader';
import { flashcardDecks } from '@/features/content/contentData';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

export default function FlashcardsScreen() {
  const theme = useAppTheme();
  const [unlocked, setUnlocked] = React.useState<string[]>([]);
  const unlockWithAd = (id: string) => Alert.alert('Assista para desbloquear', 'Um vídeo curto libera este baralho por 24 horas.', [
    { text: 'Agora não', style: 'cancel' },
    { text: 'Assistir', onPress: () => setTimeout(() => { setUnlocked((current) => [...current, id]); router.push(`/flashcards/${id}`); }, 800) },
  ]);
  return <View style={[styles.screen, { backgroundColor: theme.background }]}>
    <ContentHeader title="Flashcards" subtitle="Memorize com revisão espaçada" />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.statsGrid}>{[
        ['layers-outline', '24', 'Para revisar'], ['play-circle-outline', '138', 'Dominados'], ['flame-outline', '12d', 'Sequência'],
      ].map(([icon, value, label]) => <View key={label} style={[styles.statCard, { backgroundColor: theme.surface }]}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={theme.primary} /><Text style={[styles.statValue, { color: theme.text }]}>{value}</Text><Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text></View>)}</View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Seus baralhos</Text>
      <View style={styles.list}>{flashcardDecks.map((deck) => { const isUnlocked = !deck.premium || unlocked.includes(deck.id); return <Pressable key={deck.id} accessibilityRole="button" style={({ pressed }) => [styles.deck, { backgroundColor: theme.surface }, pressed && styles.pressed]} onPress={() => isUnlocked ? router.push(`/flashcards/${deck.id}`) : unlockWithAd(deck.id)}><View style={[styles.deckIcon, { backgroundColor: theme.primarySubtle }]}><Ionicons name="layers-outline" size={20} color={theme.primary} /></View><View style={styles.deckCopy}><Text style={[styles.deckTitle, { color: theme.text }]}>{deck.title}</Text><Text style={[styles.deckSubtitle, { color: theme.textMuted }]}>{deck.subject} · {deck.cards.length} cartões</Text></View>{isUnlocked ? <Ionicons name="play-circle-outline" size={18} color={theme.textMuted} /> : <View style={[styles.reward, { backgroundColor: theme.warningSubtle }]}><Ionicons name="gift-outline" size={13} color={theme.warning} /><Text style={[styles.rewardText, { color: theme.warning }]}>Ver vídeo</Text></View>}</Pressable>; })}</View>
      <AdPlaceholder />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { gap: spacing[4], padding: spacing[5], paddingBottom: spacing[12] }, statsGrid: { flexDirection: 'row', gap: spacing[2] }, statCard: { alignItems: 'center', borderRadius: radius.md, flex: 1, gap: 3, padding: spacing[3], shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 5 }, statValue: { fontSize: typography.size.md, fontWeight: typography.weight.bold }, statLabel: { fontSize: 10, textAlign: 'center' }, sectionTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, marginTop: spacing[2] }, list: { gap: spacing[2] }, deck: { alignItems: 'center', borderRadius: radius.md, flexDirection: 'row', gap: spacing[4], padding: spacing[4], shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 5 }, deckIcon: { alignItems: 'center', borderRadius: radius.sm, height: 40, justifyContent: 'center', width: 40 }, deckCopy: { flex: 1, gap: 2 }, deckTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.medium }, deckSubtitle: { fontSize: typography.size.xs }, reward: { alignItems: 'center', borderRadius: radius.pill, flexDirection: 'row', gap: 3, paddingHorizontal: spacing[2], paddingVertical: 6 }, rewardText: { fontSize: 10, fontWeight: typography.weight.semibold }, pressed: { opacity: 0.76 } });
