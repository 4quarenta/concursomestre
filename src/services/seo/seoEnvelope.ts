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

import {
  validatePublicationDecision,
  type PublicationDecisionV1,
} from '@services/publication/publicationDecision';
import {
  validateSeoDecision,
  type SeoDecisionV1,
} from './seoDecision';
import {
  validateSeoFacts,
  type SeoFactsResourceType,
  type SeoFactsV1,
} from './seoFacts';
import { logger } from '@/utils/helpers/DebugLogger';

export interface SeoEnvelopeV1 {
  publicationDecision: PublicationDecisionV1;
  seoDecision: SeoDecisionV1;
  seoFacts: SeoFactsV1;
}

export interface SeoEnvelopeCarrier {
  publicationDecision?: PublicationDecisionV1;
  seoDecision?: SeoDecisionV1;
  seoFacts?: SeoFactsV1;
}

export type SeoEnvelopeParseStatus = 'valid' | 'absent' | 'invalid';

export interface SeoEnvelopeDiagnostic {
  code:
    | 'seo_shadow.envelope_missing'
    | 'seo_shadow.envelope_partial'
    | 'seo_shadow.contract_invalid'
    | 'seo_shadow.resource_type_mismatch'
    | 'seo_shadow.resource_id_mismatch';
  source: string;
  expectedResourceType: SeoFactsResourceType;
  expectedResourceId?: string;
  actualResourceType?: string;
  errorCount: number;
}

export interface SeoEnvelopeParseResult {
  status: SeoEnvelopeParseStatus;
  envelope: SeoEnvelopeV1 | null;
  diagnostics: SeoEnvelopeDiagnostic[];
}

type DiagnosticSink = (diagnostic: SeoEnvelopeDiagnostic) => void;

const emittedDiagnostics = new Set<string>();

const defaultDiagnosticSink: DiagnosticSink = (diagnostic) => {
  const identity = [diagnostic.code, diagnostic.source, diagnostic.expectedResourceId || ''].join(':');
  if (emittedDiagnostics.has(identity)) return;
  emittedDiagnostics.add(identity);
  logger.addLog('warn', '[seo-shadow] Invalid or missing SEO envelope', diagnostic);
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

export const parseSeoEnvelopeShadow = (
  value: unknown,
  {
    expectedResourceType,
    expectedResourceId,
    source,
    expected = true,
    diagnosticSink = defaultDiagnosticSink,
  }: {
    expectedResourceType: SeoFactsResourceType;
    expectedResourceId?: string | number | null;
    source: string;
    expected?: boolean;
    diagnosticSink?: DiagnosticSink;
  },
): SeoEnvelopeParseResult => {
  const normalizedExpectedId = expectedResourceId === undefined || expectedResourceId === null
    ? undefined
    : String(expectedResourceId);
  const diagnostics: SeoEnvelopeDiagnostic[] = [];
  const report = (diagnostic: SeoEnvelopeDiagnostic) => {
    diagnostics.push(diagnostic);
    diagnosticSink(diagnostic);
  };

  if (!isRecord(value)) {
    if (expected) {
      report({
        code: 'seo_shadow.envelope_missing',
        source,
        expectedResourceType,
        expectedResourceId: normalizedExpectedId,
        errorCount: 1,
      });
    }
    return { status: 'absent', envelope: null, diagnostics };
  }

  const keys = ['publicationDecision', 'seoDecision', 'seoFacts'] as const;
  const present = keys.filter((key) => Object.hasOwn(value, key));
  if (present.length === 0) {
    if (expected) {
      report({
        code: 'seo_shadow.envelope_missing',
        source,
        expectedResourceType,
        expectedResourceId: normalizedExpectedId,
        errorCount: 1,
      });
    }
    return { status: 'absent', envelope: null, diagnostics };
  }
  if (present.length !== keys.length) {
    report({
      code: 'seo_shadow.envelope_partial',
      source,
      expectedResourceType,
      expectedResourceId: normalizedExpectedId,
      errorCount: keys.length - present.length,
    });
    return { status: 'invalid', envelope: null, diagnostics };
  }

  const publication = validatePublicationDecision(value.publicationDecision);
  const decision = validateSeoDecision(value.seoDecision);
  const facts = validateSeoFacts(value.seoFacts);
  const contractErrorCount = publication.errors.length + decision.errors.length + facts.errors.length;
  if (!publication.valid || !decision.valid || !facts.valid) {
    report({
      code: 'seo_shadow.contract_invalid',
      source,
      expectedResourceType,
      expectedResourceId: normalizedExpectedId,
      actualResourceType: isRecord(value.seoFacts) && typeof value.seoFacts.resourceType === 'string'
        ? value.seoFacts.resourceType
        : undefined,
      errorCount: contractErrorCount,
    });
    return { status: 'invalid', envelope: null, diagnostics };
  }

  const actualResourceType = facts.value.resourceType;
  if (actualResourceType !== expectedResourceType || decision.value.resource.type !== expectedResourceType) {
    report({
      code: 'seo_shadow.resource_type_mismatch',
      source,
      expectedResourceType,
      expectedResourceId: normalizedExpectedId,
      actualResourceType,
      errorCount: 1,
    });
    return { status: 'invalid', envelope: null, diagnostics };
  }
  if (normalizedExpectedId !== undefined && decision.value.resource.id !== normalizedExpectedId) {
    report({
      code: 'seo_shadow.resource_id_mismatch',
      source,
      expectedResourceType,
      expectedResourceId: normalizedExpectedId,
      actualResourceType,
      errorCount: 1,
    });
    return { status: 'invalid', envelope: null, diagnostics };
  }

  return {
    status: 'valid',
    envelope: {
      publicationDecision: publication.value,
      seoDecision: decision.value,
      seoFacts: facts.value,
    },
    diagnostics,
  };
};

export const seoEnvelopeFields = (envelope: SeoEnvelopeV1 | null): SeoEnvelopeCarrier => (
  envelope
    ? {
      publicationDecision: envelope.publicationDecision,
      seoDecision: envelope.seoDecision,
      seoFacts: envelope.seoFacts,
    }
    : {}
);

export const withValidatedSeoEnvelopeShadow = <T extends Record<string, unknown>>(
  value: T,
  options: Parameters<typeof parseSeoEnvelopeShadow>[1],
): T & SeoEnvelopeCarrier => {
  const parsed = parseSeoEnvelopeShadow(value, options);
  const {
    publicationDecision: _publicationDecision,
    seoDecision: _seoDecision,
    seoFacts: _seoFacts,
    ...legacyPayload
  } = value;

  return {
    ...legacyPayload,
    ...seoEnvelopeFields(parsed.envelope),
  } as T & SeoEnvelopeCarrier;
};

export const resetSeoEnvelopeDiagnosticsForTests = (): void => {
  emittedDiagnostics.clear();
};
