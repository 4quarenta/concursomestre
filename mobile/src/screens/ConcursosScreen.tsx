import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';

type ConcursoCard = {
  id: string;
  title: string;
  banca: string;
  orgao: string;
  cargo: string;
  ano: string;
};

const buildFallbackCards = (
  agencies: string[],
  roles: string[],
  years: string[],
): ConcursoCard[] => {
  const safeAgencies = agencies.slice(0, 8);
  const safeRoles = roles.slice(0, 8);
  const safeYears = years.slice(0, 6);

  const cards: ConcursoCard[] = [];

  safeAgencies.forEach((agency, agencyIndex) => {
    const role = safeRoles[agencyIndex % Math.max(1, safeRoles.length)] || 'Cargo geral';
    const year = safeYears[agencyIndex % Math.max(1, safeYears.length)] || '2026';
    cards.push({
      id: `${agency}-${role}-${year}`.toLowerCase().replace(/\s+/g, '-'),
      title: `${role} - ${agency}`,
      banca: agency,
      orgao: agency,
      cargo: role,
      ano: year,
    });
  });

  return cards;
};

/**
 * Catalogo inicial de concursos no mobile.
 * Reaproveita as taxonomias do bootstrap global para manter paridade com o modulo web.
 * @since v1.0.0
 */
export const ConcursosScreen: React.FC = () => {
  const { systemSettings } = useAuth();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedYear, setSelectedYear] = React.useState('Todos');

  const agencies = React.useMemo(
    () => systemSettings.taxonomies.agencies.map((item) => item.name).filter(Boolean),
    [systemSettings.taxonomies.agencies],
  );

  const roles = React.useMemo(
    () => systemSettings.taxonomies.roles.map((item) => item.name).filter(Boolean),
    [systemSettings.taxonomies.roles],
  );

  const years = React.useMemo(
    () => systemSettings.taxonomies.years.filter(Boolean),
    [systemSettings.taxonomies.years],
  );

  const concursos = React.useMemo(
    () => buildFallbackCards(agencies, roles, years),
    [agencies, roles, years],
  );

  const filteredConcursos = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return concursos.filter((concurso) => {
      const matchesYear = selectedYear === 'Todos' || concurso.ano === selectedYear;
      const matchesSearch = !normalizedSearch || [
        concurso.title,
        concurso.banca,
        concurso.orgao,
        concurso.cargo,
      ].some((value) => value.toLowerCase().includes(normalizedSearch));

      return matchesYear && matchesSearch;
    });
  }, [concursos, searchTerm, selectedYear]);

  const yearOptions = React.useMemo(
    () => ['Todos', ...years],
    [years],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Catalogo de oportunidades</Text>
        <Text style={styles.heroTitle}>Concursos</Text>
        <Text style={styles.heroText}>
          Explore bancas, cargos e periodos em um catalogo inicial alinhado com a plataforma.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>Bancas</Text>
          <Text style={styles.statValue}>{agencies.length}</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>Cargos</Text>
          <Text style={styles.statValue}>{roles.length}</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>Anos</Text>
          <Text style={styles.statValue}>{years.length}</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>Catalogados</Text>
          <Text style={styles.statValue}>{concursos.length}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Filtrar concursos</Text>
        <TextInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Buscar por banca, orgao ou cargo..."
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearChipsRow}>
          {yearOptions.map((year) => {
            const active = selectedYear === year;
            return (
              <Pressable
                key={year}
                onPress={() => setSelectedYear(year)}
                style={[styles.yearChip, active && styles.yearChipActive]}
              >
                <Text style={[styles.yearChipText, active && styles.yearChipTextActive]}>
                  {year}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Resultados ({filteredConcursos.length})</Text>
        {filteredConcursos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum concurso encontrado.</Text>
            <Text style={styles.emptyText}>
              Ajuste busca ou ano para explorar outras combinacoes.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredConcursos.map((concurso) => (
              <View key={concurso.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{concurso.title}</Text>
                <View style={styles.metaGrid}>
                  <Text style={styles.metaText}>Orgao: {concurso.orgao}</Text>
                  <Text style={styles.metaText}>Banca: {concurso.banca}</Text>
                  <Text style={styles.metaText}>Cargo: {concurso.cargo}</Text>
                  <Text style={styles.metaText}>Ano: {concurso.ano}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
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
    padding: 12,
    gap: 10,
    paddingBottom: 24,
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    padding: 14,
    gap: 6,
  },
  heroEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statPill: {
    minWidth: '23%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 10,
    gap: 2,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  yearChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  yearChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  yearChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  yearChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  yearChipTextActive: {
    color: colors.primary,
  },
  list: {
    gap: 8,
  },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 8,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  metaGrid: {
    gap: 4,
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    padding: 14,
    gap: 4,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});

export default ConcursosScreen;
