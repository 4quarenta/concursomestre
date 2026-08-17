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

export const PROTECTED_LAW_SENTINELS = [
  'SECRET_EDITORIAL_SENTINEL_123',
  'SECRET_SUMMARY_SENTINEL_456',
  'SECRET_BLOCK_SENTINEL_789',
  'SECRET_DOCTRINE_SENTINEL_321',
  'SECRET_JURISPRUDENCE_SENTINEL_654',
  'SECRET_SUMULA_SENTINEL_852',
  'SECRET_TIP_SENTINEL_741',
  'SECRET_PREVIOUS_TEXT_SENTINEL_987',
  'SECRET_ADMIN_SENTINEL_963',
] as const;

const feature = (featureKey: string) => ({
  feature_key: featureKey,
  requires_plan: 'Elite',
  enabled: false,
  mode: 'locked',
  fallback_mode: 'locked',
});

export const createProtectedLawPayload = () => ({
  id: 'law-security-1',
  slug: 'lei-seguranca',
  title: 'Lei de Seguranca',
  shortTitle: 'Lei de Seguranca',
  number: '1',
  date: '2026-08-13',
  summary: 'Resumo publico da norma.',
  ementa: 'Ementa publica da norma.',
  status: 'active',
  officialUrl: 'https://example.test/lei-seguranca',
  sourceName: 'Fonte oficial',
  articleCount: 1,
  commentedArticleCount: 1,
  jurisprudenceCount: 1,
  examTipCount: 1,
  accessCount: 0,
  aliases: [],
  sections: [{
    id: 'section-1',
    lawId: 'law-security-1',
    slug: 'capitulo-1',
    title: 'Capitulo I',
    articleCount: 1,
  }],
  articles: [{
    id: 'article-1',
    lawId: 'law-security-1',
    sectionId: 'section-1',
    slug: 'artigo-1',
    number: 'Art. 1o',
    text: 'Texto legal publico.',
    paragraphs: [{ number: 'Paragrafo unico', text: 'Complemento legal publico.' }],
    blocks: [{
      id: 'block-1',
      blockUid: 'block-1',
      kind: 'caput',
      label: 'Caput',
      text: 'Texto legal publico.',
      previousText: 'SECRET_PREVIOUS_TEXT_SENTINEL_987',
      notes: ['SECRET_ADMIN_SENTINEL_963'],
    }],
    comentarios: [{
      id: 'comment-1',
      articleId: 'article-1',
      title: 'Comentario',
      body: 'SECRET_EDITORIAL_SENTINEL_123',
      examFocus: [],
      pitfalls: [],
      relatedRefs: [],
      authorName: 'Professor',
      reviewedAt: '2026-08-13T12:00:00Z',
    }],
    doctrine: [{ body: 'SECRET_DOCTRINE_SENTINEL_321' }],
    jurisprudenceNotes: [{ body: 'SECRET_JURISPRUDENCE_SENTINEL_654' }],
    jurisprudencia: [{
      id: 'case-1',
      articleId: 'article-1',
      court: 'STF',
      precedentType: 'Tema',
      title: 'Julgado',
      summary: 'SECRET_JURISPRUDENCE_SENTINEL_654',
      examImpact: 'Protegido',
      isConsolidated: true,
      priority: 'high',
    }],
    sumulas: [{
      id: 'sumula-1',
      articleId: 'article-1',
      court: 'STF',
      number: '1',
      text: 'SECRET_SUMULA_SENTINEL_852',
    }],
    macete: 'SECRET_TIP_SENTINEL_741',
    examTip: 'SECRET_TIP_SENTINEL_741',
    studyModules: {
      basicComment: {
        title: 'Comentario',
        body: 'SECRET_EDITORIAL_SENTINEL_123',
        preview: 'Preview configurado',
        feature: { feature_key: 'lei.comentario_basico' },
      },
    },
  }],
  sectionEditorials: [{
    id: 'editorial-1',
    lawId: 'law-security-1',
    sectionId: 'section-1',
    sectionTitle: 'Capitulo I',
    rangeLabel: 'Art. 1o',
    articleCount: 1,
    hasContent: true,
    access: 'locked',
    summary: 'SECRET_SUMMARY_SENTINEL_456',
    blocks: [{ type: 'paragraph', content: 'SECRET_BLOCK_SENTINEL_789' }],
    doctrine: ['SECRET_DOCTRINE_SENTINEL_321'],
    jurisprudence: [{ summary: 'SECRET_JURISPRUDENCE_SENTINEL_654' }],
    sumulas: [{ text: 'SECRET_SUMULA_SENTINEL_852' }],
  }],
  teacherComments: [{ body: 'SECRET_EDITORIAL_SENTINEL_123' }],
  examTips: [{ body: 'SECRET_TIP_SENTINEL_741' }],
  syncLogs: [{ message: 'SECRET_ADMIN_SENTINEL_963' }],
  planAccess: { planName: 'Gratuito', status: 'active', isAdmin: false },
  features: {
    'lei.texto': { ...feature('lei.texto'), enabled: true, mode: 'full', fallback_mode: 'full' },
    'lei.comentario_basico': feature('lei.comentario_basico'),
    'lei.doutrina': feature('lei.doutrina'),
    'lei.macete': feature('lei.macete'),
    'lei.jurisprudencia': feature('lei.jurisprudencia'),
    'lei.sumulas': feature('lei.sumulas'),
    'lei.raiox': feature('lei.raiox'),
  },
  hasLockedFeatures: true,
  editorialAvailability: {
    commentary: { available: true, access: 'locked' },
    doctrine: { available: true, access: 'locked' },
    tips: { available: true, access: 'locked' },
    jurisprudence: { available: true, access: 'locked' },
    syllabi: { available: true, access: 'locked' },
    sectionEditorials: { available: true, access: 'locked' },
  },
  userComments: [],
  updates: [],
});

export const unlockProtectedLawPayload = () => {
  const payload = createProtectedLawPayload();
  Object.values(payload.features).forEach((state) => {
    state.enabled = true;
    state.mode = 'full';
  });
  payload.sectionEditorials[0].access = 'full';
  return payload;
};
