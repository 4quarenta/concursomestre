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

const granQuestionIdentity = (question: GranReviewQuestion) => {
  const externalId = String(question.source?.externalId ?? '').trim();
  if (externalId) return `${String(question.source?.provider || 'gran')}:question:${externalId}`;
  return String(question.tempId || '').trim();
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

export const mergeGranReviewPayloads = <T extends GranReviewPayload>(
  currentPayloads: T[],
  incomingPayloads: T[],
  limit = 5000,
) => {
  const existingIdentities = new Set<string>();
  let questionCount = 0;
  currentPayloads.forEach((payload) => payload.questions.forEach((question) => {
    const identity = granQuestionIdentity(question);
    if (identity) existingIdentities.add(identity);
    questionCount += 1;
  }));
  const merged = [...currentPayloads];
  let added = 0;
  for (const payload of incomingPayloads) {
    const questions = payload.questions.filter((question) => {
      const identity = granQuestionIdentity(question);
      if (identity && existingIdentities.has(identity)) return false;
      if (questionCount + added >= limit) return false;
      if (identity) existingIdentities.add(identity);
      added += 1;
      return true;
    });
    if (questions.length > 0) merged.push(clonePayloadWithQuestions(payload, questions));
  }
  return { payloads: merged, added, total: questionCount + added, limitReached: questionCount + added >= limit };
};
