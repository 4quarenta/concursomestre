import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { useQuestionTaxonomiesQuery } from '@/features/questions/api/useQuestionTaxonomiesQuery';
import type { QuestionTaxonomyOption } from '@/features/questions/api/taxonomyService';
import { buildSimulationSeed } from '@/features/simulations/api/simulationQuestionPool';
import { TaxonomyMultiPickerField } from '@/features/simulations/components/TaxonomyMultiPickerField';
import {
  simulationConfigSchema,
  type SimulationConfigFormValues,
} from '@/features/simulations/schemas/simulationConfigSchema';
import { useSimulationRunStore } from '@/state/simulationRunStore';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

const QUESTION_COUNT_OPTIONS = [10, 20, 30];
const TIMER_OPTIONS = [10, 20, 30, 45, 60];

const difficultyOptions: Array<{ value: SimulationConfigFormValues['difficulty']; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'easy', label: 'Faceis' },
  { value: 'medium', label: 'Medias' },
  { value: 'hard', label: 'Dificeis' },
];

const feedbackOptions: Array<{ value: SimulationConfigFormValues['feedbackMode']; label: string }> = [
  { value: 'after_all', label: 'Resultado no final' },
  { value: 'instant', label: 'Feedback imediato' },
];

export const SimulationConfigScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const taxonomiesQuery = useQuestionTaxonomiesQuery();
  const setSeed = useSimulationRunStore((state) => state.setSeed);
  const [starting, setStarting] = React.useState(false);

  const { watch, setValue, handleSubmit } = useForm<SimulationConfigFormValues>({
    defaultValues: {
      questionCount: 10,
      timerEnabled: true,
      timerMinutes: 20,
      keyword: '',
      difficulty: 'all',
      feedbackMode: 'after_all',
      subjects: [],
      agencies: [],
      years: [],
      organizations: [],
      roles: [],
      topics: [],
    },
  });

  const values = watch();
  const taxonomies = taxonomiesQuery.data;
  const yearOptions = React.useMemo<QuestionTaxonomyOption[]>(
    () => (taxonomies?.anos || []).map((year) => ({ nome: year, id: year })),
    [taxonomies?.anos],
  );

  const start = handleSubmit(async (formValues) => {
    const parsed = simulationConfigSchema.safeParse(formValues);
    if (!parsed.success) {
      Alert.alert('Configuracao invalida', parsed.error.issues[0]?.message || 'Revise os dados do simulado.');
      return;
    }

    setStarting(true);
    try {
      const seed = await buildSimulationSeed({
        ...parsed.data,
        keyword: parsed.data.keyword?.trim() || undefined,
      });
      setSeed({
        ...seed,
        id: `sim-mobile-${seed.startedAt}-${Math.random().toString(36).slice(2, 8)}`,
      });
      router.replace('/simulados/executar');
    } catch (error: any) {
      Alert.alert('Simulado', error?.message || 'Nao foi possivel montar o simulado.');
    } finally {
      setStarting(false);
    }
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Simulados</Text>
        <Text style={styles.title}>Novo simulado</Text>
        <Text style={styles.description}>
          A prova e montada pelo servidor a partir dos filtros escolhidos. O app recebe apenas um conjunto limitado de questoes.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quantidade de questoes</Text>
        <View style={styles.chips}>
          {QUESTION_COUNT_OPTIONS.map((option) => {
            const active = values.questionCount === option;
            return (
              <Pressable key={option} onPress={() => setValue('questionCount', option)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Filtros da prova</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(value) => setValue('keyword', value)}
          placeholder="Palavra-chave no enunciado"
          placeholderTextColor={theme.textSubtle}
          style={styles.input}
          value={values.keyword || ''}
        />

        <Text style={styles.fieldLabel}>Dificuldade</Text>
        <View style={styles.chips}>
          {difficultyOptions.map((option) => {
            const active = values.difficulty === option.value;
            return (
              <Pressable key={option.value} onPress={() => setValue('difficulty', option.value)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.pickerGrid}>
          <TaxonomyMultiPickerField label="Materias" values={values.subjects} options={taxonomies?.materias || []} loading={taxonomiesQuery.isLoading} onChange={(next) => setValue('subjects', next)} />
          <TaxonomyMultiPickerField label="Assuntos" values={values.topics} options={taxonomies?.assuntos || []} loading={taxonomiesQuery.isLoading} onChange={(next) => setValue('topics', next)} />
          <TaxonomyMultiPickerField label="Bancas" values={values.agencies} options={taxonomies?.bancas || []} loading={taxonomiesQuery.isLoading} onChange={(next) => setValue('agencies', next)} />
          <TaxonomyMultiPickerField label="Orgaos" values={values.organizations} options={taxonomies?.orgaos || []} loading={taxonomiesQuery.isLoading} onChange={(next) => setValue('organizations', next)} />
          <TaxonomyMultiPickerField label="Cargos" values={values.roles} options={taxonomies?.cargos || []} loading={taxonomiesQuery.isLoading} onChange={(next) => setValue('roles', next)} />
          <TaxonomyMultiPickerField label="Anos" values={values.years} options={yearOptions} loading={taxonomiesQuery.isLoading} onChange={(next) => setValue('years', next)} />
        </View>

        {taxonomiesQuery.isError ? (
          <Pressable onPress={() => void taxonomiesQuery.refetch()} style={styles.warningCard}>
            <Text style={styles.warningText}>Nao foi possivel carregar as taxonomias. Toque para tentar novamente.</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.cardTitle}>Cronometro</Text>
            <Text style={styles.helper}>O tempo continua contando se o app for fechado.</Text>
          </View>
          <Switch
            value={values.timerEnabled}
            onValueChange={(value) => setValue('timerEnabled', value)}
            trackColor={{ true: theme.primary }}
          />
        </View>

        {values.timerEnabled ? (
          <View style={styles.chips}>
            {TIMER_OPTIONS.map((option) => {
              const active = values.timerMinutes === option;
              return (
                <Pressable key={option} onPress={() => setValue('timerMinutes', option)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option} min</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Correcao</Text>
        <View style={styles.stackOptions}>
          {feedbackOptions.map((option) => {
            const active = values.feedbackMode === option.value;
            return (
              <Pressable key={option.value} onPress={() => setValue('feedbackMode', option.value)} style={[styles.feedbackOption, active && styles.feedbackOptionActive]}>
                <Text style={[styles.feedbackTitle, active && styles.chipTextActive]}>{option.label}</Text>
                <Text style={styles.helper}>
                  {option.value === 'after_all'
                    ? 'O gabarito so aparece depois da finalizacao.'
                    : 'Cada resposta e validada no servidor assim que for marcada.'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable disabled={starting} onPress={() => void start()} style={[styles.startButton, starting && styles.disabled]}>
        {starting ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={styles.startButtonText}>Iniciar simulado</Text>}
      </Pressable>
    </ScrollView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  content: { gap: spacing[4], padding: spacing[4], paddingBottom: spacing[10] },
  headerCard: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing[2], padding: spacing[4] },
  eyebrow: { color: theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.extrabold, textTransform: 'uppercase' },
  title: { color: theme.text, fontSize: typography.size['2xl'], fontWeight: typography.weight.black },
  description: { color: theme.textMuted, fontSize: typography.size.sm, lineHeight: 20 },
  card: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing[3], padding: spacing[4] },
  cardTitle: { color: theme.text, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  fieldLabel: { color: theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  input: { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, color: theme.text, minHeight: 48, paddingHorizontal: spacing[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  chipActive: { backgroundColor: theme.primarySubtle, borderColor: theme.primaryBorder },
  chipText: { color: theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  chipTextActive: { color: theme.primary },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  switchRow: { alignItems: 'center', flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between' },
  switchText: { flex: 1, gap: spacing[1] },
  helper: { color: theme.textMuted, fontSize: typography.size.xs, lineHeight: 17 },
  stackOptions: { gap: spacing[2] },
  feedbackOption: { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, gap: spacing[1], padding: spacing[3] },
  feedbackOptionActive: { backgroundColor: theme.primarySubtle, borderColor: theme.primaryBorder },
  feedbackTitle: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  warningCard: { backgroundColor: theme.warningSubtle, borderRadius: radius.md, padding: spacing[3] },
  warningText: { color: theme.warning, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  startButton: { alignItems: 'center', backgroundColor: theme.primary, borderRadius: radius.lg, justifyContent: 'center', minHeight: 52, paddingHorizontal: spacing[4] },
  startButtonText: { color: theme.onPrimary, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  disabled: { opacity: 0.55 },
});

export default SimulationConfigScreen;
