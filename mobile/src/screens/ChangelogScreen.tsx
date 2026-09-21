/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { changelogService } from '@/services/changelog/changelogService';
import { colors } from '@/theme/colors';
import type { ChangelogVersion } from '@/types/changelog';

/**
 * Tela de Changelog mobile.
 * Exibe as versões publicadas da plataforma com seletor lateral e
 * painel de categorias/itens de cada release.
 * Acessível via atalho no Dashboard e deep link concursomestre://changelog.
 * @since v1.0.0
 */
export const ChangelogScreen: React.FC = () => {
  const [versions, setVersions] = React.useState<ChangelogVersion[]>([]);
  const [selected, setSelected] = React.useState<ChangelogVersion | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Carrega versões do endpoint e seleciona a mais recente por padrão.
   * @since v1.0.0
   */
  const loadVersions = React.useCallback(async (useRefresh = false) => {
    if (useRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await changelogService.listVersions();
      setVersions(data);
      setSelected((prev) => {
        if (prev) {
          const found = data.find((item) => item.id === prev.id);
          return found ?? data[0] ?? null;
        }
        return data[0] ?? null;
      });
    } catch {
      setError('Nao foi possivel carregar o changelog agora.');
    } finally {
      if (useRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadVersions(false);
    }, [loadVersions]),
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => void loadVersions(false)}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  if (versions.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.emptyTitle}>Nenhuma versao publicada ainda.</Text>
        <Text style={styles.emptyText}>
          O changelog sera exibido aqui quando houver versoes disponíveis.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Seletor de versoes */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.versionBar}
      >
        {versions.map((version) => (
          <Pressable
            key={String(version.id)}
            onPress={() => setSelected(version)}
            style={[
              styles.versionChip,
              selected?.id === version.id && styles.versionChipActive,
            ]}
          >
            <Text
              style={[
                styles.versionChipText,
                selected?.id === version.id && styles.versionChipTextActive,
              ]}
            >
              v{version.version}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Detalhe da versão selecionada */}
      <ScrollView
        style={styles.detail}
        contentContainerStyle={styles.detailContent}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadVersions(true)}
            tintColor={colors.primary}
          />
        )}
      >
        {selected && (
          <>
            {/* Cabeçalho da versão */}
            <View style={styles.versionHeader}>
              <View style={styles.versionBadges}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>v{selected.version}</Text>
                </View>
                <Text style={styles.releaseDateText}>
                  {new Date(selected.release_date).toLocaleDateString('pt-BR')}
                </Text>
              </View>
              <Text style={styles.versionTitle}>{selected.title}</Text>
              <Text style={styles.versionDescription}>{selected.description}</Text>
            </View>

            {/* Categorias de itens */}
            {selected.content_json.map((category, categoryIndex) => (
              <View
                /* eslint-disable-next-line react/no-array-index-key */
                key={`${selected.id}-${categoryIndex}`}
                style={styles.categoryCard}
              >
                <Text style={styles.categoryTitle}>{category.title}</Text>
                {category.items.map((item, itemIndex) => (
                  /* eslint-disable-next-line react/no-array-index-key */
                  <View key={`${selected.id}-${categoryIndex}-${itemIndex}`} style={styles.itemRow}>
                    <View style={styles.itemDot} />
                    <Text style={styles.itemText}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  versionBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  versionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  versionChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  versionChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  versionChipTextActive: {
    color: colors.primary,
  },
  detail: {
    flex: 1,
  },
  detailContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 32,
  },
  versionHeader: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    gap: 10,
  },
  versionBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  badgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  releaseDateText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  versionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
  },
  versionDescription: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  categoryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 10,
  },
  categoryTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#10B981',
    marginTop: 5,
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
});
