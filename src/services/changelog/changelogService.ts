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

import { apiClient, ENDPOINTS, readApiData } from '@services/api';

export type ChangelogCategory = {
  title: string;
  icon: string;
  items: string[];
};

export type ChangelogVersion = {
  id: number;
  version: string;
  release_date: string;
  title: string;
  description: string;
  content_json: ChangelogCategory[];
};

type ChangelogListPayload = {
  versions?: ChangelogVersion[];
};

const CHANGELOG_DEV_MARKER_PATTERN = /(?:\[\s*dev\s*\]|\(\s*dev\s*\)|\bdev\b)/i;

const BASELINE_1_0_0_CHANGELOG: ChangelogVersion = {
  id: 100000,
  version: '1.0.0',
  release_date: '2026-06-05',
  title: 'ConcursoMestre 1.0.0',
  description: 'Baseline publica da plataforma com pratica de questoes, simulados, lei comentada, marketplace, suporte, assinaturas, gamificacao e painel administrativo operacional.',
  content_json: [
    {
      title: 'Estudo e pratica',
      icon: 'BookOpen',
      items: [
        'Banco de questoes com filtros por materia, assunto, banca, orgao, cargo, ano, prova, dificuldade e historico de acerto.',
        'Comentarios do professor, analise detalhada e suporte a feedback editorial nas questoes.',
        'Simulados em modo lista ou foco, com revisao, tempo, desempenho e ranking pos-prova separado.',
        'Lei comentada com leitura, destaques, progresso, comentarios e solicitacao de explicacao por dispositivo.',
      ],
    },
    {
      title: 'Analise e desempenho',
      icon: 'BarChart2',
      items: [
        'Dashboard com evolucao de desempenho, sequencia semanal, materias e estatisticas de estudo.',
        'Raio-X da banca com leitura por materia, assuntos recorrentes, dificuldade, contexto e recomendacao estrategica.',
        'Ranking de XP e nivel do usuario separado dos rankings pos-prova.',
        'Historico de respostas, anotacoes e questoes salvas no perfil do aluno.',
      ],
    },
    {
      title: 'Comunidade e suporte',
      icon: 'Trophy',
      items: [
        'Suporte com categorias de problema, sugestao e ajuda.',
        'Sugestoes publicas dos alunos com votos de like e dislike.',
        'Comentarios em questoes com perfil, plano, foto e moderacao.',
        'Avaliacoes da plataforma separadas de sugestoes no painel administrativo.',
      ],
    },
    {
      title: 'Conta e operacao',
      icon: 'Shield',
      items: [
        'Perfil com dados pessoais, privacidade, preferencias, seguranca, assinatura e historico financeiro.',
        'Checkout e assinaturas com Stripe, cartoes salvos, renovacao, cancelamento e auditoria operacional.',
        'Painel admin para configuracoes, taxonomias, provas, importador, usuarios, suporte, email, cache e financeiro.',
        'Paginas publicas de FAQ, termos, privacidade, changelog, planos e landing comercial.',
      ],
    },
  ],
};

const hasPrivateDevMarker = (value: unknown): boolean => {
  return CHANGELOG_DEV_MARKER_PATTERN.test(String(value ?? ''));
};

const sanitizePublicChangelogVersion = (version: ChangelogVersion): ChangelogVersion | null => {
  if (!version || typeof version !== 'object') {
    return null;
  }

  const text = `${version.version} ${version.title} ${version.description}`;
  if (hasPrivateDevMarker(text)) {
    return null;
  }

  const contentJson = Array.isArray(version.content_json) ? version.content_json : [];
  const content_json = contentJson
    .filter((category) => !hasPrivateDevMarker(`${category.title} ${category.icon}`))
    .map((category) => ({
      ...category,
      items: Array.isArray(category.items)
        ? category.items.filter((item) => !hasPrivateDevMarker(item))
        : [],
    }))
    .filter((category) => category.items.length > 0);

  return {
    ...version,
    content_json,
  };
};

const withBaselineChangelog = (versions: ChangelogVersion[]) => {
  const publicVersions = versions
    .map(sanitizePublicChangelogVersion)
    .filter((version): version is ChangelogVersion => Boolean(version));

  const hasBaseline = publicVersions.some((version) => version.version === BASELINE_1_0_0_CHANGELOG.version);
  return hasBaseline ? publicVersions : [BASELINE_1_0_0_CHANGELOG, ...publicVersions];
};

/**
 * Centraliza a leitura do changelog público da plataforma.
 * @since 1.0.0
 */
export const changelogService = {
  /**
   * Lista as versoes publicadas ordenadas pelo backend.
   * @since 1.0.0
   */
  async listVersions(): Promise<ChangelogVersion[]> {
    const response = await apiClient.get(ENDPOINTS.changelog.list) as unknown;
    const payload = readApiData<ChangelogVersion[] | ChangelogListPayload>(response, []);

    if (Array.isArray(payload)) {
      return withBaselineChangelog(payload);
    }

    if (Array.isArray(payload?.versions)) {
      return withBaselineChangelog(payload.versions);
    }

    return [BASELINE_1_0_0_CHANGELOG];
  },
};

export default changelogService;
