import { describe, expect, it } from 'vitest';
import { renderQuestionContentWithAssets } from '../questionAssetRenderer';

describe('question asset renderer', () => {
  it('replaces canonical image markers without duplicating the referenced asset', () => {
    const html = renderQuestionContentWithAssets(
      '<p>Observe [image:img_1] e responda.</p>',
      [{
        tempId: 'img_1',
        type: 'image',
        usage: 'statement',
        url: 'https://cdn.example.test/question.png',
        alt: 'Grafico da questao',
      }],
    );

    expect(html).toContain('<img');
    expect(html).toContain('https://cdn.example.test/question.png');
    expect(html).toContain('Grafico da questao');
    expect(html).not.toContain('[image:img_1]');
    expect((html.match(/<img/g) || [])).toHaveLength(1);
  });

  it('renders an asset assigned to a field even when the marker is absent', () => {
    const html = renderQuestionContentWithAssets('Alternativa visual', [{
      tempId: 'alt_img',
      type: 'image',
      usage: 'alternative',
      url: '/uploads/questions/alt.png',
      alt: 'Alternativa em imagem',
    }]);

    expect(html).toContain('Alternativa visual');
    expect(html).toContain('<img');
    expect(html).toContain('alt.png');
  });

  it('does not render unsafe asset protocols', () => {
    const html = renderQuestionContentWithAssets('[image:bad]', [{
      tempId: 'bad',
      type: 'image',
      usage: 'statement',
      url: 'javascript:alert(1)',
    }]);

    expect(html).not.toContain('<img');
    expect(html).not.toContain('javascript:');
  });
});
