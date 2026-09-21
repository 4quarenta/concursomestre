import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/theme/colors';

type QuestionInsightPanelProps = {
  title: string;
  content?: string | null;
  emptyText: string;
  variant?: 'teacher' | 'detailed';
};

const normalizeInsightText = (value?: string | null): string => (
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
);

export const QuestionInsightPanel: React.FC<QuestionInsightPanelProps> = ({
  title,
  content,
  emptyText,
  variant = 'teacher',
}) => {
  const normalizedContent = normalizeInsightText(content);
  const isTeacher = variant === 'teacher';

  return (
    <View style={[styles.panel, isTeacher ? styles.panelTeacher : styles.panelDetailed]}>
      <View style={styles.header}>
        <Text style={[styles.title, isTeacher ? styles.titleTeacher : styles.titleDetailed]}>{title}</Text>
      </View>

      {normalizedContent ? (
        <View style={[styles.contentCard, isTeacher ? styles.contentCardTeacher : styles.contentCardDetailed]}>
          <Text style={styles.contentText}>{normalizedContent}</Text>
        </View>
      ) : (
        <View style={[styles.emptyCard, isTeacher ? styles.emptyCardTeacher : styles.emptyCardDetailed]}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  panelTeacher: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  panelDetailed: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySubtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  titleTeacher: {
    color: '#B45309',
  },
  titleDetailed: {
    color: colors.primary,
  },
  contentCard: {
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  contentCardTeacher: {
    borderColor: '#FDE68A',
  },
  contentCardDetailed: {
    borderColor: colors.primaryBorder,
  },
  contentText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  emptyCardTeacher: {
    borderColor: '#FDE68A',
    borderStyle: 'dashed',
  },
  emptyCardDetailed: {
    borderColor: colors.primaryBorder,
    borderStyle: 'dashed',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
});

export default QuestionInsightPanel;
