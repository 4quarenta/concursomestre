import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/app/questions/components/QuestionCard.tsx'), 'utf8');
const globalStyles = fs.readFileSync(path.resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

describe('QuestionCard mobile layout', () => {
  it('uses compact mobile spacing without changing desktop spacing', () => {
    expect(source).toContain('p-3 space-y-4 sm:p-6 sm:space-y-6');
    expect(source).toContain('p-3 sm:p-4 rounded-xl');
    expect(source).toContain('px-3 py-3 sm:px-6 sm:py-4');
  });

  it('prevents accidental double-tap zoom while preserving browser pinch zoom', () => {
    expect(globalStyles).toContain("[role='button']");
    expect(globalStyles).toContain('touch-action: manipulation');
    expect(globalStyles).not.toContain('user-scalable=no');
  });
});
