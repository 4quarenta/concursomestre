import { describe, expect, it } from 'vitest';
import { buildImportedContextsForPublication } from '../granReviewPublicationCore';
import { normalizeExternalAiContextPayload } from '../adminImportWorkflowPublicationCore';

describe('buildImportedContextsForPublication', () => {
  it('normaliza assets remotos de contexto sem descartar a URL', () => {
    const contexts = normalizeExternalAiContextPayload([{
      tempId: 'gran_ctx_60434',
      title: 'Texto',
      body: 'Texto [image:gran_ctx_60434_img_1]',
      questionNumbers: [1, 2],
      assets: [{
        tempId: 'gran_ctx_60434_img_1',
        type: 'image',
        usage: 'context',
        url: 'https://cdn.example.test/contexto.png',
      }],
    }]);

    expect(contexts[0].figures?.[0]?.url).toBe('https://cdn.example.test/contexto.png');
    expect(contexts[0].assets?.[0]).toEqual(expect.objectContaining({
      tempId: 'gran_ctx_60434_img_1',
      url: 'https://cdn.example.test/contexto.png',
    }));
  });

  it('preserva o asset remoto da Gran e o marcador do contexto', () => {
    const result = buildImportedContextsForPublication([{
      tempId: 'gran_ctx_60434',
      title: 'Texto compartilhado',
      text: 'Leia o texto. [image:gran_ctx_60434_img_1]',
      questionNumbers: [1, 2],
      hasFigure: true,
      figureDescription: 'Imagem do contexto',
      page: 1,
      assets: [{
        tempId: 'gran_ctx_60434_img_1',
        type: 'image',
        usage: 'context',
        url: 'https://cdn.example.test/contexto.png',
        alt: 'Imagem do contexto',
        order: 1,
      }],
    }], (context) => ({
      text: context.text,
      referenceText: context.referenceText || '',
      figures: context.figures,
    }));

    expect(result).toHaveLength(1);
    expect(result[0].body).toBe('Leia o texto. [image:gran_ctx_60434_img_1]');
    expect(result[0].assets).toEqual([
      expect.objectContaining({
        tempId: 'gran_ctx_60434_img_1',
        usage: 'context',
        url: 'https://cdn.example.test/contexto.png',
      }),
    ]);
  });

  it('nao duplica assets com o mesmo identificador', () => {
    const result = buildImportedContextsForPublication([{
      tempId: 'ctx_1',
      title: 'Contexto',
      text: 'Texto',
      questionNumbers: [1],
      hasFigure: true,
      figureDescription: '',
      page: 1,
      assets: [{ tempId: 'ctx_img_1', type: 'image', usage: 'context', url: '/uploads/ctx.png' }],
      figures: [{ figureKey: 'ctx_img_1', url: '/uploads/ctx.png' }],
    }], (context) => ({
      text: context.text,
      referenceText: '',
      figures: context.figures,
    }));

    expect(result[0].assets).toHaveLength(1);
    expect(result[0].body?.match(/\[image:ctx_img_1\]/g)).toHaveLength(1);
  });
});
