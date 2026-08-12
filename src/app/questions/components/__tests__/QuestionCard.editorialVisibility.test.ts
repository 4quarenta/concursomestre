import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/app/questions/components/QuestionCard.tsx'), 'utf8');

describe('QuestionCard editorial visibility', () => {
  it('hides absent editorial actions and preserves locked actions when availability exists', () => {
    expect(source).toContain('const hasTeacherCommentAvailable = Boolean(question.hasTeacherComment) || hasTeacherCommentContent;');
    expect(source).toContain('const hasDetailedCommentAvailable = Boolean(question.hasDetailedComment) || detailedCommentContent');
    expect(source).toContain('{hasTeacherCommentAvailable ? (');
    expect(source).toContain('{hasDetailedCommentAvailable ? (');
    expect(source).toContain('!canSeeTeacher');
    expect(source).toContain('!canSeeDetailed');
  });
});
