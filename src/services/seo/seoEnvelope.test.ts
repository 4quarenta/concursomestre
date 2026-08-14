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

import { describe, expect, it, vi } from 'vitest';
import fixtures from '../../../contracts/seo/fixtures/contract-fixtures.v1.json';
import {
  parseSeoEnvelopeShadow,
  withValidatedSeoEnvelopeShadow,
} from './seoEnvelope';
import { compareLegacySeoWithFuture } from './seoLegacyComparison';

const fixture = <T extends { name: string; value: unknown }>(items: T[], name: string): unknown => (
  items.find((item) => item.name === name)?.value
);

const questionEnvelope = () => ({
  publicationDecision: structuredClone(fixture(fixtures.publicationDecision.valid, 'public published')),
  seoDecision: structuredClone(fixture(fixtures.seoDecision.valid, 'question PASS and INDEX')),
  seoFacts: structuredClone(fixture(fixtures.seoFacts.valid, 'question facts')),
});

const parse = (value: unknown, diagnosticSink = vi.fn()) => parseSeoEnvelopeShadow(value, {
  expectedResourceType: 'question',
  expectedResourceId: '123',
  source: 'seoEnvelope.test',
  diagnosticSink,
});

describe('SEO payload envelope shadow parser', () => {
  it('accepts a coherent question envelope', () => {
    const result = parse(questionEnvelope());
    expect(result).toMatchObject({ status: 'valid', diagnostics: [] });
    expect(result.envelope?.seoFacts.resourceType).toBe('question');
  });

  it('keeps legacy payloads without an envelope operational', () => {
    const sink = vi.fn();
    const legacy = { id: 123, enunciado: 'Questao legada.' };
    const parsed = parse(legacy, sink);
    const normalized = withValidatedSeoEnvelopeShadow(legacy, {
      expectedResourceType: 'question',
      expectedResourceId: '123',
      source: 'seoEnvelope.legacy',
      diagnosticSink: sink,
    });

    expect(parsed.status).toBe('absent');
    expect(normalized).toEqual(legacy);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ code: 'seo_shadow.envelope_missing' }));
  });

  it('rejects partial, schema-invalid and reason-code-invalid envelopes', () => {
    const partial = questionEnvelope();
    delete (partial as Partial<typeof partial>).seoFacts;
    expect(parse(partial).status).toBe('invalid');

    const invalidSchema = questionEnvelope();
    (invalidSchema.seoDecision as Record<string, unknown>).policyVersion = 'seo-policy.v999';
    expect(parse(invalidSchema).status).toBe('invalid');

    const invalidReason = questionEnvelope();
    (invalidReason.publicationDecision as { reasonCodes: string[] }).reasonCodes = ['publication.typo'];
    expect(parse(invalidReason).status).toBe('invalid');
  });

  it('rejects resource type and resource id mismatches', () => {
    const resourceTypeMismatch = questionEnvelope();
    (resourceTypeMismatch.seoFacts as Record<string, unknown>).resourceType = 'exam';
    expect(parse(resourceTypeMismatch).status).toBe('invalid');

    const resourceIdMismatch = questionEnvelope();
    ((resourceIdMismatch.seoDecision as Record<string, unknown>).resource as Record<string, unknown>).id = '999';
    expect(parse(resourceIdMismatch).status).toBe('invalid');
  });

  it('removes invalid envelope fields while preserving the legacy entity', () => {
    const invalid = {
      id: 123,
      enunciado: 'Conteudo publico existente.',
      ...questionEnvelope(),
    };
    (invalid.seoDecision as Record<string, unknown>).policyVersion = 'invalid';

    const normalized = withValidatedSeoEnvelopeShadow(invalid, {
      expectedResourceType: 'question',
      expectedResourceId: 123,
      source: 'seoEnvelope.invalid-fallback',
      diagnosticSink: vi.fn(),
    });
    expect(normalized).toEqual({ id: 123, enunciado: 'Conteudo publico existente.' });
  });

  it('does not carry protected fields inside SeoFacts', () => {
    const encoded = JSON.stringify(parse(questionEnvelope()).envelope?.seoFacts);
    [
      'answer', 'resposta', 'correctAlternativeId', 'teacherComment',
      'detailedComment', 'editorial', 'questionEditorials',
    ].forEach((key) => expect(encoded).not.toContain(`"${key}"`));
  });
});

describe('legacy versus future SEO comparison', () => {
  it('classifies divergences without applying the future decision', () => {
    const parsed = parse(questionEnvelope());
    expect(parsed.envelope).not.toBeNull();
    const comparison = compareLegacySeoWithFuture({
      legacy: {
        indexability: 'INDEX',
        canonicalPath: '/question/123/slug-legado',
        slug: 'slug-legado',
        publicationStatus: 'published',
        qualityStatus: 'PASS',
      },
      envelope: parsed.envelope!,
    });

    expect(comparison.matches).toBe(false);
    expect(comparison.categories).toEqual(expect.arrayContaining(['canonical', 'slug']));
    expect(comparison.categories).not.toContain('indexability');
  });
});
