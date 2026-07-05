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

import type { Question } from '@types';

export type PythonExtractorContext = {
  tempId: string;
  title: string;
  text: string;
  referenceText?: string;
  richText?: string;
  questionNumbers: number[];
  hasFigure: boolean;
  figureDescription: string;
  page: number;
  sourcePage?: number;
};

export type PythonExtractorDiagnostics = {
  expectedQuestionNumbers: number[];
  extractedQuestionNumbers: number[];
  localizedQuestionNumbers: number[];
  completeQuestionNumbers: number[];
  incompleteQuestionNumbers: number[];
  missingQuestionNumbers: number[];
  placeholderQuestionNumbers: number[];
  visualPendingQuestionNumbers: number[];
  duplicateQuestionNumbers: number[];
  suspiciousQuestionNumbers: number[];
  cardsCreatedCount: number;
  completeCardsCount: number;
  incompleteCardsCount: number;
  placeholderCardsCount: number;
  pagesWithoutNativeText?: number[];
  lowConfidencePages?: number[];
  aiQuotaLimitReached?: boolean;
  aiTokenLimitReached?: boolean;
  aiLimitReached?: boolean;
  aiCallCount?: number;
  aiCallLimit?: number;
  aiCallsSkipped?: number;
  aiCallsSavedEstimate?: number;
};

export type PythonExtractorResponse = {
  success: boolean;
  metadata?: Record<string, unknown>;
  questions?: Question[];
  contexts?: PythonExtractorContext[];
  diagnostics?: PythonExtractorDiagnostics;
  logs?: string[];
};

type RunPythonExtractorParams = {
  examFile: File;
  answerKeyFile?: File | null;
  metadata?: Record<string, unknown>;
};

const getPythonExtractorEndpoint = () => {
  const configured = process.env.NEXT_PUBLIC_IMPORT_EXTRACTOR_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '').endsWith('/extract')
      ? configured
      : `${configured.replace(/\/$/, '')}/extract`;
  }
  return '';
};

export const runPythonExtractor = async ({
  examFile,
  answerKeyFile,
  metadata,
}: RunPythonExtractorParams): Promise<PythonExtractorResponse | null> => {
  const endpoint = getPythonExtractorEndpoint();
  if (!endpoint) {
    return null;
  }

  const formData = new FormData();
  formData.append('exam_pdf', examFile);
  if (answerKeyFile) {
    formData.append('answer_key_pdf', answerKeyFile);
  }
  formData.append('metadata_json', JSON.stringify(metadata || {}));

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Extrator Python respondeu ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  return response.json() as Promise<PythonExtractorResponse>;
};
