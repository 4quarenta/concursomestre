import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@/theme/colors';
import type { QuestionNote } from '@/types/notes';

type QuestionNotePanelProps = {
  note?: QuestionNote | null;
  draft: string;
  loading?: boolean;
  saving?: boolean;
  onChangeDraft: (value: string) => void;
  onSave: () => Promise<void> | void;
  onClear: () => Promise<void> | void;
};

const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return 'Ainda sem anotacao';

  try {
    return new Date(timestamp).toLocaleString('pt-BR');
  } catch {
    return 'Anotacao recente';
  }
};

export const QuestionNotePanel: React.FC<QuestionNotePanelProps> = ({
  note,
  draft,
  loading = false,
  saving = false,
  onChangeDraft,
  onSave,
  onClear,
}) => {
  const trimmedDraft = draft.trim();

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Minha anotacao</Text>
          <Text style={styles.meta}>{formatTimestamp(note?.timestamp)}</Text>
        </View>
        {note?.source ? (
          <View style={[styles.sourceBadge, note.source === 'remote' && styles.sourceBadgeRemote]}>
            <Text style={[styles.sourceBadgeText, note.source === 'remote' && styles.sourceBadgeTextRemote]}>
              {note.source === 'remote' ? 'Historico' : 'Local'}
            </Text>
          </View>
        ) : null}
      </View>

      <TextInput
        value={draft}
        onChangeText={onChangeDraft}
        placeholder="Escreva sua nota desta questao"
        placeholderTextColor={colors.muted}
        multiline
        style={styles.input}
      />

      <Text style={styles.helperText}>
        Novas edicoes ficam salvas neste app enquanto a API oficial de escrita nao for exposta.
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={() => void onSave()}
          disabled={saving || trimmedDraft.length === 0}
          style={[styles.primaryButton, (saving || trimmedDraft.length === 0) && styles.buttonDisabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Salvar anotacao</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => void onClear()}
          disabled={saving || (!note && trimmedDraft.length === 0)}
          style={[styles.secondaryButton, (saving || (!note && trimmedDraft.length === 0)) && styles.buttonDisabled]}
        >
          <Text style={styles.secondaryButtonText}>Limpar</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando anotacoes</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: '#FFFBEB',
    padding: 12,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  meta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  sourceBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7',
  },
  sourceBadgeRemote: {
    backgroundColor: '#DBEAFE',
  },
  sourceBadgeText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  sourceBadgeTextRemote: {
    color: '#1D4ED8',
  },
  input: {
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  helperText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  secondaryButton: {
    minWidth: 96,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
});

export default QuestionNotePanel;
