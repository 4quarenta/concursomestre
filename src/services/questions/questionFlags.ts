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

export const isQuestionCanceled = (question: Question) => (
  readQuestionBooleanFlag(question.anulada)
  || readQuestionBooleanFlag(question.isCanceled)
  || readQuestionBooleanFlag((question as any).is_cancelled)
  || readQuestionBooleanFlag((question as any).isCanceledQuestion)
);

export const isPlatformOriginalQuestion = (question: Question) => {
  const source = normalizeQuestionFlag([
    question.questionOrigin,
    question.question_origin,
    (question as any).sourceType,
    (question as any).source_type,
    (question as any).origin,
    (question as any).origem,
  ].find((value) => String(value ?? '').trim()));

  return ['platform', 'inedita', 'original', 'generated', 'gerada'].includes(source)
    || readQuestionBooleanFlag((question as any).isOriginal)
    || readQuestionBooleanFlag((question as any).inedita);
};
