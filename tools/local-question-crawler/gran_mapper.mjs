/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved.
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { createHash } from 'node:crypto';

const GRAN_ASSET_ORIGIN = 'https://arquivos.infra-questoes.grancursosonline.com.br';
const GRAN_ALLOWED_ASSET_HOST_SUFFIX = '.grancursosonline.com.br';

const asArray = (value) => (Array.isArray(value) ? value : []);

const readText = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const decodeEntities = (value) => String(value || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#0*39;/gi, "'")
  .replace(/&#x0*27;/gi, "'");

export const cleanPlainText = (value) => decodeEntities(
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<\/li\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)
  .replace(/[\t\r ]+/g, ' ')
  .replace(/\n\s+/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

export const sanitizeRichText = (value) => String(value || '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<(script|style|iframe|object|embed|form|input|button|meta|link)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
  .replace(/<(script|style|iframe|object|embed|form|input|button|meta|link)\b[^>]*\/?>/gi, '')
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '')
  .trim();

const slugify = (value) => cleanPlainText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const safeTempPart = (value, fallback) => slugify(value) || fallback;

const isAllowedGranAssetUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && (
      parsed.hostname === 'grancursosonline.com.br'
      || parsed.hostname.endsWith(GRAN_ALLOWED_ASSET_HOST_SUFFIX)
    );
  } catch {
    return false;
  }
};

const resolveGranAssetUrl = (value) => {
  const path = readText(value);
  if (!path) return '';
  if (/^https:\/\//i.test(path)) return isAllowedGranAssetUrl(path) ? path : '';
  if (/^[a-z]+:/i.test(path)) return '';
  const resolved = `${GRAN_ASSET_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
  return isAllowedGranAssetUrl(resolved) ? resolved : '';
};

const collectInlineAssets = (value, prefix, usage, sourcePage) => {
  const assets = [];
  let index = 0;
  const body = sanitizeRichText(value).replace(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi, (tag, _quote, src) => {
    const url = resolveGranAssetUrl(src);
    if (!url) return '';
    index += 1;
    const tempId = `${prefix}_img_${index}`;
    const altMatch = tag.match(/\balt\s*=\s*(["'])(.*?)\1/i);
    assets.push({
      tempId,
      type: 'image',
      usage,
      url,
      base64: '',
      alt: cleanPlainText(altMatch?.[2] || 'Imagem vinculada ao conteudo.'),
      caption: '',
      sourcePage,
      order: index,
    });
    return `[image:${tempId}]`;
  });
  return { body, assets };
};

const appendStandaloneAssets = (assets, rawQuestion, prefix, usage, sourcePage) => {
  const candidates = [];
  const rawFile = rawQuestion?.arquivo;
  if (typeof rawFile === 'string') candidates.push(rawFile);
  if (rawFile && typeof rawFile === 'object') {
    candidates.push(rawFile.caminho, rawFile.url, rawFile.path);
  }
  asArray(rawQuestion?.imagens).forEach((image) => {
    if (typeof image === 'string') candidates.push(image);
    if (image && typeof image === 'object') candidates.push(image.caminho, image.url, image.path);
  });

  const knownUrls = new Set(assets.map((asset) => asset.url));
  candidates.forEach((candidate) => {
    const url = resolveGranAssetUrl(candidate);
    if (!url || knownUrls.has(url)) return;
    const order = assets.length + 1;
    assets.push({
      tempId: `${prefix}_img_${order}`,
      type: 'image',
      usage,
      url,
      base64: '',
      alt: 'Imagem vinculada ao conteudo.',
      caption: '',
      sourcePage,
      order,
    });
    knownUrls.add(url);
  });
};

const readEntityLabel = (value) => {
  if (typeof value === 'string' || typeof value === 'number') return readText(value);
  if (!value || typeof value !== 'object') return '';
  return readText(value.sigla, value.nome, value.name, value.descricao, value['descrição'], value.label);
};

const taxonomyItems = (values) => {
  const seen = new Set();
  return asArray(values).flatMap((value) => {
    const label = readEntityLabel(value);
    const normalized = cleanPlainText(label);
    const slug = slugify(normalized);
    if (!normalized || !slug || seen.has(slug)) return [];
    seen.add(slug);
    return [{ label: normalized, slug }];
  });
};

const scalarTaxonomyItems = (values) => taxonomyItems(
  asArray(values).length ? values : [values],
);

const resolveLevel = (question) => {
  const proof = asArray(question?.provas)[0] || question?.prova || {};
  return readEntityLabel(
    question?.escolaridade
      || question?.nivel
      || question?.nivel_questao
      || question?.formacao
      || proof?.nivel
      || proof?.escolaridade
      || question?.escolaridade_nome,
  );
};

const resolveSubjectHierarchy = (question) => {
  const explicitSubject = readText(
    question?.materia_questao,
    readEntityLabel(question?.disciplina),
    question?.materia_nome,
  );
  const rawTopics = asArray(question?.assuntos)
    .map((item) => readEntityLabel(item))
    .filter(Boolean);
  const unique = [...new Set(rawTopics.map(cleanPlainText).filter(Boolean))];

  if (!explicitSubject && unique.length > 0) {
    return {
      subjects: taxonomyItems([unique[0]]),
      topics: taxonomyItems(unique.slice(1, 2)),
      subtopics: taxonomyItems(unique.slice(2)),
    };
  }

  return {
    subjects: taxonomyItems(explicitSubject ? [explicitSubject] : []),
    topics: taxonomyItems(unique.slice(0, 1)),
    subtopics: taxonomyItems(unique.slice(1)),
  };
};

const resolveQuestionNumber = (question) => {
  for (const value of [
    question?.numero_questao,
    question?.numero,
    question?.question_number,
    question?.ordem,
  ]) {
    if (Number.isInteger(Number(value)) && Number(value) > 0) return Number(value);
  }
  return null;
};

const resolveSourcePage = (question) => {
  for (const value of [question?.pagina, question?.page, question?.source_page]) {
    if (Number.isInteger(Number(value)) && Number(value) > 0) return Number(value);
  }
  return null;
};

const resolveDifficulty = (value) => {
  const normalized = cleanPlainText(value).toLowerCase();
  if (normalized === '1' || normalized.includes('facil')) return 'easy';
  if (normalized === '3' || normalized.includes('dificil')) return 'hard';
  return 'medium';
};

const resolveQuestionType = (alternatives, rawType) => {
  const type = cleanPlainText(readEntityLabel(rawType)).toLowerCase();
  const labels = alternatives.map((alternative) => cleanPlainText(alternative.text).toLowerCase());
  if (
    type.includes('certo')
    || type.includes('errado')
    || (alternatives.length === 2 && labels.some((label) => label === 'certo') && labels.some((label) => label === 'errado'))
  ) {
    return 'true_false';
  }
  return 'single_choice';
};

const mapAlternatives = (question, questionTempId, sourcePage) => {
  const rawAlternatives = asArray(question?.itens).length
    ? asArray(question.itens)
    : asArray(question?.alternativas).length
      ? asArray(question.alternativas)
      : asArray(question?.alternativas_questao);
  const correctRawId = question?.resposta ?? question?.resposta_id ?? question?.gabarito;
  const correctAlternativeTempIds = [];

  const alternatives = rawAlternatives.map((alternative, index) => {
    const label = readText(alternative?.rotulo, alternative?.label, String.fromCharCode(65 + index)).toUpperCase();
    const tempId = `${questionTempId}_alt_${safeTempPart(label, String(index + 1))}`;
    const inline = collectInlineAssets(
      readText(alternative?.corpo, alternative?.texto_alternativa, alternative?.texto, alternative?.text),
      tempId,
      'alternative',
      sourcePage,
    );
    appendStandaloneAssets(inline.assets, alternative, tempId, 'alternative', sourcePage);
    const rawId = alternative?.id ?? alternative?.id_item ?? alternative?.alternative_id;
    const isCorrect = Boolean(
      alternative?.is_correto
      || alternative?.correto
      || alternative?.gabarito
      || (correctRawId != null && rawId != null && String(correctRawId) === String(rawId))
      || (typeof correctRawId === 'string' && correctRawId.trim().toUpperCase() === label),
    );
    if (isCorrect) correctAlternativeTempIds.push(tempId);
    return {
      tempId,
      order: index + 1,
      label,
      text: inline.body,
      textClean: cleanPlainText(inline.body),
      assets: inline.assets,
    };
  });

  return { alternatives, correctAlternativeTempIds };
};

const resolveSupportText = (question) => {
  const parts = asArray(question?.textos_questao)
    .map((item) => readText(item?.texto, item?.body, item?.text))
    .filter(Boolean);
  if (parts.length) return parts.join('<br><br>');
  return readText(question?.texto_questao, question?.supportText, question?.support_text);
};

const resolveGroup = (question) => question?.grupo_questao || question?.grupoQuestao || null;

const resolveContextBody = (group) => {
  if (!group || typeof group !== 'object') return '';
  const statement = readText(group.enunciado, group.statement);
  const body = readText(group.texto, group.body, group.text);
  if (cleanPlainText(statement) === cleanPlainText(body)) return sanitizeRichText(statement);
  return [statement, body].filter(Boolean).map(sanitizeRichText).join('<br><br>');
};

const resolveContextKey = (group) => {
  if (!group || typeof group !== 'object') return '';
  const id = readText(group.id, group.id_grupo, group.grupo_id, group.external_key);
  const body = resolveContextBody(group);
  if (!id && !body) return '';
  return `gran_ctx_${safeTempPart(id, createHash('sha256').update(body).digest('hex').slice(0, 16))}`;
};

const buildContext = (group, tempId, sourcePage) => {
  const inline = collectInlineAssets(resolveContextBody(group), tempId, 'context', sourcePage);
  appendStandaloneAssets(inline.assets, group, tempId, 'context', sourcePage);
  return {
    tempId,
    type: 'shared',
    body: inline.body,
    bodyClean: cleanPlainText(inline.body),
    reference: readText(group?.referencia, group?.reference, group?.fonte),
    sourcePage,
    assets: inline.assets,
    questionNumbers: [],
  };
};

const createReviewReasons = (question) => {
  const reasons = ['coleta_externa_requer_revisao'];
  if (!question.content.statementClean) reasons.push('enunciado_ausente');
  if (!question.alternatives.length) reasons.push('alternativas_ausentes');
  if (!question.answer.correctAlternativeTempIds.length) reasons.push('gabarito_ausente');
  if (question.assets.some((asset) => asset.url)) reasons.push('asset_externo_requer_localizacao');
  return reasons;
};

const mapQuestion = (rawQuestion, index, contextTempId, contextBodyClean) => {
  const externalId = readText(rawQuestion?.id_questao, rawQuestion?.id, rawQuestion?.question_id);
  const tempId = `gran_q_${safeTempPart(externalId, String(index + 1))}`;
  const questionNumber = resolveQuestionNumber(rawQuestion);
  const sourcePage = resolveSourcePage(rawQuestion);
  const statementInline = collectInlineAssets(
    readText(rawQuestion?.enunciado, rawQuestion?.statement),
    tempId,
    'statement',
    sourcePage,
  );
  const supportInline = collectInlineAssets(
    resolveSupportText(rawQuestion),
    `${tempId}_support`,
    'support',
    sourcePage,
  );
  const assets = [...statementInline.assets, ...supportInline.assets];
  appendStandaloneAssets(assets, rawQuestion, tempId, 'statement', sourcePage);
  const { alternatives, correctAlternativeTempIds } = mapAlternatives(rawQuestion, tempId, sourcePage);
  const hierarchy = resolveSubjectHierarchy(rawQuestion);
  const level = resolveLevel(rawQuestion);
  const years = asArray(rawQuestion?.anos).length ? rawQuestion.anos : [rawQuestion?.ano];
  const editorials = [];
  const supportTextClean = cleanPlainText(supportInline.body);
  const supportDuplicatesContext = Boolean(
    contextTempId
    && contextBodyClean
    && supportTextClean
    && (
      supportTextClean === contextBodyClean
      || (supportTextClean.length >= 20 && contextBodyClean.includes(supportTextClean))
    ),
  );
  const teacherComment = readText(rawQuestion?.comentario_professor, rawQuestion?.comentario_texto);
  const detailedComment = readText(rawQuestion?.resolucao_texto, rawQuestion?.texto_resolucao, rawQuestion?.analise_detalhada);
  if (teacherComment) editorials.push({ type: 'teacher_comment', title: '', body: sanitizeRichText(teacherComment), status: 'draft' });
  if (detailedComment) editorials.push({ type: 'detailed_analysis', title: '', body: sanitizeRichText(detailedComment), status: 'draft' });

  const question = {
    tempId,
    id: null,
    source: {
      origin: 'authorized_local_collection',
      examId: null,
      questionNumber,
      contextTempId: contextTempId || null,
      sourcePage,
      externalId: externalId || null,
      provider: 'gran',
    },
    content: {
      statement: statementInline.body,
      statementClean: cleanPlainText(statementInline.body),
      supportText: supportDuplicatesContext ? '' : supportInline.body,
      reference: readText(rawQuestion?.referencia, rawQuestion?.reference, rawQuestion?.fonte),
    },
    assets,
    filters: {
      subjects: hierarchy.subjects,
      topics: hierarchy.topics,
      subtopics: hierarchy.subtopics,
      examBoards: taxonomyItems(rawQuestion?.bancas),
      organizations: taxonomyItems(rawQuestion?.orgaos),
      roles: taxonomyItems(rawQuestion?.cargos),
      careers: taxonomyItems(rawQuestion?.carreiras),
      years: scalarTaxonomyItems(years.filter(Boolean)),
      levels: taxonomyItems(level ? [level] : []),
      examTypes: taxonomyItems(rawQuestion?.tipos_prova || rawQuestion?.tiposProva || []),
    },
    type: resolveQuestionType(alternatives, rawQuestion?.tipo || rawQuestion?.modalidade || rawQuestion?.tipo_questao),
    difficulty: resolveDifficulty(rawQuestion?.dificuldade),
    alternatives,
    answer: {
      mode: correctAlternativeTempIds.length > 1 ? 'multiple' : 'single',
      raw: correctAlternativeTempIds.length === 1
        ? alternatives.find((alternative) => alternative.tempId === correctAlternativeTempIds[0])?.label || ''
        : '',
      correctAlternativeTempIds,
    },
    editorial: editorials,
    publication: {
      status: 'draft',
      visibility: 'private',
      scheduledAt: null,
    },
    review: {
      required: true,
      status: 'pending',
      reasons: [],
    },
  };
  question.review.reasons = createReviewReasons(question);
  return question;
};

export const extractGranRows = (payload) => {
  if (!payload || typeof payload !== 'object') return [];
  for (const candidate of [
    payload?.data?.rows,
    payload?.data?.items,
    payload?.rows,
    payload?.itens,
    payload?.items,
    payload?.results,
  ]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
};

export const extractGranPagination = (payload) => ({
  total: Number(payload?.data?.total ?? payload?.total ?? 0) || 0,
  pages: Number(payload?.data?.pages ?? payload?.data?.totalPaginas ?? payload?.pages ?? 0) || 0,
});

export const validateQuestionImportPayload = (payload) => {
  const errors = [];
  if (payload?.schemaVersion !== 'question-import.v2') errors.push('schemaVersion invalido');
  if (!Array.isArray(payload?.contexts)) errors.push('contexts deve ser uma lista');
  if (!Array.isArray(payload?.questions)) errors.push('questions deve ser uma lista');
  const ids = new Set();
  asArray(payload?.questions).forEach((question, index) => {
    if (!question?.tempId) errors.push(`questions[${index}] sem tempId`);
    if (ids.has(question?.tempId)) errors.push(`tempId duplicado: ${question?.tempId}`);
    ids.add(question?.tempId);
    if (!Array.isArray(question?.alternatives)) errors.push(`questions[${index}].alternatives invalido`);
    if (question?.publication?.status !== 'draft') errors.push(`questions[${index}] deve iniciar em rascunho`);
  });
  return errors;
};

export const mapGranBatchToQuestionImport = (rawQuestions, metadata = {}) => {
  const uniqueQuestions = [];
  const seen = new Set();
  asArray(rawQuestions).forEach((question) => {
    const identity = readText(question?.id_questao, question?.id, question?.question_id)
      || createHash('sha256').update(JSON.stringify([
        cleanPlainText(question?.enunciado),
        asArray(question?.itens).map((item) => cleanPlainText(item?.corpo)),
      ])).digest('hex');
    if (seen.has(identity)) return;
    seen.add(identity);
    uniqueQuestions.push(question);
  });

  const contextsById = new Map();
  const questionContextKeys = new Map();
  uniqueQuestions.forEach((question) => {
    const group = resolveGroup(question);
    const contextKey = resolveContextKey(group);
    if (!contextKey) return;
    questionContextKeys.set(question, contextKey);
    if (!contextsById.has(contextKey)) {
      contextsById.set(contextKey, buildContext(group, contextKey, resolveSourcePage(question)));
    }
    const questionNumber = resolveQuestionNumber(question);
    if (questionNumber) contextsById.get(contextKey).questionNumbers.push(questionNumber);
  });

  const questions = uniqueQuestions.map((question, index) => mapQuestion(
    question,
    index,
    questionContextKeys.get(question) || null,
    questionContextKeys.has(question)
      ? contextsById.get(questionContextKeys.get(question))?.bodyClean || ''
      : '',
  ));
  const contexts = [...contextsById.values()].map((context) => ({
    ...context,
    questionNumbers: [...new Set(context.questionNumbers)].sort((a, b) => a - b),
  }));
  const numberedQuestions = questions.map((question) => question.source.questionNumber).filter(Number.isInteger);

  return {
    schemaVersion: 'question-import.v2',
    import: {
      sourceType: 'authorized_local_collection',
      extractionMode: 'gran_network_capture',
      status: 'draft',
      diagnostics: [
        `Coleta local autorizada: ${questions.length} questao(oes).`,
        'Todo item exige revisao editorial antes da publicacao.',
      ],
    },
    exam: {
      id: metadata.examId ?? null,
      title: readText(metadata.title),
      agency: metadata.agency ?? null,
      organizations: asArray(metadata.organizations),
      roles: asArray(metadata.roles),
      focuses: asArray(metadata.focuses),
      year: metadata.year ? Number(metadata.year) : null,
      level: metadata.level ?? null,
      examType: metadata.examType ?? null,
      booklet: {
        type: null,
        color: null,
        name: null,
      },
      questionRange: {
        start: numberedQuestions.length ? Math.min(...numberedQuestions) : null,
        end: numberedQuestions.length ? Math.max(...numberedQuestions) : null,
        total: questions.length,
      },
    },
    contexts,
    questions,
  };
};
