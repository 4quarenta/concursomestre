type GranReviewQuestion = {
  tempId?: string;
  source?: {
    externalId?: number | string | null;
    provider?: string | null;
    questionNumber?: number | string | null;
    contextTempId?: number | string | null;
    alreadyPublished?: boolean;
    publicationStatus?: string | null;
  };
  publication?: {
    status?: string | null;
  };
};

type GranReviewContext = {
  tempId?: string;
  questionNumbers?: Array<number | string>;
};

type GranReviewPayload = {
  questions: GranReviewQuestion[];
  contexts?: GranReviewContext[];
  exam?: {
    questionRange?: unknown;
    [key: string]: unknown;
  };
};
export type GranReviewQueueStatus = 'queued' | 'processing' | 'published' | 'failed';

export const classifyGranReviewQuestionIndexes = <T>({
  questions,
  isPublished,
  isReady,
  queueStatuses = {},
}: {
  questions: T[];
  isPublished: (question: T, index: number) => boolean;
  isReady: (question: T, index: number) => boolean;
  queueStatuses?: Record<number, GranReviewQueueStatus>;
}) => questions.reduce<{ selectable: number[]; publishable: number[] }>((result, question, index) => {
  const queueStatus = queueStatuses[index];
  const unavailable = isPublished(question, index)
    || queueStatus === 'queued'
    || queueStatus === 'processing'
    || queueStatus === 'published';
  if (unavailable) return result;

  result.selectable.push(index);
  if (isReady(question, index)) result.publishable.push(index);
  return result;
}, { selectable: [], publishable: [] });

export const getGranReviewQueueOffsets = <T extends Pick<GranReviewPayload, 'questions'>>(payloads: T[]) => {
  let offset = 0;
  return payloads.map((payload) => {
    const currentOffset = offset;
    offset += payload.questions.length;
    return currentOffset;
  });
};

export const isGranQuestionAlreadyPublished = (question: GranReviewQuestion) => {
  if (question.source?.alreadyPublished === true) return true;
  const status = String(
    question.source?.publicationStatus
    || question.publication?.status
    || '',
  ).trim().toLowerCase();
  return status === 'published' || status === 'publicado';
};

const clonePayloadWithQuestions = <T extends GranReviewPayload>(
  payload: T,
  questions: GranReviewQuestion[],
): T => {
  const questionNumbers = new Set(
    questions
      .map((question) => Number(question.source?.questionNumber))
      .filter((value) => Number.isInteger(value) && value > 0),
  );
  const contextIds = new Set(
    questions
      .map((question) => String(question.source?.contextTempId || '').trim())
      .filter(Boolean),
  );
  const contexts = (payload.contexts || []).flatMap((context) => {
    const linkedNumbers = (context.questionNumbers || [])
      .map(Number)
      .filter((value) => questionNumbers.has(value));
    if (!contextIds.has(String(context.tempId || '')) && linkedNumbers.length === 0) {
      return [];
    }
    return [{ ...context, questionNumbers: linkedNumbers }];
  });

  return {
    ...payload,
    exam: payload.exam
      ? {
          ...payload.exam,
          // A fila parcial e guiada pelos numeros reais dos cards. Herdar o
          // intervalo completo recriaria placeholders da outra fila.
          questionRange: undefined,
        }
      : payload.exam,
    contexts,
    questions,
  } as T;
};

export const partitionGranReviewPayloads = <T extends GranReviewPayload>(payloads: T[]) => {
  const pendingPayloads: T[] = [];
  const publishedPayloads: T[] = [];
  let pendingQuestionCount = 0;
  let publishedQuestionCount = 0;

  payloads.forEach((payload) => {
    const pendingQuestions = payload.questions.filter((question) => !isGranQuestionAlreadyPublished(question));
    const publishedQuestions = payload.questions.filter(isGranQuestionAlreadyPublished);
    if (pendingQuestions.length > 0) {
      pendingQuestionCount += pendingQuestions.length;
      pendingPayloads.push(clonePayloadWithQuestions(payload, pendingQuestions));
    }
    if (publishedQuestions.length > 0) {
      publishedQuestionCount += publishedQuestions.length;
      publishedPayloads.push(clonePayloadWithQuestions(payload, publishedQuestions));
    }
  });

  return {
    pendingPayloads,
    publishedPayloads,
    pendingQuestionCount,
    publishedQuestionCount,
  };
};

