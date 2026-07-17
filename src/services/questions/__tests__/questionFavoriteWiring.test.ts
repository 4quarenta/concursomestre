import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('question favorite optimistic state', () => {
  it('restores the previous value when persistence fails', () => {
    const source = readSource('src/providers/AuthProvider.tsx');
    expect(source).toContain("type: 'SET_SAVED'");
    expect(source).toContain('isSaved: wasSaved');
    expect(source).toContain('if (!result.success || result.isSaved === undefined)');
    expect(source).toContain("addToast('Não foi possível atualizar a questão salva.', 'error')");
  });
});
