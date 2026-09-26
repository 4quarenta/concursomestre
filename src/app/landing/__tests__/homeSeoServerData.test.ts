import { describe, expect, it } from 'vitest';
import { resolveHomeFeaturedOrganizations } from '../homeSeoServerData';
import type { LandingFeaturedOrganization } from '@types';

const configured = (overrides: Partial<LandingFeaturedOrganization> = {}): LandingFeaturedOrganization => ({
  id: 'home-org',
  filterId: 10,
  status: 'FEATURED',
  iconKey: 'building',
  enabled: true,
  order: 10,
  ...overrides,
});

describe('home SEO organization resolver', () => {
  it('keeps editorial order while using the persisted public organization slug', () => {
    const result = resolveHomeFeaturedOrganizations(
      [
        configured({ id: 'second', filterId: 20, order: 20, status: 'OPEN_NOTICE', iconKey: 'landmark' }),
        configured({ id: 'first', filterId: 10, order: 10 }),
      ],
      [
        { id: 20, name: 'Orgao Dois', slug: 'slug-persistido-2', acronym: 'O2' },
        { id: 10, name: 'Orgao Um', slug: 'slug-persistido-1', acronym: 'O1' },
      ],
    );

    expect(result.map((item) => item.slug)).toEqual(['slug-persistido-1', 'slug-persistido-2']);
    expect(result[1]).toMatchObject({ status: 'OPEN_NOTICE', statusLabel: 'Edital publicado', iconKey: 'landmark' });
  });

  it('does not fabricate a card when the selected public organization is absent or incomplete', () => {
    const result = resolveHomeFeaturedOrganizations(
      [configured({ filterId: 10 }), configured({ id: 'missing', filterId: 20, order: 20 })],
      [{ id: 10, name: 'Orgao Publico', slug: 'orgao-publico' }, { id: 20, name: 'Sem slug' }],
    );

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('orgao-publico');
  });

  it('does not resolve a free-form organization slug without a canonical filter ID', () => {
    const freeForm = { ...configured(), filterId: undefined, slug: 'policia-federal' } as unknown as LandingFeaturedOrganization;
    expect(resolveHomeFeaturedOrganizations(
      [freeForm],
      [{ id: 70, name: 'Polícia Federal', slug: 'policia-federal' }],
    )).toEqual([]);
  });

  it('prefers the local official asset and rejects external organization image URLs', () => {
    const result = resolveHomeFeaturedOrganizations(
      [configured({ filterId: 70 })],
      [{ id: 70, name: 'Polícia Federal', slug: 'policia-federal', imageUrl: 'https://example.invalid/logo.png' }],
    );

    expect(result[0].imageUrl).toBe('/assets/organizations/policia-federal.png');
    expect(resolveHomeFeaturedOrganizations(
      [configured({ filterId: 71 })],
      [{ id: 71, name: 'Órgão sem asset', slug: 'orgao-sem-asset', imageUrl: 'https://example.invalid/logo.png' }],
    )[0].imageUrl).toBeNull();
  });

  it('uses the official Polícia Federal logo for its canonical full-name slug', () => {
    const result = resolveHomeFeaturedOrganizations(
      [configured({ filterId: 97569 })],
      [{ id: 97569, name: 'Departamento da Polícia Federal', slug: 'departamento-da-policia-federal' }],
    );

    expect(result[0].imageUrl).toBe('/assets/organizations/policia-federal.png');
  });

  it('accepts a safe uploaded canonical taxonomy logo and rejects unsafe variants', () => {
    const safePath = '/uploads/admin-assets/taxonomy-logo/taxonomy-logo-20260923031414-5d96a30f5de37fa2edcb198b.png';
    const result = resolveHomeFeaturedOrganizations(
      [configured({ filterId: 97598 })],
      [{ id: 97598, name: 'Agência Brasileira de Inteligência', slug: 'agencia-brasileira-de-inteligencia', imageUrl: safePath }],
    );

    expect(result[0].imageUrl).toBe(safePath);
    for (const imageUrl of [
      '/uploads/admin-assets/taxonomy-logo/../private.png',
      '/uploads/admin-assets/taxonomy-logo/logo.png?next=/private',
      'https://example.invalid/logo.png',
    ]) {
      expect(resolveHomeFeaturedOrganizations(
        [configured({ filterId: 97598 })],
        [{ id: 97598, name: 'Órgão de teste', slug: 'orgao-de-teste', imageUrl }],
      )[0].imageUrl).toBeNull();
    }
  });
});
