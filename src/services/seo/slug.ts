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

import type { Material, Question, Ranking } from '@types';
import { getConfiguredSiteUrl } from '../../config/siteUrl';

const MAX_SLUG_LENGTH = 80;
const DEFAULT_CANONICAL_BASE_URL = getConfiguredSiteUrl().toString();

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export const slugifyContent = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH);

export const getQuestionSeoLabel = (question: Partial<Question>) => {
  const baseText = stripHtml(question.enunciado_clean || question.enunciado || '');
  return baseText || `questao-${question.id || 'publica'}`;
};

export const buildQuestionSlug = (question: Partial<Question>) => slugifyContent(getQuestionSeoLabel(question));

export const buildRankingSlug = (ranking: Partial<Ranking>) =>
  slugifyContent([ranking.name, ranking.institution].filter(Boolean).join(' '));

export const buildMaterialSlug = (material: Partial<Material>) =>
  slugifyContent(material.title || material.description || `material-${material.id || 'publico'}`);

export const buildQuestionPath = (question: Partial<Question>) =>
  `/question/${question.id}/${buildQuestionSlug(question)}`;

export const buildRankingPath = (ranking: Partial<Ranking>) =>
  `/ranking/${ranking.id}/${buildRankingSlug(ranking)}`;

export const buildMaterialPath = (material: Partial<Material>) =>
  `/material/${material.id}/${buildMaterialSlug(material)}`;

export const buildAbsoluteUrl = (path: string, baseUrl = DEFAULT_CANONICAL_BASE_URL) =>
  new URL(path, baseUrl).toString();

export const summarizeSeoText = (value: string, maxLength: number) => {
  const normalized = stripHtml(value).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxLength - 3, 0)).trimEnd()}...`;
};
