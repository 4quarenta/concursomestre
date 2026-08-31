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

import type { Question } from 'types';

const normalizeQuestionFlag = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const TRUE_FLAG_VALUES = new Set([
  '1',
  'true',
  'yes',
  'y',
  'sim',
  's',
  'active',
  'ativo',
]);

const FALSE_FLAG_VALUES = new Set([
  '',
  '0',
  'false',
  'no',
  'n',
  'nao',
  'não',
  'null',
  'undefined',
]);

type QuestionFlagAliases = Question & {
  is_cancelled?: unknown;
  isCanceledQuestion?: unknown;
  sourceType?: unknown;
  source_type?: unknown;
  origin?: unknown;
  origem?: unknown;
  isOriginal?: unknown;
  inedita?: unknown;
};

export const readQuestionBooleanFlag = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalizedValue = normalizeQuestionFlag(value);

  if (FALSE_FLAG_VALUES.has(normalizedValue)) {
    return false;
  }

  if (TRUE_FLAG_VALUES.has(normalizedValue)) {
    return true;
  }

  return Boolean(value);
};

export const isQuestionCanceled = (question: Question) => {
  const aliases = question as QuestionFlagAliases;
  return (
    readQuestionBooleanFlag(question.anulada)
    || readQuestionBooleanFlag(question.isCanceled)
    || readQuestionBooleanFlag(aliases.is_cancelled)
    || readQuestionBooleanFlag(aliases.isCanceledQuestion)
  );
};

export const isPlatformOriginalQuestion = (question: Question) => {
  const aliases = question as QuestionFlagAliases;
  const source = normalizeQuestionFlag([
    question.questionOrigin,
    question.question_origin,
    aliases.sourceType,
    aliases.source_type,
    aliases.origin,
    aliases.origem,
  ].find((value) => String(value ?? '').trim()));

  return ['platform', 'inedita', 'original', 'generated', 'gerada'].includes(source)
    || readQuestionBooleanFlag(aliases.isOriginal)
    || readQuestionBooleanFlag(aliases.inedita);
};
