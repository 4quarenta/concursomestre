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

import { createHash } from 'crypto';
import type { LawArticle, LawSummary, LegalSyncLog, LegalSyncRunResult } from '@types';
import { lawArticlesSeed, lawsSeed } from './legalCommentaryData';

const PLANALTO_ALLOWED_HOSTS = new Set(['www.planalto.gov.br', 'planalto.gov.br']);

const stripHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ordm;/gi, 'º')
    .replace(/&sect;/gi, '§')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const hashContent = (value: string) =>
  createHash('sha256').update(value.replace(/\s+/g, ' ').trim(), 'utf8').digest('hex');

const assertOfficialPlanaltoUrl = (url: string) => {
  const parsedUrl = new URL(url);
  if (!PLANALTO_ALLOWED_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
    throw new Error('A sincronização aceita apenas URLs oficiais do Portal do Planalto.');
  }
};

export const parsePlanaltoHtmlToArticles = (law: LawSummary, html: string): LawArticle[] => {
  const text = stripHtml(html);
  const matches = [...text.matchAll(/(?:^|\n)\s*Art\.?\s*(\d+[ºo]?(?:-[A-Z])?)\.?\s*([\s\S]*?)(?=(?:\n\s*Art\.?\s*\d+[ºo]?(?:-[A-Z])?\.?)|\n\s*Este texto|\n\s*Brasília|$)/gi)];

  return matches.map((match) => {
    const articleNumber = match[1].replace('o', 'º');
    const body = match[2].replace(/\s+/g, ' ').trim();
    const articleId = `sync-${law.id}-${articleNumber.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;

    return {
      id: articleId,
      lawId: law.id,
      slug: `art-${articleNumber.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`,
      number: articleNumber,
      hierarchy: {},
      blocks: [
        {
          id: `${articleId}-caput`,
          kind: 'caput',
          label: 'Caput',
          text: body,
        },
      ],
      officialAnchor: `#art${articleNumber.replace(/\D/g, '')}`,
    };
  });
};

export const detectArticleChanges = (
  currentArticles: LawArticle[],
  incomingArticles: LawArticle[],
) => {
  const currentByNumber = new Map(currentArticles.map((article) => [article.number, article]));
  const inserted = incomingArticles.filter((article) => !currentByNumber.has(article.number));
  const changed = incomingArticles.filter((article) => {
    const current = currentByNumber.get(article.number);
    if (!current) return false;

    return hashContent(current.blocks.map((block) => `${block.label} ${block.text}`).join(' ')) !==
      hashContent(article.blocks.map((block) => `${block.label} ${block.text}`).join(' '));
  });
  const incomingNumbers = new Set(incomingArticles.map((article) => article.number));
  const revoked = currentArticles.filter((article) => !incomingNumbers.has(article.number));

  return {
    inserted,
    changed,
    revoked,
  };
};

export const runPlanaltoSyncPreview = async (
  monitoredLaws: LawSummary[] = lawsSeed,
): Promise<LegalSyncRunResult> => {
  const startedAt = new Date().toISOString();
  const logs: LegalSyncLog[] = [];
  let changedLaws = 0;

  for (const law of monitoredLaws) {
    const logStartedAt = new Date().toISOString();

    try {
      assertOfficialPlanaltoUrl(law.officialUrl);
      const response = await fetch(law.officialUrl, {
        headers: {
          'User-Agent': 'ConcursoMestre-Legislacao-Monitor/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Fonte retornou HTTP ${response.status}.`);
      }

      const html = await response.text();
      const incomingArticles = parsePlanaltoHtmlToArticles(law, html);
      const currentArticles = lawArticlesSeed.filter((article) => article.lawId === law.id);
      const diff = detectArticleChanges(currentArticles, incomingArticles);
      const hasChanges = diff.inserted.length > 0 || diff.changed.length > 0 || diff.revoked.length > 0;

      if (hasChanges) changedLaws += 1;

      logs.push({
        id: `sync-${law.id}-${Date.now()}`,
        lawId: law.id,
        status: 'success',
        startedAt: logStartedAt,
        finishedAt: new Date().toISOString(),
        sourceUrl: law.officialUrl,
        message: hasChanges
          ? 'Mudanças detectadas. Persistência definitiva deve criar law_article_versions e law_updates.'
          : 'Sem mudança estrutural detectada no preview.',
        insertedArticles: diff.inserted.length,
        changedArticles: diff.changed.length,
        revokedArticles: diff.revoked.length,
      });
    } catch (error: any) {
      logs.push({
        id: `sync-${law.id}-${Date.now()}`,
        lawId: law.id,
        status: 'failed',
        startedAt: logStartedAt,
        finishedAt: new Date().toISOString(),
        sourceUrl: law.officialUrl,
        message: error?.message || 'Falha desconhecida ao sincronizar lei.',
      });
    }
  }

  const hasFailures = logs.some((log) => log.status === 'failed');

  return {
    status: hasFailures ? 'warning' : 'success',
    startedAt,
    finishedAt: new Date().toISOString(),
    checkedLaws: monitoredLaws.length,
    changedLaws,
    logs,
  };
};
