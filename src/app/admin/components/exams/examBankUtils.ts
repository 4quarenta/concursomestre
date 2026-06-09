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
};

const normalizeExamFileKind = (value: unknown): ExamFileKind | '' => {
  const raw = toText(value).toLowerCase();
  if (raw === 'edital') return 'edital';
  if (raw === 'gabarito' || raw === 'answer-key' || raw === 'answer_key') return 'gabarito';
  if (raw === 'prova' || raw === 'proof' || raw === 'exam') return 'prova';
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
    kind,
    label: toText(record?.label) || EXAM_FILE_KIND_LABELS[kind],
    name,
    url: rawUrl,
    mimeType: toText(record?.mimeType ?? record?.mime_type),
    size: toNumber(record?.size, 0) || undefined,
    uploadedAt: toText(record?.uploadedAt ?? record?.uploaded_at),
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

  if (!id || !nome) {
    return null;
  }

  const bancaRecord = toRecord(rawRecord.banca);
  const orgaoRecord = toRecord(rawRecord.orgao);
  const cargoRecord = toRecord(rawRecord.cargo);

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
    .map((organization, index): Orgao => ({
      id: index === 0 ? orgao.id : 0,
      nome: organization,
      name: organization,
      sigla: organization,
      slug: index === 0 && orgao.slug ? orgao.slug : slugify(organization || `orgao-${id}-${index + 1}`),
    }));

  const cargo: Cargo = {
    id: toNumber(cargoRecord?.id, 0),
    slug: toText(cargoRecord?.slug) || slugify(cargoDescricao || `cargo-${id}`),
    ['descrição']: cargoDescricao,
    descricao: cargoDescricao,
    name: toText(cargoRecord?.name) || cargoDescricao,
  };
  const cargos = (roleList.length > 0 ? roleList : [cargoDescricao].filter(Boolean))
    .map((role, index): Cargo => ({
      id: index === 0 ? cargo.id : 0,
      slug: index === 0 && cargo.slug ? cargo.slug : slugify(role || `cargo-${id}-${index + 1}`),
      ['descrição']: role,
      descricao: role,
      name: role,
    }));

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
    roles: cargos.map((item) => item.descricao || item.name || item['descrição']).filter(Boolean),
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
  return `${prova.nome} ${prova.ano ? `(${prova.ano})` : ''}${banca ? ` - ${banca}` : ''}`.trim();
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
