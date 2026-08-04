/*
 * Prepara os contextos do lote unificado do coletor Gran. A fila usa o mesmo
 * contrato canônico do importador, sem reenviar a coleta original nem perder
 * alterações feitas na revisão editorial.
 */

import type { QuestionAsset, QuestionContextPayload } from '@types';
import type { ImportedContextDraft } from './adminImportWorkflowParsingCore';
import { stripHtml } from './adminImportWorkflowParsingCore';

type PublishedContextContent = {
  text: string;
  referenceText: string;
  imageData?: string;
  figures?: Array<Record<string, unknown>>;
};

export const buildImportedContextsForPublication = (
  contexts: ImportedContextDraft[],
  readContent: (context: ImportedContextDraft) => PublishedContextContent,
): QuestionContextPayload[] => contexts.map((context) => {
  const content = readContent(context);
  const assets: QuestionAsset[] = [
    ...(context.assets || []).map((asset, index) => ({
      ...asset,
      tempId: String(asset.tempId || asset.id || `${context.tempId}-img-${index + 1}`),
      type: 'image' as const,
      usage: 'context' as const,
      order: asset.order || index + 1,
    })),
    ...(content.imageData ? [{
      tempId: `${context.tempId}-img-1`, type: 'image' as const, usage: 'context' as const,
      base64: content.imageData, alt: context.figureDescription || context.title || 'Imagem do contexto.',
      sourcePage: context.sourcePage || context.page || null, order: 1,
    }] : []),
    ...(content.figures || []).filter((figure) => Boolean(figure.imageData || figure.url)).map((figure, index) => ({
      tempId: String(figure.figureKey || `${context.tempId}-img-${index + 2}`), type: 'image' as const,
      usage: 'context' as const,
      ...(figure.imageData ? { base64: String(figure.imageData) } : {}),
      ...(figure.url ? { url: String(figure.url) } : {}),
      alt: String(figure.description || context.figureDescription || `Imagem ${index + 2} do contexto.`),
      sourcePage: typeof figure.page === 'string' || typeof figure.page === 'number' ? figure.page : context.sourcePage || context.page || null, order: index + 2,
    })),
  ].filter((asset, index, all) => all.findIndex((candidate) => candidate.tempId === asset.tempId) === index);
  let body = String(content.text || context.text || '').replace(/\[FIGURA:\s*([-\w]+)\]/gi, '[image:$1]').trim();
  assets.forEach((asset) => { const marker = `[image:${asset.tempId}]`; if (!body.includes(marker)) body = [body, marker].filter(Boolean).join('\n\n'); });
  return {
    tempId: context.tempId, type: context.questionNumbers.length > 1 ? 'shared' : 'individual', body,
    bodyClean: stripHtml(body), reference: String(content.referenceText || context.referenceText || '').trim(),
    sourcePage: context.sourcePage || context.page || null, assets, questionNumbers: context.questionNumbers,
  } as QuestionContextPayload;
});
