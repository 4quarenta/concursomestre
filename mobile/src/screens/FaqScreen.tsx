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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@/theme/colors';

/**
 * Dado estático de FAQ — espelho da plataforma web.
 * Atualizar aqui quando a base de conhecimento mudar.
 * @since v1.0.0
 */
const FAQ_DATA = [
  {
    category: 'Gamificacao e nivel',
    questions: [
      {
        q: 'Como ganho XP e subo de nivel?',
        a: 'O XP e conquistado resolvendo questoes: cada acerto concede 10 XP e cada erro 2 XP. Cada nivel exige 1000 XP para ser completado.',
      },
      {
        q: 'O que e o sistema de reputacao?',
        a: 'Sua reputacao cresce quando seus comentarios ajudam outros usuarios. Curtidas em respostas e colaboracoes relevantes aumentam esse indicador.',
      },
      {
        q: 'Qual a vantagem de ter um nivel alto?',
        a: 'Niveis mais altos refletem constancia, destravam conquistas e fortalecem sua posicao em rankings e experiencias futuras da plataforma.',
      },
    ],
  },
  {
    category: 'Assinaturas e reembolso',
    questions: [
      {
        q: 'Como funcionam os planos e a renovacao?',
        a: 'Os planos mensal, trimestral e anual podem ter renovacao automatica. A gestao fica disponivel na area de assinatura do perfil.',
      },
      {
        q: 'Tenho direito a reembolso?',
        a: 'Sim. O pedido pode ser feito dentro da janela legal prevista para arrependimento ou conforme as regras do fluxo de estorno exibidas na plataforma.',
      },
      {
        q: 'Como cancelo minha assinatura?',
        a: 'O cancelamento da recorrencia fica disponivel em Perfil > Assinatura. O acesso premium permanece ate o fim do periodo ja pago.',
      },
    ],
  },
  {
    category: 'Ferramentas de estudo',
    questions: [
      {
        q: 'O que e o Raio-X da banca?',
        a: 'E a analise estatistica que mostra recorrencia de temas, padrao de cobranca e dificuldade por banca examinadora.',
      },
      {
        q: 'Como funciona a mentoria por IA?',
        a: 'A IA cruza desempenho, historico e padroes de estudo para sugerir foco, sequencia e reforco de revisao.',
      },
      {
        q: 'O que sao os simulados ineditos?',
        a: 'Sao provas montadas para replicar estilo de edital e banca, com correcao, ranking e analise de desempenho.',
      },
    ],
  },
  {
    category: 'Marketplace de materiais',
    questions: [
      {
        q: 'Como acesso os materiais que comprei?',
        a: 'Os materiais ficam disponiveis na area do Marketplace e no seu historico de compras, com acesso ao arquivo e itens relacionados.',
      },
      {
        q: 'Quem cria os materiais do Marketplace?',
        a: 'Os materiais podem ser publicados por parceiros e autores validados, com fluxo de moderacao e controle administrativo.',
      },
    ],
  },
  {
    category: 'Indicacoes e bonus',
    questions: [
      {
        q: 'Como funciona o Indique e Ganhe?',
        a: 'Cada usuario possui um codigo ou link proprio. Quando um indicado se cadastra ou assina, a plataforma calcula os bonus previstos para a campanha ativa.',
      },
    ],
  },
  {
    category: 'Suporte e seguranca',
    questions: [
      {
        q: 'Como falar com o suporte tecnico?',
        a: 'Use a tela de suporte para abrir um chamado, enviar sugestoes ou relatar problemas. O historico fica centralizado por conversa.',
      },
      {
        q: 'Meus dados de pagamento estao seguros?',
        a: 'Sim. O processamento passa pelos gateways oficiais e a plataforma evita armazenar dados sensiveis completos de cartao.',
      },
    ],
  },
];

/**
 * Tela de FAQ mobile.
 * Exibe perguntas frequentes estáticas com busca local por termo
 * e accordion de abertura por item dentro de cada categoria.
 * Acessível via atalho no Dashboard e deep link concursomestre://faq.
 * @since v1.0.0
 */
export const FaqScreen: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  /**
   * Filtra categorias e perguntas de acordo com o termo digitado.
   * Mantém a categoria visível enquanto houver ao menos uma pergunta correspondente.
   * @since v1.0.0
   */
  const filtered = React.useMemo(() => {
    if (!searchTerm.trim()) return FAQ_DATA;
    const lower = searchTerm.toLowerCase();
    return FAQ_DATA.map((category) => ({
      ...category,
      questions: category.questions.filter(
        (item) =>
          item.q.toLowerCase().includes(lower) ||
          item.a.toLowerCase().includes(lower),
      ),
    })).filter((category) => category.questions.length > 0);
  }, [searchTerm]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Campo de busca */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquise por XP, reembolso, simulados..."
          placeholderTextColor={colors.muted}
          value={searchTerm}
          onChangeText={setSearchTerm}
          returnKeyType="search"
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Nenhum resultado encontrado</Text>
          <Text style={styles.emptyText}>
            Tente buscar por termos diferentes ou navegue pelas categorias.
          </Text>
        </View>
      ) : (
        filtered.map((category, categoryIndex) => (
          <View key={category.category} style={styles.categorySection}>
            {/* Cabeçalho da categoria */}
            <Text style={styles.categoryTitle}>{category.category.toUpperCase()}</Text>

            {/* Itens acordeão */}
            {category.questions.map((item, questionIndex) => {
              const itemKey = `${categoryIndex}-${questionIndex}`;
              const isOpen = openKey === itemKey;

              return (
                <View
                  key={itemKey}
                  style={[styles.accordionItem, isOpen && styles.accordionItemOpen]}
                >
                  <Pressable
                    onPress={() => setOpenKey(isOpen ? null : itemKey)}
                    style={styles.accordionHeader}
                  >
                    <Text
                      style={[
                        styles.accordionQuestion,
                        isOpen && styles.accordionQuestionOpen,
                      ]}
                    >
                      {item.q}
                    </Text>
                    <Text style={styles.accordionChevron}>
                      {isOpen ? '▲' : '▼'}
                    </Text>
                  </Pressable>

                  {isOpen ? (
                    <View style={styles.accordionBody}>
                      <Text style={styles.accordionAnswer}>{item.a}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))
      )}

      {/* Bloco de suporte ao final */}
      <View style={styles.supportCard}>
        <Text style={styles.supportEyebrow}>Ainda com duvidas?</Text>
        <Text style={styles.supportTitle}>Nosso suporte esta pronto para ajudar</Text>
        <Text style={styles.supportText}>
          Se voce nao encontrou a resposta que precisava, abra um chamado pela area de
          suporte e acompanhe tudo pelo historico da plataforma.
        </Text>
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
    gap: 16,
    paddingBottom: 32,
  },
  searchContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  searchInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  categorySection: {
    gap: 8,
  },
  categoryTitle: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  accordionItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  accordionItemOpen: {
    borderColor: colors.primary,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 10,
  },
  accordionQuestion: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  accordionQuestionOpen: {
    color: colors.primary,
  },
  accordionChevron: {
    color: colors.muted,
    fontSize: 10,
    flexShrink: 0,
  },
  accordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  accordionAnswer: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  supportCard: {
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    padding: 20,
    gap: 8,
    marginTop: 4,
  },
  supportEyebrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  supportTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
  },
  supportText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
});
