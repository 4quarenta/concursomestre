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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';
import type {
  LawArticle,
  LawDetail,
  LawSummary,
  LegalArea,
  LegalFavoriteType,
  LegalHomeSnapshot,
  LegalSearchResult,
  LegalUserComment,
} from '@types';

interface LegalSearchPayload {
  results: LegalSearchResult[];
}

interface LegalAdminListPayload {
  laws: LawSummary[];
  home: LegalHomeSnapshot;
}

interface LegalAdminDetailPayload {
  law: LawDetail | null;
  areas: LegalArea[];
}

type LegalAiKind = 'teacher-comment' | 'exam-tip' | 'jurisprudence' | 'sumula';

interface LegalAiSuggestionInput {
  kind: LegalAiKind;
  law: Partial<LawDetail | LawSummary>;
  article?: Partial<LawArticle> | null;
}

const unwrap = <T>(response: any, fallback: T): T => readApiData<T>(response, fallback);

const normalizeJsonText = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
};

const safeParseJson = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(normalizeJsonText(text)) as T;
  } catch {
    return fallback;
  }
};

const extractAiText = (payload: any): string => {
  if (typeof payload === 'string') return payload;
  if (typeof payload?.text === 'string') return payload.text;
  return '';
};

const buildAiPrompt = ({ kind, law, article }: LegalAiSuggestionInput) => {
  const articleText = article?.text || article?.blocks?.map((block) => `${block.label} ${block.text}`).join('\n') || '';
  const base = `
Voce e editor juridico da plataforma ConcursoMestre.
Produza conteudo didatico em pt-BR para concursos publicos.

Lei: ${law.shortTitle || law.title || 'Lei comentada'}
Numero: ${law.number || ''}
Artigo: ${article?.number || ''}
Texto oficial:
${articleText}

Regras:
- Seja direto, tecnico e util para prova.
- Nao invente fonte oficial, numero de sumula ou precedente se nao houver seguranca.
- Retorne apenas JSON valido, sem markdown.
  `.trim();

  if (kind === 'teacher-comment') {
    return `${base}

Gere um comentario de professor.
Formato JSON:
{
  "title": "Comentario do professor",
  "body": "explicacao didatica",
  "examFocus": ["ponto que cai em prova"],
  "pitfalls": ["pegadinha comum"],
  "relatedRefs": ["referencia cruzada opcional"]
}`;
  }

  if (kind === 'exam-tip') {
    return `${base}

Gere um macete para prova.
Formato JSON:
{
  "title": "Macete para prova",
  "body": "frase de memorizacao ou alerta objetivo",
  "tags": ["tag"]
}`;
  }

  if (kind === 'jurisprudence') {
    return `${base}

Sugira uma jurisprudencia relevante somente se for segura. Se nao houver seguranca, retorne um resumo editorial sem numero ficticio.
Formato JSON:
{
  "court": "STF ou STJ",
  "precedentType": "Tema, sumula, repetitivo, informativo ou entendimento",
  "title": "titulo curto",
  "summary": "resumo objetivo",
  "examImpact": "impacto para concursos",
  "isConsolidated": false,
  "priority": "medium",
  "sourceUrl": ""
}`;
  }

  return `${base}

Sugira uma sumula relacionada somente se for segura. Se nao houver sumula segura, retorne numero vazio e texto explicando a necessidade de revisao editorial.
Formato JSON:
{
  "court": "STF ou STJ",
  "number": "",
  "text": "texto da sumula ou observacao para revisao",
  "sourceUrl": "",
  "priority": "medium"
}`;
};

export const legalCommentaryApiService = {
  async getHomeSnapshot(): Promise<LegalHomeSnapshot> {
    const response = await apiClient.get(ENDPOINTS.legalCommentary.list) as any;
    return unwrap<LegalHomeSnapshot>(response, {
      areas: [],
      lawsByArea: [],
      mostAccessed: [],
      favoriteLaws: [],
      recentlyStudied: [],
      recentlyUpdated: [],
      totals: { laws: 0, articles: 0, commentedArticles: 0, updatedRecently: 0 },
    });
  },

  async search(query: string): Promise<LegalSearchResult[]> {
    const response = await apiClient.get(ENDPOINTS.legalCommentary.list, {
      params: { q: query },
    }) as any;
    const payload = unwrap<LegalSearchPayload>(response, { results: [] });
    return Array.isArray(payload.results) ? payload.results : [];
  },

  async getLawDetail(slug: string): Promise<LawDetail | null> {
    const response = await apiClient.get(ENDPOINTS.legalCommentary.detail, {
      params: { slug },
    }) as any;
    return unwrap<LawDetail | null>(response, null);
  },

  async toggleFavorite(type: LegalFavoriteType, targetId: string): Promise<{ isFavorite: boolean }> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.favorite, { type, targetId }) as any;
    const envelope = assertApiSuccess<{ isFavorite: boolean }>(response, 'Nao foi possivel atualizar o favorito.');
    return unwrap(envelope.raw, { isFavorite: false });
  },

  async recordLawView(lawId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.legalCommentary.progress, { lawId }) as any;
  },

  async recordArticleView(lawId: string, articleId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.legalCommentary.progress, { lawId, articleId }) as any;
  },

  async addUserComment(input: { articleId: string; body: string }): Promise<LegalUserComment> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.comment, {
      action: 'create',
      ...input,
    }) as any;
    const envelope = assertApiSuccess<LegalUserComment>(response, 'Nao foi possivel criar o comentario.');
    return unwrap<LegalUserComment>(envelope.raw, {} as LegalUserComment);
  },

  async updateUserComment(commentId: string, body: string): Promise<LegalUserComment> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.comment, {
      action: 'update',
      commentId,
      body,
    }) as any;
    const envelope = assertApiSuccess<LegalUserComment>(response, 'Nao foi possivel atualizar o comentario.');
    return unwrap<LegalUserComment>(envelope.raw, {} as LegalUserComment);
  },

  async deleteUserComment(commentId: string): Promise<void> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.comment, {
      action: 'delete',
      commentId,
    }) as any;
    assertApiSuccess(response, 'Nao foi possivel excluir o comentario.');
  },

  async reportUserComment(commentId: string): Promise<void> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.comment, {
      action: 'report',
      commentId,
    }) as any;
    assertApiSuccess(response, 'Nao foi possivel denunciar o comentario.');
  },

  async getAdminList(query = ''): Promise<LegalAdminListPayload> {
    const response = await apiClient.get(ENDPOINTS.legalCommentary.adminList, {
      params: query ? { q: query } : undefined,
    }) as any;
    return unwrap<LegalAdminListPayload>(response, {
      laws: [],
      home: {
        areas: [],
        lawsByArea: [],
        mostAccessed: [],
        favoriteLaws: [],
        recentlyStudied: [],
        recentlyUpdated: [],
        totals: { laws: 0, articles: 0, commentedArticles: 0, updatedRecently: 0 },
      },
    });
  },

  async getAdminDetail(id: string): Promise<LegalAdminDetailPayload> {
    const response = await apiClient.get(ENDPOINTS.legalCommentary.adminDetail, {
      params: { id },
    }) as any;
    return unwrap<LegalAdminDetailPayload>(response, { law: null, areas: [] });
  },

  async saveAdminLaw(payload: Partial<LawDetail> & Record<string, any>): Promise<LawDetail> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.adminSave, payload) as any;
    const envelope = assertApiSuccess<LawDetail>(response, 'Nao foi possivel salvar a lei.');
    return unwrap<LawDetail>(envelope.raw, {} as LawDetail);
  },

  async deleteAdminLaw(id: string): Promise<void> {
    const response = await apiClient.post(`${ENDPOINTS.legalCommentary.adminDelete}?id=${encodeURIComponent(id)}`) as any;
    assertApiSuccess(response, 'Nao foi possivel remover a lei.');
  },

  async generateEditorialSuggestion<T = any>(input: LegalAiSuggestionInput, fallback: T): Promise<T> {
    const response = await apiClient.post(ENDPOINTS.ai.generate, {
      prompt: buildAiPrompt(input),
      responseMimeType: 'application/json',
    }) as any;
    const envelope = assertApiSuccess<any>(response, 'Nao foi possivel gerar o conteudo com IA.');
    const text = extractAiText(unwrap<any>(envelope.raw, { text: '' }));
    return safeParseJson<T>(text, fallback);
  },
};

export default legalCommentaryApiService;
