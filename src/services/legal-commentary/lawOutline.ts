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

import type {
  ArticleJurisprudence,
  LawArticle,
  LegalArticleSyllabus,
  LegalRichContentBlock,
  TeacherComment,
} from '@types';

export type LawSectionSummary = {
  id: string;
  sectionKey?: string;
  title: string;
  fromArticle: string;
  toArticle: string;
  articles: number;
  primaryArticleId: string;
  articleIds: string[];
  isFavorite: boolean;
};

export type LawSectionEditorial = {
  sectionKey: string;
  sectionTitle: string;
  rangeLabel: string;
  articleCount: number;
  importance?: string;
  style?: string;
  summary: string;
  blocks?: LegalRichContentBlock[];
  examFocus: string[];
  examFocusText?: string;
  keywords?: string[];
  avoidRepetitionNote?: string;
  macetes: string[];
  doctrine: string[];
  jurisprudence: ArticleJurisprudence[];
  sumulas: LegalArticleSyllabus[];
  highlights: Array<{
    articleId: string;
    articleNumber: string;
    title: string;
    excerpt: string;
  }>;
};

type ParsedArticleNumber = {
  major: number;
  suffix: string;
};

type KnownLawOutlineRange = {
  title: string;
  fromArticle: string;
  toArticle: string;
};

const MARIA_DA_PENHA_OUTLINE: KnownLawOutlineRange[] = [
  { fromArticle: '1', toArticle: '4', title: 'Disposicoes preliminares' },
  { fromArticle: '5', toArticle: '6', title: 'Disposicoes gerais' },
  { fromArticle: '7', toArticle: '7', title: 'Formas de violencia domestica e familiar' },
  { fromArticle: '8', toArticle: '8', title: 'Medidas integradas de prevencao' },
  { fromArticle: '9', toArticle: '9', title: 'Assistencia a mulher em situacao de violencia domestica e familiar' },
  { fromArticle: '10', toArticle: '12-C', title: 'Atendimento pela autoridade policial' },
  { fromArticle: '13', toArticle: '17', title: 'Disposicoes gerais dos procedimentos' },
  { fromArticle: '18', toArticle: '21', title: 'Medidas protetivas de urgencia' },
  { fromArticle: '22', toArticle: '22-A', title: 'Medidas protetivas que obrigam o agressor' },
  { fromArticle: '23', toArticle: '24', title: 'Medidas protetivas a ofendida' },
  { fromArticle: '24-A', toArticle: '24-A', title: 'Descumprimento de medidas protetivas de urgencia' },
  { fromArticle: '25', toArticle: '26', title: 'Atuacao do Ministerio Publico' },
  { fromArticle: '27', toArticle: '28', title: 'Assistencia judiciaria' },
  { fromArticle: '29', toArticle: '32', title: 'Equipe de atendimento multidisciplinar' },
  { fromArticle: '33', toArticle: '33', title: 'Disposicoes transitorias' },
  { fromArticle: '34', toArticle: '46', title: 'Disposicoes finais' },
];

const LEI_9784_OUTLINE: KnownLawOutlineRange[] = [
  { fromArticle: '1', toArticle: '2', title: 'Das disposicoes gerais' },
  { fromArticle: '3', toArticle: '3', title: 'Dos direitos dos administrados' },
  { fromArticle: '4', toArticle: '4', title: 'Dos deveres do administrado' },
  { fromArticle: '5', toArticle: '8', title: 'Do inicio do processo' },
  { fromArticle: '9', toArticle: '10', title: 'Dos interessados' },
  { fromArticle: '11', toArticle: '17', title: 'Da competencia' },
  { fromArticle: '18', toArticle: '21', title: 'Dos impedimentos e da suspeicao' },
  { fromArticle: '22', toArticle: '25', title: 'Da forma, tempo e lugar dos atos do processo' },
  { fromArticle: '26', toArticle: '28', title: 'Da comunicacao dos atos' },
  { fromArticle: '29', toArticle: '47', title: 'Da instrucao' },
  { fromArticle: '48', toArticle: '49', title: 'Do dever de decidir' },
  { fromArticle: '49-A', toArticle: '49-G', title: 'Da decisao coordenada' },
  { fromArticle: '50', toArticle: '50', title: 'Da motivacao' },
  { fromArticle: '51', toArticle: '52', title: 'Da desistencia e outros casos de extincao do processo' },
  { fromArticle: '53', toArticle: '55', title: 'Da anulacao, revogacao e convalidacao' },
  { fromArticle: '56', toArticle: '65', title: 'Do recurso administrativo e da revisao' },
  { fromArticle: '66', toArticle: '67', title: 'Dos prazos' },
  { fromArticle: '68', toArticle: '68', title: 'Das sancoes' },
  { fromArticle: '69', toArticle: '70', title: 'Das disposicoes finais' },
];

const KNOWN_LAW_OUTLINES_BY_KEY: Record<string, KnownLawOutlineRange[]> = {
  'law-maria-penha': MARIA_DA_PENHA_OUTLINE,
  'lei-maria-da-penha': MARIA_DA_PENHA_OUTLINE,
  'lei-11-340-2006': MARIA_DA_PENHA_OUTLINE,
  'lei-11-340-06': MARIA_DA_PENHA_OUTLINE,
  'lei-11340-2006': MARIA_DA_PENHA_OUTLINE,
  'lei-11340': MARIA_DA_PENHA_OUTLINE,
  'lei-9-784-1999': LEI_9784_OUTLINE,
  'lei-9-784': LEI_9784_OUTLINE,
  'lei-9784-1999': LEI_9784_OUTLINE,
  'lei-9784': LEI_9784_OUTLINE,
  '9-784': LEI_9784_OUTLINE,
};

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const normalizeSectionSlug = (value: unknown) => normalizeText(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const getArticleNumber = (article: LawArticle) => String(article.number || article.numero || '').trim();

const compactText = (value: unknown) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

const shortenText = (value: unknown, limit = 180) => {
  const text = compactText(value);
  if (text === '') {
    return '';
  }

  return text.length > limit
    ? `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
    : text;
};

const uniqueStrings = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  const items: string[] = [];

  values.forEach((value) => {
    const text = compactText(value);
    if (!text) {
      return;
    }

    const key = normalizeText(text);
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push(text);
  });

  return items;
};

const uniqueByKey = <T>(items: T[], getKey: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeText(getKey(item));
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const getArticleThemeLabel = (article: LawArticle) => compactText(
  article.hierarchy?.resolvedAssunto
  || article.hierarchy?.chapterLabel
  || article.hierarchy?.chapter
  || article.hierarchy?.resolvedSubtopic
  || article.hierarchy?.titleLabel
  || article.hierarchy?.title
  || article.title
  || article.titulo
  || '',
);

const getArticleExcerpt = (article: LawArticle): string => {
  const blockText = Array.isArray(article.blocks)
    ? article.blocks
      .map((block) => compactText(block.text))
      .filter(Boolean)
      .join(' ')
    : '';

  const rawText = blockText || compactText(article.text || article.texto || '');
  return shortenText(rawText, 180);
};

const getArticleMaceteCandidates = (article: LawArticle): string[] => {
  const teacherComments = Array.isArray(article.comentarios) ? article.comentarios : [];
  const commentSignals = teacherComments.flatMap((comment: TeacherComment) => [
    ...uniqueStrings(comment.examFocus || []),
    ...uniqueStrings(comment.pitfalls || []),
    shortenText(comment.body, 150),
  ]);

  return uniqueStrings([
    article.macete,
    article.examTip,
    ...commentSignals.filter((value) => /macete|pegadinha|cuidado|memor/i.test(normalizeText(value))),
  ]);
};

const getArticleDoctrine = (article: LawArticle): string[] => {
  const doctrine = Array.isArray(article.doutrina) ? article.doutrina : (Array.isArray(article.doctrine) ? article.doctrine : []);
  return uniqueStrings(doctrine);
};

const getArticleJurisprudence = (article: LawArticle): ArticleJurisprudence[] => {
  return uniqueByKey(
    Array.isArray(article.jurisprudencia) ? article.jurisprudencia : [],
    (item) => `${item.court}|${item.title}|${item.summary}`,
  );
};

const getArticleSumulas = (article: LawArticle): LegalArticleSyllabus[] => {
  return uniqueByKey(
    Array.isArray(article.sumulas) ? article.sumulas : (Array.isArray(article.syllabi) ? article.syllabi : []),
    (item) => `${item.court}|${item.number}|${item.text}`,
  );
};

const buildSectionRangeLabel = (section: LawSectionSummary) => (
  section.fromArticle === section.toArticle
    ? `Art. ${section.fromArticle}`
    : `Art. ${section.fromArticle} a Art. ${section.toArticle}`
);

const collectSectionArticles = (section: LawSectionSummary, articles: LawArticle[]): LawArticle[] => {
  const sectionIds = Array.isArray(section.articleIds) && section.articleIds.length > 0
    ? new Set(section.articleIds.map((id) => String(id)))
    : null;

  return articles.filter((article) => {
    const articleId = String(article.id || '').trim();
    if (!articleId) {
      return false;
    }

    if (sectionIds) {
      return sectionIds.has(articleId);
    }

    return isArticleNumberWithinRange(
      getArticleNumber(article),
      section.fromArticle,
      section.toArticle,
    );
  });
};

export const buildSectionEditorial = (
  section: LawSectionSummary,
  articles: LawArticle[] = [],
): LawSectionEditorial => {
  const sectionArticles = collectSectionArticles(section, articles);
  const sectionKey = compactText(section.sectionKey || normalizeSectionSlug(section.title) || section.id || 'secao');
  const rangeLabel = buildSectionRangeLabel(section);
  const articleThemes = uniqueStrings(sectionArticles.map((article) => getArticleThemeLabel(article))).slice(0, 4);
  const sectionTitle = compactText(section.title || articleThemes[0] || 'Seção');

  const articleHighights = sectionArticles.slice(0, 4).map((article) => ({
    articleId: String(article.id || ''),
    articleNumber: getArticleNumber(article),
    title: getArticleThemeLabel(article) || `Art. ${getArticleNumber(article)}`,
    excerpt: getArticleExcerpt(article),
  })).filter((item) => item.articleId !== '');

  const teacherSignals = uniqueStrings(sectionArticles.flatMap((article) => {
    const comments = Array.isArray(article.comentarios) ? article.comentarios : [];
    return comments.flatMap((comment) => [
      ...uniqueStrings(comment.examFocus || []),
      ...uniqueStrings(comment.pitfalls || []),
      shortenText(comment.body, 150),
    ]);
  }));

  const macetes = uniqueStrings(sectionArticles.flatMap((article) => getArticleMaceteCandidates(article)));
  const doctrine = uniqueStrings(sectionArticles.flatMap((article) => getArticleDoctrine(article)));
  const jurisprudence = uniqueByKey(
    sectionArticles.flatMap((article) => getArticleJurisprudence(article)),
    (item) => `${item.court}|${item.title}|${item.summary}`,
  );
  const sumulas = uniqueByKey(
    sectionArticles.flatMap((article) => getArticleSumulas(article)),
    (item) => `${item.court}|${item.number}|${item.text}`,
  );

  const examFocus = uniqueStrings([
    sectionArticles.length > 1
      ? `A banca costuma comparar os artigos ${section.fromArticle} e ${section.toArticle} para trocar regra, exceção e complemento da mesma faixa.`
      : `A cobrança costuma recair na literalidade do art. ${section.fromArticle}, especialmente nos trechos que limitam, definem ou excepcionam a regra central.`,
    articleThemes.length > 1
      ? `Nesta seção, a pegadinha mais comum e inverter ${articleThemes[0]} com ${articleThemes[1]}.`
      : `A banca costuma cobrar a diferença entre o caput e os trechos que detalham a hipótese principal desta seção.`,
    ...teacherSignals.slice(0, 2),
  ]).slice(0, 4);

  const summary = articleThemes.length > 0
    ? `A seção ${rangeLabel} concentra ${articleThemes.join(', ')}. Em prova, a leitura deve ser feita como um bloco único, separando a regra central, as exceções e os complementos que aparecem nos blocos seguintes.`
    : `A seção ${rangeLabel} deve ser lida como um bloco único, com atenção ao caput, aos complementos posteriores e às exceções que a banca costuma explorar.`;

  const normalizedMacetes = macetes.length > 0
    ? macetes.slice(0, 4)
    : uniqueStrings([
      sectionArticles.length > 1
        ? `Regra no primeiro artigo, detalhe na sequência.`
        : `Leia o verbo central do dispositivo antes de qualquer exceção.`,
      `Quando a banca trocar uma palavra, geralmente mudou a resposta.`,
    ]);

  const fallbackDoctrine = doctrine.length > 0
    ? doctrine.slice(0, 4)
    : [];

  return {
    sectionKey,
    sectionTitle,
    rangeLabel,
    articleCount: sectionArticles.length,
    summary,
    examFocus,
    macetes: normalizedMacetes,
    doctrine: fallbackDoctrine,
    jurisprudence: jurisprudence.slice(0, 3),
    sumulas: sumulas.slice(0, 3),
    highlights: articleHighights,
  };
};

const normalizeLawOutlineKey = (value: unknown) => normalizeText(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const resolveKnownLawOutline = (keys: unknown | unknown[]): KnownLawOutlineRange[] | undefined => {
  const candidates = Array.isArray(keys) ? keys : [keys];

  for (const candidate of candidates) {
    const normalizedKey = normalizeLawOutlineKey(candidate);
    if (normalizedKey && KNOWN_LAW_OUTLINES_BY_KEY[normalizedKey]) {
      return KNOWN_LAW_OUTLINES_BY_KEY[normalizedKey];
    }
  }

  return undefined;
};

const parseArticleNumber = (value: unknown): ParsedArticleNumber | null => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[º°]/g, '')
    .replace(/\s+/g, '')
    .trim();
  const match = normalized.match(/(\d+)(?:-?([A-Z]+))?/);

  if (!match) {
    return null;
  }

  const major = Number(match[1]);
  if (!Number.isFinite(major)) {
    return null;
  }

  return {
    major,
    suffix: match[2] || '',
  };
};

const compareArticleNumber = (left: ParsedArticleNumber, right: ParsedArticleNumber) => {
  if (left.major !== right.major) {
    return left.major - right.major;
  }

  return left.suffix.localeCompare(right.suffix, 'pt-BR');
};

export const isArticleNumberWithinRange = (articleNumber: unknown, fromArticle?: unknown, toArticle?: unknown) => {
  const parsedArticle = parseArticleNumber(articleNumber);
  const parsedFrom = fromArticle ? parseArticleNumber(fromArticle) : null;
  const parsedTo = toArticle ? parseArticleNumber(toArticle) : null;

  if (!parsedArticle) {
    return false;
  }

  return (!parsedFrom || compareArticleNumber(parsedArticle, parsedFrom) >= 0)
    && (!parsedTo || compareArticleNumber(parsedArticle, parsedTo) <= 0);
};

const isUnstructuredSectionCollection = (sections: LawSectionSummary[], articles: LawArticle[]) => {
  if (articles.length <= 1) {
    return false;
  }

  return sections.length <= 1;
};

export const buildKnownLawOutlineSections = (
  lawKeys: unknown | unknown[],
  articles: LawArticle[] = [],
): LawSectionSummary[] => {
  const lawId = String(articles[0]?.lawId || (Array.isArray(lawKeys) ? lawKeys[0] : lawKeys) || '').trim();
  const outline = resolveKnownLawOutline(lawKeys);

  if (!outline) {
    return [];
  }

  if (articles.length === 0) {
    return outline.map((range, index) => {
      const sectionKey = normalizeSectionSlug(range.title) || `secao-${index}`;

      return {
        id: `${lawId || 'known-law'}-${sectionKey}-${index}`,
        sectionKey,
        title: range.title,
        fromArticle: range.fromArticle,
        toArticle: range.toArticle,
        articles: 0,
        primaryArticleId: '',
        articleIds: [],
        isFavorite: false,
      };
    });
  }

  return outline
    .map((range, index) => {
      const rangeArticles = articles.filter((article) => isArticleNumberWithinRange(
        getArticleNumber(article),
        range.fromArticle,
        range.toArticle,
      ));

      if (rangeArticles.length === 0) {
        return null;
      }

      const firstArticle = rangeArticles[0];
      const lastArticle = rangeArticles[rangeArticles.length - 1];
      const sectionKey = normalizeSectionSlug(range.title) || `secao-${index}`;

      return {
        id: `${lawId}-${sectionKey}-${index}`,
        sectionKey,
        title: range.title,
        fromArticle: getArticleNumber(firstArticle),
        toArticle: getArticleNumber(lastArticle),
        articles: rangeArticles.length,
        primaryArticleId: String(firstArticle.id || '').trim(),
        articleIds: rangeArticles.map((article) => String(article.id || '').trim()).filter(Boolean),
        isFavorite: rangeArticles.some((article) => Boolean(article.isFavorite)),
      };
    })
    .filter(Boolean) as LawSectionSummary[];
};

const buildHierarchyTitle = (article: LawArticle) => {
  const hierarchy = article.hierarchy || {};
  const candidates: Array<[string | null | undefined, string | null | undefined]> = [
    [hierarchy.chapterLabel, hierarchy.resolvedAssunto],
    [hierarchy.chapterLabel, hierarchy.chapter],
    [hierarchy.titleLabel, hierarchy.resolvedSubtopic],
    [hierarchy.titleLabel, hierarchy.title],
    [hierarchy.bookLabel, hierarchy.book],
    [hierarchy.partLabel, hierarchy.part],
  ];

  for (const [label, value] of candidates) {
    const normalizedLabel = String(label || '').trim();
    const normalizedValue = String(value || '').trim();

    if (normalizedLabel && normalizedValue) {
      const labelIncludesValue = normalizeText(normalizedLabel).includes(normalizeText(normalizedValue));
      return labelIncludesValue ? normalizedLabel : `${normalizedLabel} - ${normalizedValue}`;
    }

    if (normalizedLabel || normalizedValue) {
      return normalizedLabel || normalizedValue;
    }
  }

  return 'Disposicoes gerais';
};

export const buildLawSections = (articles: LawArticle[], lawKeys?: unknown | unknown[]): LawSectionSummary[] => {
  if (!Array.isArray(articles) || articles.length === 0) {
    return [];
  }

  const sections: LawSectionSummary[] = [];

  articles.forEach((article) => {
    const articleNumber = getArticleNumber(article);
    if (!articleNumber) {
      return;
    }

    const articleId = String(article.id || '').trim();
    if (!articleId) {
      return;
    }

    const sectionTitle = buildHierarchyTitle(article);
    const sectionKey = normalizeSectionSlug(sectionTitle) || 'disposicoes-gerais';
    const previousSection = sections[sections.length - 1];

    if (previousSection && normalizeSectionSlug(previousSection.title) === sectionKey) {
      previousSection.toArticle = articleNumber;
      previousSection.articles += 1;
      previousSection.articleIds.push(articleId);
      previousSection.isFavorite = previousSection.isFavorite || Boolean(article.isFavorite);
      return;
    }

    sections.push({
      id: `${sectionKey}-${sections.length}`,
      sectionKey,
      title: sectionTitle,
      fromArticle: articleNumber,
      toArticle: articleNumber,
      articles: 1,
      primaryArticleId: articleId,
      articleIds: [articleId],
      isFavorite: Boolean(article.isFavorite),
    });
  });

  const knownSections = buildKnownLawOutlineSections(
    lawKeys === undefined ? String(articles[0]?.lawId || '') : lawKeys,
    articles,
  );
  if (knownSections.length > 1 && isUnstructuredSectionCollection(sections, articles)) {
    return knownSections;
  }

  return sections;
};

export const formatSectionRange = (section: LawSectionSummary) => (
  section.fromArticle === section.toArticle
    ? `Art. ${section.fromArticle}`
    : `Art. ${section.fromArticle} ao Art. ${section.toArticle}`
);

export const formatSectionLabel = (section: LawSectionSummary, index: number) => {
  const order = String(index + 1).padStart(2, '0');
  return `${order} - ${formatSectionRange(section)} - ${section.title}`;
};
