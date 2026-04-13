import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

interface ModulePlaceholderScreenProps {
  title: string;
  description: string;
}

export const ModulePlaceholderScreen: React.FC<ModulePlaceholderScreenProps> = ({
  title,
  description,
}) => {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Migracao em andamento</Text>
        <Text style={styles.cardText}>{description}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  cardText: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
});
