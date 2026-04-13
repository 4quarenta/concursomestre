import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '@/navigation/types';
import { questionService } from '@/services/questions/questionService';
import { colors } from '@/theme/colors';
import type { Question } from '@/types/questions';

const QUESTION_COUNT_OPTIONS = [10, 20, 30];
const TIMER_MINUTES_OPTIONS = [10, 20, 30, 45, 60];

const shuffleQuestions = (rows: Question[]): Question[] => {
  const next = [...rows];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = temp;
  }
  return next;
};

/**
 * Tela de configuracao de simulado mobile.
 * @since v1.0.0
 */
export const SimulationConfigScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [questionCount, setQuestionCount] = React.useState(10);
  const [timerEnabled, setTimerEnabled] = React.useState(true);
  const [timerMinutes, setTimerMinutes] = React.useState(20);
  const [starting, setStarting] = React.useState(false);

  const handleStartSimulation = async () => {
    setStarting(true);
    try {
      const result = await questionService.getQuestionPage({
        page: 1,
        perPage: Math.max(questionCount * 2, questionCount),
      });

      const randomized = shuffleQuestions(result.rows || []);
      const selected = randomized.slice(0, questionCount);
      if (selected.length === 0) {
        Alert.alert('Sem questoes', 'Nao encontramos questoes para iniciar o simulado.');
        return;
      }

      navigation.replace('SimulationRun', {
        seed: {
          config: {
            questionCount: selected.length,
            timerEnabled,
            timerMinutes,
          },
          questions: selected,
          startedAt: Date.now(),
        },
      });
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel iniciar o simulado.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Simulados</Text>
        <Text style={styles.title}>Novo simulado</Text>
        <Text style={styles.description}>Configure quantidade de questoes e tempo antes de iniciar.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quantidade de questoes</Text>
        <View style={styles.optionsRow}>
          {QUESTION_COUNT_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setQuestionCount(option)}
              style={[styles.optionChip, questionCount === option && styles.optionChipActive]}
            >
              <Text style={[styles.optionChipText, questionCount === option && styles.optionChipTextActive]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchTextBlock}>
            <Text style={styles.cardTitle}>Timer</Text>
            <Text style={styles.switchDescription}>
              Ative para finalizar automaticamente quando o tempo acabar.
            </Text>
          </View>
          <Switch
            value={timerEnabled}
            onValueChange={setTimerEnabled}
            trackColor={{ false: '#CBD5E1', true: '#A5B4FC' }}
            thumbColor={timerEnabled ? colors.primary : '#FFFFFF'}
          />
        </View>

        {timerEnabled && (
          <View style={styles.optionsRow}>
            {TIMER_MINUTES_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setTimerMinutes(option)}
                style={[styles.optionChip, timerMinutes === option && styles.optionChipActive]}
              >
                <Text style={[styles.optionChipText, timerMinutes === option && styles.optionChipTextActive]}>
                  {option} min
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Pressable
        style={[styles.mainButton, starting && styles.mainButtonDisabled]}
        onPress={() => void handleStartSimulation()}
        disabled={starting}
      >
        {starting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.mainButtonText}>Iniciar simulado</Text>
        )}
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 12,
    gap: 10,
    paddingBottom: 20,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.card,
    gap: 6,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.card,
    gap: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  optionChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  optionChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  optionChipTextActive: {
    color: colors.primary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  switchTextBlock: {
    flex: 1,
    gap: 3,
  },
  switchDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  mainButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonDisabled: {
    opacity: 0.7,
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});

export default SimulationConfigScreen;
