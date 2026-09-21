import React from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { QuestionTaxonomyOption } from '@/features/questions/api/taxonomyService';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

type Props = {
  label: string;
  values: string[];
  options: QuestionTaxonomyOption[];
  loading?: boolean;
  onChange: (values: string[]) => void;
};

const optionLabel = (option: QuestionTaxonomyOption) => (
  option.sigla ? `${option.sigla} — ${option.nome}` : option.nome
);

export const TaxonomyMultiPickerField: React.FC<Props> = ({
  label,
  values,
  options,
  loading = false,
  onChange,
}) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [visible, setVisible] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [draft, setDraft] = React.useState<string[]>(values);

  React.useEffect(() => {
    if (!visible) setDraft(values);
  }, [values, visible]);

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    if (!needle) return options;
    return options.filter((option) => optionLabel(option).toLocaleLowerCase('pt-BR').includes(needle));
  }, [options, search]);

  const open = () => {
    setDraft(values);
    setVisible(true);
  };

  const close = () => {
    setSearch('');
    setVisible(false);
  };

  const toggle = (value: string) => {
    setDraft((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  };

  return (
    <>
      <Pressable accessibilityRole="button" onPress={open} style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <Text numberOfLines={1} style={[styles.value, values.length === 0 && styles.placeholder]}>
          {loading ? 'Carregando...' : values.length === 0 ? 'Todos' : values.length === 1 ? values[0] : `${values.length} selecionados`}
        </Text>
      </Pressable>

      <Modal animationType="slide" presentationStyle="pageSheet" visible={visible} onRequestClose={close}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{label}</Text>
              <Text style={styles.subtitle}>Selecione uma ou mais opcoes.</Text>
            </View>
            <Pressable onPress={close}><Text style={styles.link}>Cancelar</Text></Pressable>
          </View>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder={`Buscar ${label.toLocaleLowerCase('pt-BR')}`}
            placeholderTextColor={theme.textSubtle}
            style={styles.search}
            value={search}
          />

          <FlatList
            contentContainerStyle={styles.list}
            data={filtered}
            keyExtractor={(item, index) => String(item.id ?? item.slug ?? `${item.nome}-${index}`)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>Nenhuma opcao encontrada.</Text>}
            renderItem={({ item }) => {
              const selected = draft.includes(item.nome);
              return (
                <Pressable onPress={() => toggle(item.nome)} style={[styles.option, selected && styles.optionSelected]}>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    <Text style={[styles.checkmark, selected && styles.checkmarkSelected]}>{selected ? '✓' : ''}</Text>
                  </View>
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{optionLabel(item)}</Text>
                </Pressable>
              );
            }}
          />

          <View style={styles.footer}>
            <Pressable onPress={() => setDraft([])} style={styles.clearButton}>
              <Text style={styles.clearText}>Limpar</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onChange(draft);
                close();
              }}
              style={styles.confirmButton}
            >
              <Text style={styles.confirmText}>Aplicar ({draft.length})</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  field: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, flexBasis: '48%', flexGrow: 1, gap: spacing[1], minHeight: 58, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  label: { color: theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  value: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  placeholder: { color: theme.textSubtle },
  modalRoot: { backgroundColor: theme.background, flex: 1 },
  header: { alignItems: 'flex-start', borderBottomColor: theme.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between', padding: spacing[4] },
  headerText: { flex: 1, gap: spacing[1] },
  title: { color: theme.text, fontSize: typography.size.xl, fontWeight: typography.weight.bold },
  subtitle: { color: theme.textMuted, fontSize: typography.size.xs },
  link: { color: theme.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold, paddingVertical: spacing[2] },
  search: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, color: theme.text, margin: spacing[4], minHeight: 48, paddingHorizontal: spacing[3] },
  list: { gap: spacing[2], paddingBottom: spacing[8], paddingHorizontal: spacing[4] },
  option: { alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing[3], minHeight: 48, padding: spacing[3] },
  optionSelected: { backgroundColor: theme.primarySubtle, borderColor: theme.primaryBorder },
  checkbox: { alignItems: 'center', borderColor: theme.borderStrong, borderRadius: radius.sm, borderWidth: 1, height: 22, justifyContent: 'center', width: 22 },
  checkboxSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  checkmark: { color: theme.surface, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  checkmarkSelected: { color: theme.onPrimary },
  optionText: { color: theme.text, flex: 1, fontSize: typography.size.sm },
  optionTextSelected: { color: theme.primary, fontWeight: typography.weight.semibold },
  empty: { color: theme.textMuted, paddingVertical: spacing[6], textAlign: 'center' },
  footer: { alignItems: 'center', borderTopColor: theme.border, borderTopWidth: 1, flexDirection: 'row', gap: spacing[3], padding: spacing[4] },
  clearButton: { paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  clearText: { color: theme.danger, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  confirmButton: { alignItems: 'center', backgroundColor: theme.primary, borderRadius: radius.md, flex: 1, minHeight: 46, justifyContent: 'center', paddingHorizontal: spacing[4] },
  confirmText: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
});

export default TaxonomyMultiPickerField;
