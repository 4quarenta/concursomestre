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

import type { Banca, Cargo, ExamFileAttachment, ExamFileKind, Orgao, Prova, Question, SystemSettings } from '@types';
import { slugify } from '../database/slugify';

const toText = (value: unknown) => String(value ?? '').trim();

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toRecord = (value: unknown): Record<string, unknown> | null => (
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
);

const toTextList = (value: unknown) => {
  const values = Array.isArray(value) ? value : toText(value).split(/\s*\/\s*|[,;\n]/);

  return values
    .map((item) => {
      const record = toRecord(item);
      return record
        ? toText(record.descricao ?? record['descrição'] ?? record.name ?? record.nome ?? record.sigla)
        : toText(item);
    })
    .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);
};

const dedupeTextList = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const normalizeTaxonomyKey = (value: unknown) => toText(value)
  .toLocaleLowerCase('pt-BR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const toRecordList = (...values: unknown[]) => values.flatMap((value) => (
  Array.isArray(value) ? value : []
)).map(toRecord).filter((item): item is Record<string, unknown> => Boolean(item));

const readTaxonomyRecordLabel = (record: Record<string, unknown> | null) => toText(
  record?.descricao
  ?? record?.['descrição']
  ?? record?.name
  ?? record?.nome
  ?? record?.sigla,
);

const findTaxonomyRecordByLabel = (
  records: Record<string, unknown>[],
  label: string,
) => {
  const key = normalizeTaxonomyKey(label);
  return records.find((record) => {
    const candidates = [
      record.descricao,
      record['descrição'],
      record.name,
      record.nome,
      record.sigla,
    ];
    return candidates.some((candidate) => normalizeTaxonomyKey(candidate) === key);
  }) || null;
};

const parseRecordJson = (value: unknown): Record<string, unknown> | null => {
  const directRecord = toRecord(value);
  if (directRecord) {
    return directRecord;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    return toRecord(JSON.parse(value));
  } catch {
    return null;
  }
};

const readExamMetadataRecord = (record: Record<string, unknown>) => {
  const metadata = parseRecordJson(record.metadata ?? record.metadataJson ?? record.metadata_json) || {};
  const rawMetadata = toRecord(metadata.raw) || {};

  return {
    ...metadata,
    ...rawMetadata,
  };
};

const pickRecordValue = (
  record: Record<string, unknown>,
  metadata: Record<string, unknown>,
  keys: string[],
) => {
  for (const key of keys) {
    const value = record[key] ?? metadata[key];
    if (String(value ?? '').trim() !== '') {
      return value;
    }
  }

  return undefined;
};

const EXAM_FILE_KIND_LABELS: Record<ExamFileKind, string> = {
  edital: 'Edital',
  gabarito: 'Gabarito',
  prova: 'Prova',
  outro: 'Outro',
};

const normalizeExamFileKind = (value: unknown): ExamFileKind | '' => {
  const raw = toText(value).toLowerCase();
  if (raw === 'edital') return 'edital';
  if (raw === 'gabarito' || raw === 'answer-key' || raw === 'answer_key') return 'gabarito';
  if (raw === 'prova' || raw === 'proof' || raw === 'exam') return 'prova';
  if (raw === 'outro' || raw === 'other') return 'outro';
  return '';
};

const readExamFileNameFromUrl = (url: string, fallback: string) => {
  const cleanUrl = toText(url).split('?')[0].split('#')[0];
  const fileName = cleanUrl.split('/').filter(Boolean).pop() || '';
  try {
    return decodeURIComponent(fileName) || fallback;
  } catch {
    return fileName || fallback;
  }
};

const normalizeExamFileAttachment = (
  value: unknown,
  fallbackKind?: ExamFileKind,
): ExamFileAttachment | null => {
  const record = toRecord(value);
  const rawUrl = record
    ? toText(record.url ?? record.fileUrl ?? record.file_url ?? record.href)
    : toText(value);
  const kind = normalizeExamFileKind(record?.kind ?? record?.type ?? fallbackKind);

  if (!rawUrl || !kind) {
    return null;
  }

  const name = toText(record?.name ?? record?.fileName ?? record?.file_name)
    || readExamFileNameFromUrl(rawUrl, EXAM_FILE_KIND_LABELS[kind]);

  return {
    id: toText(record?.id) || undefined,
    kind,
    type: kind,
    label: toText(record?.label) || EXAM_FILE_KIND_LABELS[kind],
    name,
    url: rawUrl,
    mimeType: toText(record?.mimeType ?? record?.mime_type),
    size: toNumber(record?.size, 0) || undefined,
    version: toNumber(record?.version ?? record?.versao, 0) || undefined,
    versao: toNumber(record?.versao ?? record?.version, 0) || undefined,
    visibilityStatus: toText(record?.visibilityStatus ?? record?.visibility_status),
    uploadedByUserId: toText(record?.uploadedByUserId ?? record?.uploaded_by_user_id) || null,
    uploadedAt: toText(record?.uploadedAt ?? record?.uploaded_at),
    archivedAt: toText(record?.archivedAt ?? record?.archived_at) || null,
  };
};

const normalizeExamFiles = (rawRecord: Record<string, unknown>, metadataRecord: Record<string, unknown>) => {
  const candidates: Array<unknown> = [
    ...(Array.isArray(rawRecord.files) ? rawRecord.files : []),
    ...(Array.isArray(rawRecord.examFiles) ? rawRecord.examFiles : []),
    ...(Array.isArray(metadataRecord.files) ? metadataRecord.files : []),
    ...(Array.isArray(metadataRecord.examFiles) ? metadataRecord.examFiles : []),
  ];
  [
    ['prova', rawRecord.pdfUrl ?? rawRecord.pdf_url ?? rawRecord.proofUrl ?? metadataRecord.pdfUrl ?? metadataRecord.pdf_url ?? metadataRecord.proofUrl],
    ['edital', rawRecord.editalUrl ?? rawRecord.edital_url ?? metadataRecord.editalUrl ?? metadataRecord.edital_url],
    ['gabarito', rawRecord.gabaritoUrl ?? rawRecord.gabarito_url ?? rawRecord.answerKeyUrl ?? metadataRecord.gabaritoUrl ?? metadataRecord.gabarito_url ?? metadataRecord.answerKeyUrl],
  ].forEach(([kind, url]) => {
    if (toText(url)) {
      candidates.push({ kind, url });
    }
  });

  const seen = new Set<string>();
  return candidates
    .map((item) => normalizeExamFileAttachment(item))
    .filter((item): item is ExamFileAttachment => Boolean(item))
    .filter((item) => {
      const key = `${item.kind}:${item.url}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

/**
 * Normaliza um registro de prova para o formato oficial usado no admin.
 *
 * @since 1.0.0
 */
export const normalizeProvaRecord = (raw: unknown): Prova | null => {
  const rawRecord = toRecord(raw);
  if (!rawRecord) {
    return null;
  }

  const metadataRecord = readExamMetadataRecord(rawRecord);
  const id = toNumber(pickRecordValue(rawRecord, metadataRecord, [
    'id',
    'provaId',
    'prova_id',
    'exam_id',
    'publishedExamId',
    'published_exam_id',
  ]), 0);
  const nome = toText(pickRecordValue(rawRecord, metadataRecord, [
    'nome',
    'name',
    'title',
    'examTitle',
    'exam_title',
  ]));

  if (!nome) {
    return null;
  }

  const bancaRecord = toRecord(rawRecord.banca);
  const orgaoRecord = toRecord(rawRecord.orgao);
  const cargoRecord = toRecord(rawRecord.cargo);
  const organizationRecords = toRecordList(rawRecord.orgaos, metadataRecord.orgaos);
  const roleRecords = toRecordList(rawRecord.cargos, metadataRecord.cargos);
  const focusRecords = toRecordList(rawRecord.focos, rawRecord.carreiras, metadataRecord.focos, metadataRecord.carreiras);
  const focusRecord = toRecord(
    rawRecord.foco
    ?? rawRecord.carreira
    ?? (Array.isArray(rawRecord.focos) ? rawRecord.focos[0] : null)
    ?? (Array.isArray(rawRecord.carreiras) ? rawRecord.carreiras[0] : null)
    ?? metadataRecord.foco
    ?? metadataRecord.carreira
    ?? (Array.isArray(metadataRecord.focos) ? metadataRecord.focos[0] : null)
    ?? (Array.isArray(metadataRecord.carreiras) ? metadataRecord.carreiras[0] : null),
  );

  const bancaNome = toText(bancaRecord?.nome ?? bancaRecord?.name);
  const bancaSigla = toText(bancaRecord?.sigla) || bancaNome;
  const organizationList = dedupeTextList([
    ...toTextList(rawRecord.orgaos),
    ...toTextList(rawRecord.sources),
    ...toTextList(metadataRecord.orgaos),
    ...toTextList(metadataRecord.sources),
    ...toTextList(metadataRecord.source),
    ...toTextList(rawRecord.source),
  ]);
  const orgaoNome = toText(orgaoRecord?.nome ?? orgaoRecord?.name) || organizationList[0] || '';
  const orgaoSigla = toText(orgaoRecord?.sigla) || orgaoNome;
  const roleList = [
    ...toTextList(rawRecord.roles),
    ...toTextList(rawRecord.cargos),
    ...toTextList(metadataRecord.roles),
    ...toTextList(metadataRecord.cargos),
    ...toTextList(metadataRecord.role),
    ...toTextList(metadataRecord.cargo),
  ].filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);
  const cargoDescricao = roleList[0] || toText(cargoRecord?.descricao ?? cargoRecord?.['descrição'] ?? cargoRecord?.name);
  const tipoCaderno = toText(pickRecordValue(rawRecord, metadataRecord, ['tipoCaderno', 'bookletType', 'cadernoTipo']));
  const corCaderno = toText(pickRecordValue(rawRecord, metadataRecord, ['corCaderno', 'bookletColor', 'cadernoCor']));
  const caderno = toText(pickRecordValue(rawRecord, metadataRecord, ['caderno', 'booklet']))
    || [tipoCaderno, corCaderno].filter(Boolean).join(' - ');
  const files = normalizeExamFiles(rawRecord, metadataRecord);
  const proofFile = files.find((file) => file.kind === 'prova');
  const editalFile = files.find((file) => file.kind === 'edital');
  const answerKeyFile = files.find((file) => file.kind === 'gabarito');
  const requisitos = dedupeTextList([
    ...toTextList(rawRecord.requisitos),
    ...toTextList(rawRecord.requirements),
    ...toTextList(metadataRecord.requisitos),
    ...toTextList(metadataRecord.requirements),
  ]);
  const remuneracoes = dedupeTextList([
    ...toTextList(rawRecord.remuneracoes),
    ...toTextList(rawRecord.remunerations),
    ...toTextList(metadataRecord.remuneracoes),
    ...toTextList(metadataRecord.remunerations),
  ]);
  const vagas = dedupeTextList([
    ...toTextList(rawRecord.vagas),
    ...toTextList(rawRecord.vacancies),
    ...toTextList(metadataRecord.vagas),
    ...toTextList(metadataRecord.vacancies),
  ]);
  const conteudoProgramatico = dedupeTextList([
    ...toTextList(rawRecord.conteudoProgramatico),
    ...toTextList(rawRecord.programmaticContent),
    ...toTextList(metadataRecord.conteudoProgramatico),
    ...toTextList(metadataRecord.programmaticContent),
  ]);
  const requisitosDetalhados = toRecordList(
    rawRecord.requisitosDetalhados,
    rawRecord.requirementsDetailed,
    metadataRecord.requisitosDetalhados,
    metadataRecord.requirementsDetailed,
  );
  const remuneracoesDetalhadas = toRecordList(
    rawRecord.remuneracoesDetalhadas,
    rawRecord.remunerationsDetailed,
    metadataRecord.remuneracoesDetalhadas,
    metadataRecord.remunerationsDetailed,
  );
  const vagasDetalhadas = toRecordList(
    rawRecord.vagasDetalhadas,
    rawRecord.vacanciesDetailed,
    metadataRecord.vagasDetalhadas,
    metadataRecord.vacanciesDetailed,
  );
  const conteudoProgramaticoDetalhado = toRecordList(
    rawRecord.conteudoProgramaticoDetalhado,
    rawRecord.programmaticContentDetailed,
    metadataRecord.conteudoProgramaticoDetalhado,
    metadataRecord.programmaticContentDetailed,
  );
  const etapas = toRecordList(rawRecord.etapas, metadataRecord.etapas);
  const questoesVinculadas = dedupeTextList([
    ...toTextList(rawRecord.questoesVinculadas),
    ...toTextList(rawRecord.platformQuestionIds),
    ...toTextList(metadataRecord.questoesVinculadas),
    ...toTextList(metadataRecord.platformQuestionIds),
  ]);

  const banca: Banca = {
    id: toNumber(bancaRecord?.id, 0),
    sigla: bancaSigla,
    nome: bancaNome,
    name: toText(bancaRecord?.name) || bancaNome || bancaSigla,
    slug: toText(bancaRecord?.slug) || slugify(bancaNome || bancaSigla || `banca-${id}`),
    descricao: toText(bancaRecord?.descricao),
  };

  const orgao: Orgao = {
    id: toNumber(orgaoRecord?.id, 0),
    nome: orgaoNome,
    name: toText(orgaoRecord?.name) || orgaoNome || orgaoSigla,
    sigla: orgaoSigla,
    slug: toText(orgaoRecord?.slug) || slugify(orgaoNome || orgaoSigla || `orgao-${id}`),
  };
  const orgaos = (organizationList.length > 0 ? organizationList : [orgaoNome || orgaoSigla].filter(Boolean))
    .map((organization, index): Orgao => {
      const source = findTaxonomyRecordByLabel(organizationRecords, organization)
        || (index === 0 ? orgaoRecord : null);
      const sourceName = toText(source?.nome ?? source?.name) || organization;
      const sourceSigla = toText(source?.sigla) || sourceName;
      return {
        id: toNumber(source?.id, index === 0 ? orgao.id : 0),
        nome: sourceName,
        name: toText(source?.name) || sourceName,
        sigla: sourceSigla,
        slug: toText(source?.slug) || (index === 0 && orgao.slug ? orgao.slug : slugify(sourceName || `orgao-${id}-${index + 1}`)),
      };
    });

  const cargo: Cargo = {
    id: toNumber(cargoRecord?.id, 0),
    slug: toText(cargoRecord?.slug) || slugify(cargoDescricao || `cargo-${id}`),
    ['descrição']: cargoDescricao,
    descricao: cargoDescricao,
    name: toText(cargoRecord?.name) || cargoDescricao,
    parentId: (cargoRecord?.parentId ?? cargoRecord?.parent_id ?? focusRecord?.id) as string | number | undefined,
    parent_id: (cargoRecord?.parent_id ?? cargoRecord?.parentId ?? focusRecord?.id) as string | number | undefined,
  };
  const cargos = (roleList.length > 0 ? roleList : [cargoDescricao].filter(Boolean))
    .map((role, index): Cargo => {
      const source = findTaxonomyRecordByLabel(roleRecords, role)
        || (index === 0 ? cargoRecord : null);
      const sourceName = readTaxonomyRecordLabel(source) || role;
      const parentId = source?.parentId ?? source?.parent_id ?? focusRecord?.id;
      return {
        id: toNumber(source?.id, index === 0 ? cargo.id : 0),
        slug: toText(source?.slug) || (index === 0 && cargo.slug ? cargo.slug : slugify(sourceName || `cargo-${id}-${index + 1}`)),
        ['descrição']: sourceName,
        descricao: sourceName,
        name: toText(source?.name) || sourceName,
        parentId: parentId as string | number | undefined,
        parent_id: parentId as string | number | undefined,
      };
    });

  const focusName = readTaxonomyRecordLabel(focusRecord);
  const focus = focusRecord && focusName ? {
    ...focusRecord,
    id: focusRecord.id as string | number | undefined,
    nome: toText(focusRecord.nome ?? focusRecord.name) || focusName,
    name: toText(focusRecord.name ?? focusRecord.nome) || focusName,
    slug: toText(focusRecord.slug) || slugify(focusName),
  } : undefined;
  const focuses = (focusRecords.length > 0 ? focusRecords : focus ? [focus] : [])
    .map((record, index) => {
      const name = readTaxonomyRecordLabel(record) || (index === 0 ? focusName : '');
      return name ? {
        ...record,
        id: record.id as string | number | undefined,
        nome: toText(record.nome ?? record.name) || name,
        name: toText(record.name ?? record.nome) || name,
        slug: toText(record.slug) || slugify(name),
      } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    id,
    nome,
    slug: toText(pickRecordValue(rawRecord, metadataRecord, ['slug'])) || slugify(nome || `prova-${id}`),
    ano: toNumber(pickRecordValue(rawRecord, metadataRecord, ['ano', 'year']), new Date().getFullYear()),
    tipo: toNumber(rawRecord.tipo, 0),
    index: toText(rawRecord.index),
    nivel: toText(pickRecordValue(rawRecord, metadataRecord, ['nivel', 'level'])),
    caderno,
    tipoCaderno,
    corCaderno,
    bookletType: tipoCaderno,
    bookletColor: corCaderno,
    dataInscricaoInicio: toText(pickRecordValue(rawRecord, metadataRecord, ['dataInscricaoInicio', 'registrationStartDate', 'inscricaoInicio'])),
    dataInscricaoFim: toText(pickRecordValue(rawRecord, metadataRecord, ['dataInscricaoFim', 'registrationEndDate', 'inscricaoFim'])),
    dataProva: toText(pickRecordValue(rawRecord, metadataRecord, ['dataProva', 'examDate', 'provaData'])),
    valorInscricao: toText(pickRecordValue(rawRecord, metadataRecord, ['valorInscricao', 'registrationFee', 'taxaInscricao'])),
    totalQuestoes: toText(pickRecordValue(rawRecord, metadataRecord, ['totalQuestoes', 'totalQuestions', 'questionCount'])),
    etapas: etapas as Prova['etapas'],
    questoesVinculadas,
    platformQuestionIds: questoesVinculadas,
    examType: toText(pickRecordValue(rawRecord, metadataRecord, ['examType', 'exam_type', 'tipoProva'])),
    publishStatus: (toText(rawRecord.publishStatus) as Prova['publishStatus']) || 'published',
    visibilityStatus: (toText(rawRecord.visibilityStatus) as Prova['visibilityStatus']) || 'public',
    scheduledAt: toText(rawRecord.scheduledAt),
    pdfUrl: proofFile?.url || toText(pickRecordValue(rawRecord, metadataRecord, ['pdfUrl', 'pdf_url', 'proofUrl'])),
    proofUrl: proofFile?.url || toText(pickRecordValue(rawRecord, metadataRecord, ['proofUrl', 'pdfUrl', 'pdf_url'])),
    editalUrl: editalFile?.url || toText(pickRecordValue(rawRecord, metadataRecord, ['editalUrl', 'edital_url'])),
    gabaritoUrl: answerKeyFile?.url || toText(pickRecordValue(rawRecord, metadataRecord, ['gabaritoUrl', 'gabarito_url', 'answerKeyUrl'])),
    answerKeyUrl: answerKeyFile?.url || toText(pickRecordValue(rawRecord, metadataRecord, ['answerKeyUrl', 'gabaritoUrl', 'gabarito_url'])),
    files,
    examFiles: files,
    banca,
    orgao,
    orgaos,
    cargo,
    cargos,
    foco: focus,
    focos: focuses,
    carreira: focus,
    carreiras: focuses,
    roles: cargos.map((item) => item.descricao || item.name || item['descrição']).filter(Boolean),
    requisitos,
    requirements: requisitos,
    requisitosDetalhados: requisitosDetalhados as Prova['requisitosDetalhados'],
    requirementsDetailed: requisitosDetalhados as Prova['requirementsDetailed'],
    remuneracoes,
    remunerations: remuneracoes,
    remuneracoesDetalhadas: remuneracoesDetalhadas as Prova['remuneracoesDetalhadas'],
    remunerationsDetailed: remuneracoesDetalhadas as Prova['remunerationsDetailed'],
    vagas,
    vacancies: vagas,
    vagasDetalhadas: vagasDetalhadas as Prova['vagasDetalhadas'],
    vacanciesDetailed: vagasDetalhadas as Prova['vacanciesDetailed'],
    conteudoProgramatico,
    programmaticContent: conteudoProgramatico,
    conteudoProgramaticoDetalhado: conteudoProgramaticoDetalhado as Prova['conteudoProgramaticoDetalhado'],
    programmaticContentDetailed: conteudoProgramaticoDetalhado as Prova['programmaticContentDetailed'],
  };
};

/**
 * Une banco salvo e provas embutidas nas questoes.
 * O cadastro salvo no admin tem prioridade.
 *
 * @since 1.0.0
 */
export const mergeExamBankSources = (
  systemSettings: SystemSettings,
  questions: Question[] = [],
) => {
  const examMap = new Map<string, Prova>();

  const pushExam = (raw: unknown) => {
    const normalized = normalizeProvaRecord(raw);
    if (!normalized) {
      return;
    }

    examMap.set(String(normalized.id), {
      ...normalized,
      ...examMap.get(String(normalized.id)),
    });
  };

  (systemSettings.examBank || []).forEach(pushExam);
  questions.forEach((question) => {
    (question.provas || []).forEach(pushExam);
  });

  return Array.from(examMap.values()).sort((left, right) => {
    if (right.ano !== left.ano) {
      return right.ano - left.ano;
    }

    return left.nome.localeCompare(right.nome, 'pt-BR');
  });
};

/**
 * Texto curto de exibicao da prova.
 *
 * @since v1.0.0
 */
export const formatProvaLabel = (prova: Prova) => {
  const banca = toText(prova.banca?.sigla || prova.banca?.nome);
  const name = toText(prova.nome);
  const year = Number(prova.ano || 0);
  const shouldShowYear = year > 0 && !new RegExp(`(^|\\D)${year}(\\D|$)`).test(name);
  const normalizedName = name.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizedBanca = banca.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const shouldShowBanca = Boolean(banca) && !normalizedName.includes(normalizedBanca);
  return `${name}${shouldShowYear ? ` (${year})` : ''}${shouldShowBanca ? ` - ${banca}` : ''}`.trim();
};

/**
 * Texto usado na busca do seletor e da lista.
 *
 * @since v1.0.0
 */
export const buildProvaSearchText = (prova: Prova) => (
  [
    prova.id,
    prova.nome,
    prova.ano,
    prova.nivel,
    prova.index,
    prova.caderno,
    prova.tipoCaderno,
    prova.corCaderno,
    prova.bookletType,
    prova.bookletColor,
    prova.examType,
    prova.banca?.sigla,
    prova.banca?.nome,
    prova.orgao?.sigla,
    prova.orgao?.nome,
    ...(prova.orgaos || []).flatMap((orgao) => [orgao.sigla, orgao.nome, orgao.name]),
    prova.cargo?.descricao,
    prova.cargo?.['descrição'],
  ]
    .map((item) => toText(item).toLowerCase())
    .join(' ')
);

/**
 * Verifica se uma questao esta vinculada a uma prova especifica.
 *
 * @since v1.0.0
 */
export const isQuestionLinkedToProva = (question: Question, provaId: string | number) => {
  const normalizedId = String(provaId);
  return String(question.provaId ?? '') === normalizedId
    || (question.provas || []).some((prova) => String(prova?.id ?? '') === normalizedId);
};

/**
 * Atualiza a representacao local da prova dentro da questao.
 *
 * @since v1.0.0
 */
export const applyProvaToQuestion = (question: Question, prova: Prova): Question => {
  const nextProvas = (question.provas || []).filter((item) => String(item?.id ?? '') !== String(prova.id));
  nextProvas.push(prova);

  return {
    ...question,
    provaId: prova.id,
    provas: nextProvas,
  };
};

/**
 * Remove a vinculacao da prova da questao.
 *
 * @since v1.0.0
 */
export const removeProvaFromQuestion = (question: Question, provaId: string | number): Question => ({
  ...question,
  provaId: String(question.provaId ?? '') === String(provaId) ? undefined : question.provaId,
  provas: (question.provas || []).filter((item) => String(item?.id ?? '') !== String(provaId)),
});
