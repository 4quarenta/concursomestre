import { describe, expect, it } from 'vitest';
import { createSubmissionGate } from '../submissionGate';

describe('createSubmissionGate', () => {
  it('permite somente uma submissao enquanto a anterior estiver pendente', () => {
    const gate = createSubmissionGate();

    expect(gate.tryStart()).toBe(true);
    expect(gate.tryStart()).toBe(false);
    expect(gate.isPending()).toBe(true);

    gate.finish();

    expect(gate.isPending()).toBe(false);
    expect(gate.tryStart()).toBe(true);
  });
});
