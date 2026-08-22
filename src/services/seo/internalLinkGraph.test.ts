import { describe, expect, it } from 'vitest';
import graphJson from '../../../config/seo/internal-link-graph.v1.json';
import pageMapJson from '../../../config/seo/seo-production-page-map.v1.json';
import { internalLinkGraph, validateInternalLinkGraph } from './internalLinkGraph';

describe('Internal Link Graph v1', () => {
  it('valida o contrato versionado contra o Production Page Map', () => {
    expect(validateInternalLinkGraph(graphJson)).toEqual(expect.objectContaining({ valid: true, errors: [] }));
    expect(internalLinkGraph.version).toBe('internal-link-graph.v1');
    expect(internalLinkGraph.families).toHaveLength(44);
    expect(internalLinkGraph.approvedRelations).toHaveLength(67);
    expect(internalLinkGraph.rejectedInferences).toHaveLength(9);
  });

  it('mantem cada rota canonica alinhada ao Production Page Map', () => {
    const pageFamilies = new Map(pageMapJson.families.map((family) => [family.familyId, family]));
    for (const family of internalLinkGraph.families) {
      expect(pageFamilies.get(family.familyId)?.routePatterns).toContain(family.canonicalRoute);
    }
  });

  it('exige autoridade explicita e limites finitos para cada relacao', () => {
    for (const relation of internalLinkGraph.approvedRelations) {
      expect(relation.authority.trim()).not.toBe('');
      expect(relation.ssr).toBe(true);
      expect(relation.maxLinks).toBeGreaterThan(0);
      expect(relation.maxLinks).toBeLessThanOrEqual(100);
    }
  });

  it('preserva Tag e Marketplace como permanent noindex', () => {
    const families = new Map(pageMapJson.families.map((family) => [family.familyId, family]));
    expect(families.get('blog_tag')?.familyEligibility).toBe('PERMANENT_NOINDEX');
    expect(families.get('marketplace')?.familyEligibility).toBe('PERMANENT_NOINDEX');
  });

  it('inventaria todas as familias publicas ativas e pilotos relevantes', () => {
    const ids = new Set(internalLinkGraph.families.map((family) => family.familyId));
    const expected = [
      'home', 'questions_hub', 'question_detail', 'discipline_hub', 'discipline_detail',
      'topic_detail', 'subject_detail', 'board_hub', 'board_detail', 'organizations_hub',
      'organization_detail', 'exam_hub', 'exam_detail', 'contest_hub', 'contest_detail',
      'open_contests', 'careers_hub', 'career_detail', 'positions_hub', 'position_detail',
      'simulations_hub', 'simulation_detail', 'law_hub', 'law_detail', 'law_article_detail',
      'materials_hub', 'material_detail', 'marketplace', 'blog_hub', 'blog_article',
      'blog_category', 'blog_tag', 'blog_author', 'plans', 'faq', 'news', 'support',
      'elite', 'ranking', 'privacy', 'terms', 'marketing_landing', 'search', 'facet',
    ];
    expected.forEach((family) => expect(ids.has(family), family).toBe(true));
  });

  it('rejeita inferencias que fabricariam relacoes canonicas', () => {
    expect(internalLinkGraph.rejectedInferences).toContain('name_or_slug_similarity');
    expect(internalLinkGraph.rejectedInferences).toContain('organization_board_position_year_as_contest_identity');
    expect(internalLinkGraph.rejectedInferences).toContain('post_to_domain_entity_by_text');
  });

  it('falha quando uma relacao aponta para familia ausente', () => {
    const invalid = structuredClone(graphJson);
    invalid.approvedRelations[0].targetFamily = 'future_family';
    expect(validateInternalLinkGraph(invalid).valid).toBe(false);
  });
});
