import React from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { QuestionTaxonomyOption } from '@/features/questions/api/taxonomyService';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

type TaxonomyPickerFieldProps = {
  label: string;
  value?: string;
  options: QuestionTaxonomyOption[];
  loading?: boolean;
  onChange: (value?: string) => void;
};

const getLabel = (option: QuestionTaxonomyOption): string => (
  option.sigla ? `${option.sigla} — ${option.nome}` : option.nome
);

export const TaxonomyPickerField: React.FC<TaxonomyPickerFieldProps> = ({
  label,
  value,
  options,
  loading = false,
  onChange,
}) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [visible, setVisible] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const filteredOptions = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    if (!needle) return options;

    return options.filter((option) => (
      getLabel(option).toLocaleLowerCase('pt-BR').includes(needle)
    ));
  }, [options, search]);

  const close = React.useCallback(() => {
    setVisible(false);
    setSearch('');
  }, []);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Filtrar por ${label}`}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Text style={styles.label}>{label}</Text>
        <Text numberOfLines={1} style={[styles.value, !value && styles.placeholder]}>
          {value || (loading ? 'Carregando...' : 'Todos')}
        </Text>
      </Pressable>

      <Modal animationType="slide" onRequestClose={close} presentationStyle="pageSheet" visible={visible}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleBlock}>
              <Text style={styles.modalTitle}>{label}</Text>
              <Text style={styles.modalSubtitle}>Selecione uma opcao para filtrar no servidor.</Text>
            </View>
            <Pressable onPress={close} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Text style={styles.closeText}>Fechar</Text>
            </Pressable>
          </View>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder={`Buscar ${label.toLocaleLowerCase('pt-BR')}`}
            placeholderTextColor={theme.textSubtle}
            style={styles.searchInput}
            value={search}
          />

          <FlatList
            contentContainerStyle={styles.listContent}
            data={filteredOptions}
            keyExtractor={(item, index) => String(item.id ?? item.slug ?? `${item.nome}-${index}`)}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={(
              <Pressable
                onPress={() => {
                  onChange(undefined);
                  close();
                }}
                style={({ pressed }) => [styles.option, !value && styles.optionActive, pressed && styles.pressed]}
              >
                <Text style={[styles.optionText, !value && styles.optionTextActive]}>Todos</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma opcao encontrada.</Text>}
            renderItem={({ item }) => {
              const optionValue = item.nome;
              const active = value === optionValue;
              return (
                <Pressable
                  onPress={() => {
                    onChange(optionValue);
                    close();
                  }}
                  style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{getLabel(item)}</Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  field: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: spacing[1],
    minHeight: 58,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  label: {
    color: theme.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  value: {
    color: theme.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  placeholder: {
    color: theme.textSubtle,
  },
  modalRoot: {
    backgroundColor: theme.background,
    flex: 1,
  },
  modalHeader: {
    alignItems: 'flex-start',
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
    padding: spacing[4],
  },
  modalTitleBlock: {
    flex: 1,
    gap: spacing[1],
  },
  modalTitle: {
    color: theme.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },
  modalSubtitle: {
    color: theme.textMuted,
    fontSize: typography.size.xs,
  },
  closeButton: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  closeText: {
    color: theme.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  searchInput: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: theme.text,
    margin: spacing[4],
    minHeight: 48,
    paddingHorizontal: spacing[3],
  },
  listContent: {
    gap: spacing[2],
    paddingBottom: spacing[8],
    paddingHorizontal: spacing[4],
  },
  option: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  optionActive: {
    backgroundColor: theme.primarySubtle,
    borderColor: theme.primaryBorder,
  },
  optionText: {
    color: theme.text,
    fontSize: typography.size.sm,
  },
  optionTextActive: {
    color: theme.primary,
    fontWeight: typography.weight.semibold,
  },
  emptyText: {
    color: theme.textMuted,
    paddingVertical: spacing[6],
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});

export default TaxonomyPickerField;
