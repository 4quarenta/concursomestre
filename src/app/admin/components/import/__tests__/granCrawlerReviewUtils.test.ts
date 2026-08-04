import { describe, expect, it } from 'vitest';
import {
  classifyGranReviewQuestionIndexes,
  getGranReviewQueueOffsets,
  partitionGranReviewPayloads,
} from '../granCrawlerReviewUtils';

describe('partitionGranReviewPayloads', () => {
  it('keeps unpublished questions visible and hides published questions in a separate queue', () => {
    const payload = {
      schemaVersion: 'question-import.v2',
      exam: {
        title: 'Prova Gran',
        questionRange: { start: 1, end: 80, total: 80 },
      },
      contexts: [{ tempId: 'ctx_1', questionNumbers: [1, 2] }],
      questions: [{
        tempId: 'q_1',
        source: { questionNumber: 1, contextTempId: 'ctx_1', alreadyPublished: false },
        publication: { status: 'draft' },
      }, {
        tempId: 'q_2',
        source: {
          questionNumber: 2,
          contextTempId: 'ctx_1',
          localQuestionId: 91,
          alreadyPublished: true,
          publicationStatus: 'published',
        },
        publication: { status: 'published' },
      }],
    };

    const result = partitionGranReviewPayloads([payload]);

    expect(result.pendingQuestionCount).toBe(1);
    expect(result.publishedQuestionCount).toBe(1);
    expect(result.pendingPayloads[0]?.questions.map((question) => question.tempId)).toEqual(['q_1']);
    expect(result.publishedPayloads[0]?.questions.map((question) => question.tempId)).toEqual(['q_2']);
    expect(result.pendingPayloads[0]?.contexts[0]?.questionNumbers).toEqual([1]);
    expect(result.publishedPayloads[0]?.contexts[0]?.questionNumbers).toEqual([2]);
    expect(result.pendingPayloads[0]?.exam?.questionRange).toBeUndefined();
    expect(result.publishedPayloads[0]?.exam?.questionRange).toBeUndefined();
  });

  it('does not classify an unsaved draft as already published', () => {
    const result = partitionGranReviewPayloads([{
      questions: [{
        source: { questionNumber: 8, alreadyPublished: false, publicationStatus: 'draft' },
        publication: { status: 'draft' },
      }],
      contexts: [],
    }]);

    expect(result.pendingQuestionCount).toBe(1);
    expect(result.publishedQuestionCount).toBe(0);
  });

  it('selects all 100 review cards while keeping only complete items publishable', () => {
    const questions = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      ready: index < 56,
    }));

    const availability = classifyGranReviewQuestionIndexes({
      questions,
      isPublished: () => false,
      isReady: (question) => question.ready,
    });

    expect(availability.selectable).toHaveLength(100);
    expect(availability.publishable).toHaveLength(56);
    expect(availability.selectable.at(-1)).toBe(99);
  });

  it('builds continuous review indexes across multiple exam payloads', () => {
    const offsets = getGranReviewQueueOffsets([
      { questions: Array.from({ length: 40 }, () => ({})) },
      { questions: Array.from({ length: 60 }, () => ({})) },
    ]);

    expect(offsets).toEqual([0, 40]);
    expect(offsets[1] + 60).toBe(100);
  });
});
