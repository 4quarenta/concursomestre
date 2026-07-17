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

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

export type ExtractedScopedNoticeItem = {
  id?: string;
  scopeType: 'geral' | 'orgao' | 'cargo' | 'foco';
  scope: string;
  chave?: string;
  texto: string;
};

export type ExtractedProgrammaticNoticeItem = {
  id?: string;
  materia?: string;
  topico?: string;
  assunto?: string;
  questoes?: string;
  orgao?: string;
  cargo?: string;
  foco?: string;
};

export type ExtractedStageNoticeItem = {
  id?: string;
  nome: string;
  criterio: 'eliminatorio' | 'classificatorio' | 'eliminatorio_classificatorio';
  data?: string;
  descricao?: string;
};

export interface ExtractedExamNoticeMetadata {
  rawText: string;
  agency?: string;
  agencyName?: string;
  year?: string;
  organizations: string[];
  roles: string[];
  requirements: string[];
  requirementsDetailed: ExtractedScopedNoticeItem[];
  remunerations: string[];
  remunerationsDetailed: ExtractedScopedNoticeItem[];
  vacancies: string[];
  vacanciesDetailed: ExtractedScopedNoticeItem[];
  programmaticContent: string[];
  programmaticContentDetailed: ExtractedProgrammaticNoticeItem[];
  stages: ExtractedStageNoticeItem[];
  registrationStart?: string;
  registrationEnd?: string;
  examDate?: string;
  registrationFee?: string;
  totalQuestions?: string;
}

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;

const loadPdfJsModule = async (): Promise<PdfJsModule> => {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((module) => {
      module.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();

      return module;
    });
  }

  return pdfJsModulePromise;
};

const normalizeLine = (value: string) => value
  .replace(/\s+/g, ' ')
  .replace(/\s+([,.;:])/g, '$1')
  .trim();

const normalizeForSearch = (value: string) => normalizeLine(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase();

const dedupe = (values: string[]) => {
  const seen = new Set<string>();

  return values
    .map(normalizeLine)
    .filter((value) => {
      const key = normalizeForSearch(value);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const splitListValue = (value: string) => value
  .split(/\s*(?:,|;|\bou\b|\be\b|\/)\s*/i)
  .map(normalizeLine)
  .filter((item) => item.length >= 2);

const canonicalOrganization = (value: string) => {
  const normalized = normalizeForSearch(value).replace(/[^A-Z0-9-]/g, '');
  if (normalized === 'PMPB') return 'PM-PB';
  if (normalized === 'CBMPB') return 'CBM-PB';
  if (/^POLICIA MILITAR(?: DO ESTADO DA PARAIBA)?$/.test(normalizeForSearch(value))) return 'PM-PB';
  if (/^CORPO DE BOMBEIROS MILITAR(?: DO ESTADO DA PARAIBA)?$/.test(normalizeForSearch(value))) return 'CBM-PB';
  if (/^POLICIA MILITAR.*PMPB/.test(normalizeForSearch(value))) return 'PM-PB';
  if (/^CORPO DE BOMBEIROS MILITAR.*CBMPB/.test(normalizeForSearch(value))) return 'CBM-PB';
  return normalizeLine(value);
};

const isLikelyOrganizationName = (value: string) => {
  const normalized = normalizeForSearch(value);
  if (!normalized || normalized.length < 3 || normalized.length > 120) {
    return false;
  }

  if (/\b(ADITIVO|EDITAL|CANDIDATO|CANDIDATOS|COMISSAO|COMISSOES|COORDENADORAS|DIARIO OFICIAL|ENDERECOS|ELETRONICOS|WWW|HTTP|LEI|ARTIGO|INCISO|CONSTITUICAO|CONSTITUCIONAL|CUMPRIMENTO|DISPOSTO|HARMONIA|PUBLICA-SE|VAGA|VAGAS|CARGO|CARGOS|REQUISITO|REQUISITOS|INSCRICAO|INSCRICOES|REMUNERACAO|ANEXO|CONTEUDO PROGRAMATICO|DEFESA SOCIAL|SEGURANCA)\b/.test(normalized)) {
    return false;
  }

  return /\b(POLICIA|POLICIA MILITAR|CORPO DE BOMBEIROS|BOMBEIROS MILITAR|TRIBUNAL|MINISTERIO PUBLICO|DEFENSORIA|SECRETARIA DE ESTADO|PREFEITURA|CAMARA MUNICIPAL|ASSEMBLEIA LEGISLATIVA)\b/.test(normalized)
    || /\b(?:PM-?[A-Z]{2}|CBM-?[A-Z]{2}|PMPB|CBMPB|PC-?[A-Z]{2}|TJ-?[A-Z]{2}|TRT-?\d{1,2}|TRE-?[A-Z]{2}|TCE-?[A-Z]{2}|MP-?[A-Z]{2}|DPE-?[A-Z]{2}|SEFAZ-?[A-Z]{2}|SEDUC-?[A-Z]{2}|SEE-?[A-Z]{2}|SEAP-?[A-Z]{2}|SEJUSP-?[A-Z]{2}|PRF|PF|PCDF|PMDF)\b/.test(normalized);
};

const findSectionLines = (
  lines: string[],
  startPatterns: RegExp[],
  endPatterns: RegExp[],
  includeStart = false,
) => {
  const startIndex = lines.findIndex((line) => startPatterns.some((pattern) => pattern.test(normalizeForSearch(line))));
  if (startIndex < 0) {
    return [];
  }

  const bodyStartIndex = includeStart ? startIndex : startIndex + 1;
  const relativeEndIndex = lines.slice(bodyStartIndex).findIndex((line) => (
    endPatterns.some((pattern) => pattern.test(normalizeForSearch(line)))
  ));
  const endIndex = relativeEndIndex >= 0 ? bodyStartIndex + relativeEndIndex : lines.length;

  return lines.slice(bodyStartIndex, endIndex).map(normalizeLine).filter(Boolean);
};

const extractWindowValues = (lines: string[], startIndex: number, labelPattern: RegExp, maxLines = 3) => {
  const values: string[] = [];
  const firstLine = lines[startIndex] || '';
  const inlineValue = normalizeLine(firstLine.replace(labelPattern, ''));

  if (inlineValue && inlineValue.length <= 180) {
    values.push(...splitListValue(inlineValue));
  }

  for (let offset = 1; offset <= maxLines; offset += 1) {
    const line = lines[startIndex + offset] || '';
    if (!line || /^(CAPITULO|TITULO|SECAO|ANEXO|CRONOGRAMA|INSCRICOES|DAS?\s+)/.test(normalizeForSearch(line))) {
      break;
    }
    if (line.length <= 180) {
      values.push(...splitListValue(line));
    }
  }

  return values;
};

const KNOWN_AGENCIES = [
  'CEBRASPE',
  'CESPE',
  'FGV',
  'FCC',
  'VUNESP',
  'IBFC',
  'IBADE',
  'EXATUS',
  'IDECAN',
  'QUADRIX',
  'INSTITUTO AOCP',
  'AOCP',
  'INEP',
];

const extractAgency = (text: string) => {
  const searchableText = normalizeForSearch(text);
  const direct = KNOWN_AGENCIES.find((agency) => searchableText.includes(normalizeForSearch(agency)));
  if (direct) {
    return { agency: direct, agencyName: direct };
  }

  const match = text.match(/(?:banca|organizadora|executora|realizacao|realização)\s*:?\s*([A-ZÁÀÃÉÊÍÓÔÕÚÇ][^\n.]{2,90})/i);
  const value = normalizeLine(match?.[1] || '');

  return value ? { agency: value, agencyName: value } : {};
};

const extractYear = (text: string) => {
  const contextMatch = text.match(/(?:edital|concurso|certame|cfsd)[^\n]{0,80}\b(20\d{2}|19\d{2})\b/i);
  if (contextMatch?.[1]) {
    return contextMatch[1];
  }

  const years = Array.from(text.matchAll(/\b(20\d{2}|19\d{2})\b/g)).map((match) => match[1]);
  const currentYear = new Date().getFullYear() + 1;

  return years.find((year) => Number(year) >= 1990 && Number(year) <= currentYear);
};

const extractOrganizations = (lines: string[]) => {
  const values: string[] = [];
  const headText = lines.slice(0, 120).join('\n');
  const vacancyLines = findSectionLines(lines, [
    /^\d+\.?\s*DAS?\s+VAGAS\b/,
    /^\d+\.?\s*DAS?\s+VAGAS\s*\/\s*CARGOS\b/,
    /^VAGAS\s*\/\s*CARGOS\b/,
  ], [
    /^\d+\.?\s+DAS?\s+INSCRICOES\b/,
    /^\d+\.?\s+DO\s+PERIODO\b/,
    /^\d+\.?\s+DA\s+INSCRICAO\b/,
    /^\d+\.?\s+DOS?\s+REQUISITOS\b/,
    /^\d+\.?\s+DAS?\s+ETAPAS\b/,
  ], true);
  const vacancyText = vacancyLines.join('\n');
  const candidateText = [vacancyText, headText].filter(Boolean).join('\n');
  const searchableCandidateText = normalizeForSearch(candidateText);

  const acronymMatches = candidateText.match(/\b(?:PM-?PB|PMPB|CBM-?PB|CBMPB|PC-?[A-Z]{2}|TJ-?[A-Z]{2}|TRT-?\d{1,2}|TRE-?[A-Z]{2}|TCE-?[A-Z]{2}|MP-?[A-Z]{2}|DPE-?[A-Z]{2}|SEFAZ-?[A-Z]{2}|SEDUC-?[A-Z]{2}|SEE-?[A-Z]{2}|SEAP-?[A-Z]{2}|SEJUSP-?[A-Z]{2}|PRF|PF|PCDF|PMDF)\b/gi) || [];
  values.push(...acronymMatches.map(canonicalOrganization));

  const phrasePatterns = [
    /\bPol[ií]cia\s+Militar(?:\s*\((?:PM-?PB|PMPB)\))?(?:\s+do\s+Estado\s+da\s+Para[ií]ba)?/gi,
    /\bCorpo\s+de\s+Bombeiros\s+Militar(?:\s*\((?:CBM-?PB|CBMPB)\))?(?:\s+do\s+Estado\s+da\s+Para[ií]ba)?/gi,
    /\bPol[ií]cia\s+Civil(?:\s+do\s+Estado\s+de\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç\s-]+)?/gi,
    /\bTribunal\s+de\s+Justi[cç]a(?:\s+do\s+Estado\s+de\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç\s-]+)?/gi,
    /\bMinist[eé]rio\s+P[uú]blico(?:\s+do\s+Estado\s+de\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç\s-]+)?/gi,
    /\bDefensoria\s+P[uú]blica(?:\s+do\s+Estado\s+de\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç\s-]+)?/gi,
    /\bPrefeitura\s+Municipal\s+de\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç\s-]+/gi,
  ];

  phrasePatterns.forEach((pattern) => {
    Array.from(candidateText.matchAll(pattern)).forEach((match) => {
      const candidate = normalizeLine(match[0]);
      if (isLikelyOrganizationName(candidate)) {
        values.push(candidate);
      }
    });
  });

  if (searchableCandidateText.includes('POLICIA MILITAR') || searchableCandidateText.includes('PMPB')) {
    values.push('PM-PB');
  }
  if (searchableCandidateText.includes('CORPO DE BOMBEIROS') || searchableCandidateText.includes('CBMPB')) {
    values.push('CBM-PB');
  }

  lines.forEach((line, index) => {
    const searchableLine = normalizeForSearch(line);
    if (!/\bORGAO(S)?\b|\bINSTITUICAO(ES)?\b/.test(searchableLine)) {
      return;
    }

    const windowValues = extractWindowValues(lines, index, /.*?(?:org[aã]o(?:s)?|institui[cç][aã]o(?:es)?)\s*:?\s*/i, 2);
    windowValues.forEach((candidate) => {
      if (isLikelyOrganizationName(candidate)) {
        values.push(candidate);
      }
    });
  });

  return dedupe(values.map(canonicalOrganization).filter(isLikelyOrganizationName)).slice(0, 8);
};
const extractRoles = (lines: string[]) => {
  const values: string[] = [];
  const vacancyLines = findSectionLines(lines, [
    /^\d+\.?\s*DAS?\s+VAGAS/,
    /^\d+\.?\s*DAS?\s+VAGAS\s*\/\s*CARGOS/,
  ], [
    /^\d+\.?\s+DAS?\s+INSCRICOES/,
    /^\d+\.?\s+DO\s+PERIODO/,
    /^\d+\.?\s+DA\s+INSCRICAO/,
  ], true);
  const vacancyText = vacancyLines.join('\n');
  const rolePatterns = [
    /Soldado\s+PM\s*\n?\s*Combatentes\s*[-–]\s*QPC/gi,
    /Soldado\s+BM\s*\n?\s*Combatentes\s*[-–]\s*QBMP\s*[-–]\s*0/gi,
  ];

  rolePatterns.forEach((pattern) => {
    Array.from(vacancyText.matchAll(pattern)).forEach((match) => {
      values.push(normalizeLine(match[0].replace(/\s*\n\s*/g, ' ')));
    });
  });

  lines.forEach((line, index) => {
    const searchableLine = normalizeForSearch(line);
    if (/\bCARGO(S)?\b|\bEMPREGO(S)?\b|\bFUNCAO(ES)?\b|\bESPECIALIDADE(S)?\b/.test(searchableLine)) {
      values.push(...extractWindowValues(lines, index, /.*?(?:cargo(?:s)?|emprego(?:s)?|fun[cç][aã]o(?:es)?|especialidade(?:s)?)\s*:?\s*/i, 4));
    }
  });

  return dedupe(values)
    .filter((value) => !/^(total|vagas|cadastro|remuneracao|remuneração|requisito)$/i.test(value))
    .slice(0, 30);
};

const extractVacancies = (lines: string[]) => {
  const vacancyLines = findSectionLines(lines, [
    /^\d+\.?\s*DAS?\s+VAGAS\b/,
    /^\d+\.?\s*DAS?\s+VAGAS\s*\/\s*CARGOS\b/,
    /^VAGAS\b/,
  ], [
    /^\d+\.?\s+DAS?\s+INSCRICOES\b/,
    /^\d+\.?\s+DO\s+PERIODO\b/,
    /^\d+\.?\s+DA\s+INSCRICAO\b/,
    /^\d+\.?\s+DOS?\s+REQUISITOS\b/,
  ], true);

  const values: string[] = [];
  let currentVacancyOwner = '';
  const normalizedLines = vacancyLines
    .map(normalizeLine)
    .filter(Boolean)
    .filter((line) => !/^\d+(?:\.\d+)?\s+DAS?\s+VAGAS(?:\s*\/\s*CARGOS)?$/i.test(line))
    .filter((line) => !/^(CARGO|CARGOS|ORGAO|ORGAOS|VAGA|VAGAS|TOTAL|SEXO|AMPLA CONCORRENCIA|CADASTRO RESERVA)$/i.test(normalizeForSearch(line)));

  const cleanedOwner = (value: string) => normalizeLine(value
    .replace(/\b(?:sendo|para\s+o|para\s+a|destinadas?|reservadas?)\b.*$/i, '')
    .replace(/\b(?:do|da|de)\s*$/i, '')
    .replace(/[.;:,]+$/g, ''));

  const pushVacancy = (scope: string, amount: string, suffix = 'vagas', updateOwner = true) => {
    const cleanScope = cleanedOwner(scope);
    const cleanAmount = normalizeLine(amount);
    if (!cleanScope || !cleanAmount) return;
    if (normalizeForSearch(cleanScope).length < 3) return;
    values.push(`${cleanScope}: ${cleanAmount} ${suffix}`);
    if (updateOwner) {
      currentVacancyOwner = cleanScope;
    }
  };

  normalizedLines.forEach((line, index) => {
    const compactLine = normalizeLine(line);
    const searchableLine = normalizeForSearch(compactLine);
    const previousLine = normalizeLine(normalizedLines[index - 1] || '');
    const nextLine = normalizeLine(normalizedLines[index + 1] || '');
    const combined = normalizeLine(`${compactLine} ${nextLine}`);
    const previousCombined = normalizeLine(`${previousLine} ${compactLine}`);

    if (!/\b(VAGA|VAGAS|CADASTRO RESERVA|CR)\b/.test(searchableLine)) {
      const genderOnlyMatch = compactLine.match(/\b(\d{1,6})\b(?:\s*\([^)]+\))?\s+para\s+o\s+sexo\s+(Masculino|Feminino)\b/i);
      if (genderOnlyMatch?.[1] && genderOnlyMatch?.[2] && currentVacancyOwner) {
        pushVacancy(`${currentVacancyOwner} - ${genderOnlyMatch[2]}`, genderOnlyMatch[1], 'vagas', false);
      }
      return;
    }

    const tableMatch = compactLine.match(/^(.{3,90}?)\s*[:\-]\s*(\d{1,6})\s+(?:vaga|vagas)\b(?:\s*(?:\+|e)\s*(?:CR|cadastro\s+reserva))?/i);
    if (tableMatch?.[1] && tableMatch?.[2]) {
      const hasReserve = /\b(?:CR|cadastro\s+reserva)\b/i.test(compactLine);
      pushVacancy(tableMatch[1], tableMatch[2], hasReserve ? 'vagas + cadastro reserva' : 'vagas');
      return;
    }

    const offersMatch = combined.match(/\b(?:oferece|ofertam?|disponibiliza|disponibilizam|destina(?:m)?)\s+(\d{1,6})\b(?:\s*\([^)]+\))?\s+(?:vaga|vagas)\s+para\s+(?:a|o|os|as)?\s*([^,.;]+?)(?:\s*,|\s+sendo|\s+distribu|\s+destinad|\.|$)/i);
    if (offersMatch?.[1] && offersMatch?.[2]) {
      pushVacancy(offersMatch[2], offersMatch[1]);
    }

    const directMatch = compactLine.match(/\b(\d{1,6})\b(?:\s*\([^)]+\))?\s+(?:vaga|vagas)\s+para\s+(?:a|o|os|as)?\s*([^,.;]+?)(?:\s*,|\s+sendo|\s+distribu|\s+destinad|\.|$)/i);
    if (directMatch?.[1] && directMatch?.[2]) {
      const directScope = normalizeLine(directMatch[2]);
      const genderScope = directScope.match(/^sexo\s+(Masculino|Feminino)$/i)?.[1];
      if (genderScope && currentVacancyOwner) {
        pushVacancy(`${currentVacancyOwner} - ${genderScope}`, directMatch[1], 'vagas', false);
      } else {
        pushVacancy(directScope, directMatch[1]);
      }
    }

    Array.from(previousCombined.matchAll(/\b(\d{1,6})\b(?:\s*\([^)]+\))?\s+para\s+o\s+sexo\s+(Masculino|Feminino)\b/gi)).forEach((match) => {
      if (match[1] && match[2] && currentVacancyOwner) {
        pushVacancy(`${currentVacancyOwner} - ${match[2]}`, match[1], 'vagas', false);
      }
    });

    if (/\b(?:cadastro\s+reserva|CR)\b/i.test(compactLine) && !/\d{1,6}\s+(?:vaga|vagas)/i.test(compactLine)) {
      const reserveScopeMatch = compactLine.match(/(?:para\s+(?:a|o|os|as)?\s*)?([^,.;]{3,90})\s*(?:em\s+)?(?:cadastro\s+reserva|CR)\b/i);
      const reserveScope = reserveScopeMatch?.[1] || currentVacancyOwner;
      if (reserveScope) {
        values.push(`${cleanedOwner(reserveScope)}: cadastro reserva`);
      }
    }
  });

  return dedupe(values)
    .filter((value) => /\b(?:\d{1,6}\s+vagas?|cadastro\s+reserva|CR)\b/i.test(value))
    .slice(0, 30);
};

const extractRequirements = (lines: string[]) => {
  const requirementSection = findSectionLines(lines, [
    /^\d+\.?\s*DOS?\s+REQUISITOS\b/,
    /^DOS?\s+REQUISITOS\b/,
  ], [
    /^\d+\.?\s*DAS?\s+VAGAS\b/,
    /^\d+\.?\s*DAS?\s+INSCRICOES\b/,
    /^\d+\.?\s*DO\s+CONCURSO\b/,
  ]);

  if (requirementSection.length > 0) {
    const joinedItems: string[] = [];

    requirementSection.forEach((line) => {
      if (/^\d+(?:\.\d+)+\s+/.test(line) || joinedItems.length === 0) {
        joinedItems.push(line);
      } else {
        joinedItems[joinedItems.length - 1] = `${joinedItems[joinedItems.length - 1]} ${line}`;
      }
    });

    return dedupe(joinedItems)
      .filter((item) => /^\d+(?:\.\d+)+\s+/.test(item))
      .slice(0, 40);
  }

  const values: string[] = [];
  lines.forEach((line, index) => {
    const searchableLine = normalizeForSearch(line);
    if (/\bREQUISITO(S)?\b|\bESCOLARIDADE\b|\bEXIGENCIA(S)?\b|\bFORMACAO\b/.test(searchableLine)) {
      values.push(...extractWindowValues(lines, index, /.*?(?:requisito(?:s)?|escolaridade|exig[eê]ncia(?:s)?|forma[cç][aã]o)\s*:?\s*/i, 3));
    }
  });

  return dedupe(values).slice(0, 30);
};

const extractProgrammaticContent = (lines: string[]) => {
  const explicitAnnexIndex = lines.findIndex((line) => (
    /^ANEXO\s+[IVXLCDM]+\s*[-–—]?\s*CONTEUDO\s+PROGRAMATICO\s*:?$/.test(normalizeForSearch(line))
  ));
  const sectionStartIndex = explicitAnnexIndex >= 0
    ? explicitAnnexIndex
    : lines.findIndex((line) => /^CONTEUDO\s+PROGRAMATICO\s*:?$/.test(normalizeForSearch(line)));
  const section = sectionStartIndex >= 0
    ? findSectionLines(lines.slice(sectionStartIndex), [
      /^ANEXO\s+[IVXLCDM]+\s*[-–—]?\s*CONTEUDO\s+PROGRAMATICO\s*:?$/,
      /^CONTEUDO\s+PROGRAMATICO\s*:?$/,
    ], [
    /^ANEXO\s+[IVX]+\b(?!.*CONTEUDO\s+PROGRAMATICO)/,
    /^\d+\.?\s*DAS?\s+DISPOSICOES\s+FINAIS\b/,
    ], true)
    : [];

  return dedupe(section)
    .filter((line) => !/^\d+$/.test(line))
    .slice(0, 180);
};

const extractRemunerations = (text: string) => (
  dedupe(Array.from(text.matchAll(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}(?:\s*(?:a|ate|até|e)\s*R\$\s*\d{1,3}(?:\.\d{3})*,\d{2})?/gi))
    .map((match) => match[0]))
    .slice(0, 20)
);

const MONTHS_BY_NAME: Record<string, string> = {
  'JANEIRO': '01',
  'FEVEREIRO': '02',
  'MARCO': '03',
  'MARÇO': '03',
  'ABRIL': '04',
  'MAIO': '05',
  'JUNHO': '06',
  'JULHO': '07',
  'AGOSTO': '08',
  'SETEMBRO': '09',
  'OUTUBRO': '10',
  'NOVEMBRO': '11',
  'DEZEMBRO': '12',
};

const DATE_TOKEN_PATTERN = String.raw`(?:\d{1,2}[/. -]\d{1,2}[/. -]\d{2,4}|\d{1,2}\s+de\s+\p{L}+\s+de\s+\d{4})`;

const normalizeDateToken = (value: string) => {
  const token = normalizeLine(value);
  const numeric = token.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})$/);
  if (numeric) {
    const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3];
    return `${year.padStart(4, '0')}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
  }

  const longDate = token.match(/^(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(\d{4})$/iu);
  if (longDate) {
    const month = MONTHS_BY_NAME[normalizeForSearch(longDate[2])];
    if (month) {
      return `${longDate[3]}-${month}-${longDate[1].padStart(2, '0')}`;
    }
  }

  return '';
};

const collectDateMatches = (value: string) => Array.from(value.matchAll(new RegExp(DATE_TOKEN_PATTERN, 'giu')))
  .map((match) => ({
    raw: match[0],
    date: normalizeDateToken(match[0]),
    index: match.index ?? 0,
  }))
  .filter((match) => Boolean(match.date));

const extractRegistrationWindow = (text: string) => {
  const singleLine = normalizeLine(text);
  const fallback: { registrationStart?: string; registrationEnd?: string } = {};
  const windows = Array.from(singleLine.matchAll(new RegExp(
    String.raw`(?:inscri[cç][aã]o|inscri[cç][oõ]es|periodo\s+de\s+inscri[cç][aã]o|per[ií]odo\s+de\s+inscri[cç][oõ]es)[^.;]{0,700}`,
    'gi',
  ))).map((match) => ({ text: match[0], index: match.index ?? 0 }));

  for (const window of windows) {
    const dates = collectDateMatches(window.text);
    if (!dates.length) {
      continue;
    }

    if (!fallback.registrationStart) {
      fallback.registrationStart = dates[0].date;
    }

    const explicitEnd = dates.find((dateMatch, index) => {
      if (index === 0) {
        return false;
      }
      const previous = dates[index - 1];
      const betweenDates = window.text.slice(previous.index + previous.raw.length, dateMatch.index);
      const beforeDate = window.text.slice(Math.max(0, dateMatch.index - 90), dateMatch.index);

      return (
        /\b(?:a|ate|at[eé]|as|[àa]s|e)\b|[-–—]/i.test(betweenDates)
        || /\b(?:fim|final|termino|t[eé]rmino|encerramento|prazo|limite|ultimo|[úu]ltimo)\b/i.test(beforeDate)
      );
    });

    if (explicitEnd) {
      return { registrationStart: dates[0].date, registrationEnd: explicitEnd.date };
    }

    if (dates.length >= 2) {
      return { registrationStart: dates[0].date, registrationEnd: dates[1].date };
    }
  }

  const registrationAnchors = Array.from(singleLine.matchAll(/inscri[cç][aã]o|inscri[cç][oõ]es/gi));
  for (const anchor of registrationAnchors) {
    const context = singleLine.slice(Math.max(0, (anchor.index ?? 0) - 140), (anchor.index ?? 0) + 900);
    const dates = collectDateMatches(context);
    const endDate = dates.find((dateMatch) => {
      const beforeDate = context.slice(Math.max(0, dateMatch.index - 120), dateMatch.index);
      return /\b(?:ate|at[eé]|fim|final|termino|t[eé]rmino|encerramento|prazo|limite|ultimo|[úu]ltimo)\b/i.test(beforeDate);
    });

    if (endDate) {
      return {
        registrationStart: fallback.registrationStart || dates[0]?.date,
        registrationEnd: endDate.date,
      };
    }
  }

  const lineBasedDates = text.split(/\n+/)
    .map(normalizeLine)
    .filter((line) => /inscri[cç][aã]o|inscri[cç][oõ]es|prazo|limite|encerramento|termino|t[eé]rmino/i.test(line))
    .flatMap((line) => collectDateMatches(line).map((match) => ({ date: match.date, line })));

  if (lineBasedDates.length >= 2) {
    const endDate = lineBasedDates.find((item, index) => (
      index > 0 && /\b(?:ate|at[eé]|fim|final|termino|t[eé]rmino|encerramento|prazo|limite|ultimo|[úu]ltimo)\b/i.test(item.line)
    ));
    if (endDate) {
      return { registrationStart: fallback.registrationStart || lineBasedDates[0].date, registrationEnd: endDate.date };
    }
  }

  return fallback;
};
const extractExamDate = (text: string) => {
  const singleLine = normalizeLine(text);
  const windows = Array.from(singleLine.matchAll(new RegExp(
    String.raw`(?:data\s+da\s+prova|prova\s+objetiva|aplica[cç][aã]o\s+da\s+prova)[^.;]{0,220}`,
    'gi',
  ))).map((match) => match[0]);

  for (const window of windows) {
    const date = window.match(new RegExp(DATE_TOKEN_PATTERN, 'iu'))?.[0];
    const normalizedDate = date ? normalizeDateToken(date) : '';
    if (normalizedDate) {
      return normalizedDate;
    }
  }

  return '';
};

const extractRegistrationFee = (text: string) => {
  const singleLine = normalizeLine(text);
  const windows = Array.from(singleLine.matchAll(/(?:taxa|valor)\s+de\s+inscri[cç][aã]o[^.;]{0,180}/gi))
    .map((match) => match[0]);

  for (const window of windows) {
    const value = window.match(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/i)?.[0];
    if (value) {
      return normalizeLine(value);
    }
  }

  return '';
};

const extractTotalQuestions = (text: string, programmaticContent: string[]) => {
  const singleLine = normalizeLine(text);
  const explicit = singleLine.match(/(?:total\s+de|prova\s+(?:objetiva\s+)?(?:sera\s+composta\s+por|contara\s+com)|composta\s+por)\s+(\d{1,3})\s+quest(?:oes|ões)/i)?.[1];
  if (explicit) {
    return explicit;
  }

  const total = programmaticContent
    .map((line) => Number(line.match(/\b(\d{1,3})\s+quest(?:oes|ões)\b/i)?.[1] || 0))
    .reduce((sum, value) => sum + value, 0);

  return total > 0 ? String(total) : '';
};

const buildScopedItemsFromText = (values: string[], keyValue = false): ExtractedScopedNoticeItem[] => (
  dedupe(values)
    .map((line) => {
      const item = normalizeLine(line);
      const numbered = item.match(/^(\d+(?:\.\d+)*\.?)\s+(.+)$/);
      const colon = item.match(/^([^:]{2,80}):\s*(.+)$/);
      const numberedBodyColon = numbered?.[2]?.match(/^([^:]{2,80}):\s*(.+)$/);
      const chave = keyValue
        ? (numberedBodyColon?.[1] || colon?.[1] || numbered?.[1] || 'Informação')
        : (colon?.[1] || '');
      const texto = keyValue
        ? (numberedBodyColon?.[2] || colon?.[2] || numbered?.[2] || item)
        : (colon?.[2] || item);

      return {
        scopeType: 'geral' as const,
        scope: 'Todos',
        chave: normalizeLine(chave),
        texto: normalizeLine(texto),
      };
    })
    .filter((item) => item.texto)
);

const buildScopedItemsWithDetectedScope = (
  values: string[],
  knownScopes: string[],
  fallbackKey = '',
): ExtractedScopedNoticeItem[] => {
  const normalizedKnownScopes = knownScopes.map((scope) => ({ raw: scope, key: normalizeForSearch(scope) }));

  return dedupe(values).map((line) => {
    const item = normalizeLine(line);
    const colon = item.match(/^([^:]{2,90}):\s*(.+)$/);
    const possibleScope = colon?.[1] || '';
    const possibleScopeKey = normalizeForSearch(possibleScope);
    const scopeMatch = normalizedKnownScopes.find((scope) => (
      possibleScopeKey && (possibleScopeKey.includes(scope.key) || scope.key.includes(possibleScopeKey))
    ));

    const inferredScope = scopeMatch?.raw || (colon && possibleScope.length <= 90 ? possibleScope : '');

    return {
      scopeType: inferredScope ? 'cargo' as const : 'geral' as const,
      scope: inferredScope || 'Todos',
      chave: inferredScope ? fallbackKey : (colon?.[1] || fallbackKey),
      texto: normalizeLine(colon?.[2] || item),
    };
  }).filter((item) => item.texto);
};

const STAGE_NAME_PATTERN = /PROVA|EXAME|TESTE|AVALIACAO|AVALIACAO|INVESTIGACAO|ENTREGA|CURSO DE FORMACAO|SAUDE|APTIDAO|PSICOLOGIC|INTELECTUAL|SOCIAL/;

const parseStageLine = (line: string): ExtractedStageNoticeItem | null => {
  const normalized = normalizeLine(line);
  const search = normalizeForSearch(normalized);
  if (!normalized || /^(ETAPA|DESCRICAO|CRITERIO|RESPONSABILIDADE|DAS DISPOSICOES PRELIMINARES)$/i.test(search)) {
    return null;
  }
  if (/CONCURSO PUBLICO|COMISSOES COORDENADORAS|BOLSA EQUIVALENTE|SALARIO MINIMO|REMUNERACAO|R\$\s*\d|CANDIDATO|INSCRICAO/.test(search)) {
    return null;
  }

  const hasStageMarker = /^\s*\d+\s*[ªºao]\b/i.test(normalized);
  const hasStageName = STAGE_NAME_PATTERN.test(search);
  const eliminatory = /ELIMINATORI/.test(search);
  const classificatory = /CLASSIFICATORI/.test(search);
  if (!hasStageName || (!hasStageMarker && !eliminatory && !classificatory)) {
    return null;
  }

  const criterion: ExtractedStageNoticeItem['criterio'] = eliminatory && classificatory
    ? 'eliminatorio_classificatorio'
    : eliminatory
      ? 'eliminatorio'
      : 'classificatorio';
  const date = normalized.match(new RegExp(DATE_TOKEN_PATTERN, 'iu'))?.[0];
  const name = normalizeLine(normalized
    .replace(new RegExp(DATE_TOKEN_PATTERN, 'giu'), '')
    .replace(/^\s*\d+\s*[ªºao]\s*/i, '')
    .replace(/\bEliminat\S*rio\s+e\s+Classificat\S*rio\b/gi, '')
    .replace(/\bClassificat\S*rio\s+e\s+Eliminat\S*rio\b/gi, '')
    .replace(/\bEliminat\S*rio\b/gi, '')
    .replace(/\bClassificat\S*rio\b/gi, '')
    .replace(/\b(?:IBFC|PMPB|CBMPB|PM-?PB|CBM-?PB)\b/gi, '')
    .replace(/[\/]+/g, ' ')
    .replace(/(?:\s*[-–—]\s*)+$/g, ''));

  if (!name || name.length > 120 || /CONCURSO PUBLICO|COMISSOES COORDENADORAS|BOLSA EQUIVALENTE|SALARIO MINIMO/.test(normalizeForSearch(name))) {
    return null;
  }

  return {
    nome: name,
    criterio: criterion,
    data: date ? normalizeDateToken(date) : '',
    descricao: normalized,
  };
};

const extractStages = (lines: string[]): ExtractedStageNoticeItem[] => {
  const preliminaryLines = findSectionLines(lines, [
    /^\d+\.?\s*DAS?\s+DISPOSICOES\s+PRELIMINARES\b/,
    /^DAS?\s+DISPOSICOES\s+PRELIMINARES\b/,
  ], [
    /^\d+\.?\s+DOS?\s+REQUISITOS\b/,
    /^\d+\.?\s+DAS?\s+VAGAS\b/,
    /^\d+\.?\s+DAS?\s+INSCRICOES\b/,
    /^\d+\.?\s+DO\s+PERIODO\b/,
  ], true);

  const preliminarySearch = normalizeForSearch(preliminaryLines.join('\n'));
  const stageTableLikely = /\bETAPA\b/.test(preliminarySearch) && /\bCRITERIO\b/.test(preliminarySearch);
  const preferredCandidates = stageTableLikely
    ? preliminaryLines.filter((line) => /^\s*\d+\s*[ªºao]\b/i.test(line) || STAGE_NAME_PATTERN.test(normalizeForSearch(line)))
    : [];
  const fallbackCandidates = lines.filter((line) => {
    const search = normalizeForSearch(line);
    return STAGE_NAME_PATTERN.test(search) && /ELIMINATORI|CLASSIFICATORI/.test(search);
  });

  return dedupe(preferredCandidates.length > 0 ? preferredCandidates : fallbackCandidates)
    .map(parseStageLine)
    .filter((stage): stage is ExtractedStageNoticeItem => Boolean(stage))
    .slice(0, 12);
};

const isLikelyProgrammaticSubjectLine = (line: string) => {
  const title = normalizeLine(line.replace(/:\s*$/, ''));
  const search = normalizeForSearch(title);
  if (search.length < 3 || /^(ANEXO|CONTEUDO PROGRAMATICO|CONHECIMENTOS|DISCIPLINA|MATERIA|TOTAL|QUESTOES?)\b/.test(search)) {
    return false;
  }
  if (/;|\b\d{1,3}\s+QUEST/.test(search)) {
    return false;
  }
  const lettersOnly = title.replace(/\([^)]*\)/g, '').replace(/[^\p{L}]/gu, '');
  const isUppercaseTitle = lettersOnly.length >= 3 && lettersOnly === lettersOnly.toUpperCase();
  const knownMixedCaseTitle = /^(?:LINGUA (?:PORTUGUESA|ESTRANGEIRA)|NOCOES (?:BASICAS )?DE (?:INFORMATICA|DIREITO(?: CONSTITUCIONAL| PENAL| PROCESSUAL PENAL| MILITAR)?|SOCIOLOGIA)|RACIOCINIO LOGICO|GEOGRAFIA(?: DA PARAIBA)?|HISTORIA(?: DA PARAIBA)?|LEGISLACAO EXTRAVAGANTE|ATUALIDADES)$/;
  return title.length <= 90 && (isUppercaseTitle || knownMixedCaseTitle.test(search));
};

const splitProgrammaticSubjects = (value: string) => (
  value
    .split(/\s*(?:;|\u2022|\n)\s*/)
    .map((item) => normalizeLine(item.replace(/^\d+(?:\.\d+)*\s*[-.)]?\s*/, '')))
    .filter((item) => item.length >= 3)
);

const splitNumberedProgrammaticSubjects = (value: string) => {
  const normalized = normalizeLine(value);
  const markerPattern = /(\d{1,3}(?:\.\d+)*)\.\s+/g;
  const markers = Array.from(normalized.matchAll(markerPattern));

  if (markers.length === 0) {
    return { prefix: normalized, subjects: [] as string[] };
  }

  const firstMarkerIndex = markers[0].index ?? 0;
  const prefix = normalizeLine(normalized.slice(0, firstMarkerIndex));
  const subjects = markers.map((marker, index) => {
    const start = (marker.index ?? 0) + marker[0].length;
    const end = index + 1 < markers.length ? (markers[index + 1].index ?? normalized.length) : normalized.length;
    return normalizeLine(normalized.slice(start, end).replace(/[;.]\s*$/, ''));
  }).filter((subject) => subject.length >= 2);

  return { prefix, subjects };
};

const extractProgrammaticDetailed = (programmaticContent: string[]): ExtractedProgrammaticNoticeItem[] => {
  const items: ExtractedProgrammaticNoticeItem[] = [];
  let currentSubject = '';

  programmaticContent.forEach((line) => {
    const normalized = normalizeLine(line);
    if (!normalized) {
      return;
    }

    const questionCount = normalized.match(/\b(\d{1,3})\s+quest(?:oes|ões)\b/i)?.[1] || '';
    const cleaned = normalized.replace(/\b\d{1,3}\s+quest(?:oes|ões)\b/gi, '').trim();
    const cleanedSearch = normalizeForSearch(cleaned);
    if (!cleaned || /^[\W_.-]+$/.test(cleaned) || /^\d+[\W_.-]*$/.test(cleaned) || /^(ANEXO|CONTEUDO PROGRAMATICO)\b/.test(cleanedSearch)) {
      return;
    }
    const colon = cleaned.match(/^([^:]{3,90}):\s*(.+)$/);

    if (colon && isLikelyProgrammaticSubjectLine(colon[1])) {
      currentSubject = normalizeLine(colon[1]);
      const numbered = splitNumberedProgrammaticSubjects(colon[2]);
      const subjects = numbered.subjects.length > 0
        ? numbered.subjects.flatMap(splitProgrammaticSubjects)
        : splitProgrammaticSubjects(colon[2]);
      subjects.forEach((subject) => {
        items.push({ materia: currentSubject, topico: '', assunto: subject, questoes: questionCount, orgao: '', cargo: '', foco: '' });
      });
      return;
    }

    if (isLikelyProgrammaticSubjectLine(cleaned)) {
      currentSubject = normalizeLine(cleaned.replace(/:\s*$/, ''));
      return;
    }

    if (!currentSubject) {
      return;
    }

    const numbered = splitNumberedProgrammaticSubjects(cleaned);
    if (numbered.prefix && items.length > 0 && items[items.length - 1].materia === currentSubject) {
      items[items.length - 1].assunto = normalizeLine(`${items[items.length - 1].assunto} ${numbered.prefix}`);
    }
    if (numbered.subjects.length > 0) {
      numbered.subjects.flatMap(splitProgrammaticSubjects).forEach((subject) => {
        items.push({ materia: currentSubject, topico: '', assunto: subject, questoes: questionCount, orgao: '', cargo: '', foco: '' });
      });
      return;
    }

    const parts = splitProgrammaticSubjects(cleaned);
    if (parts.length > 1) {
      parts.forEach((subject) => {
        items.push({ materia: currentSubject, topico: '', assunto: subject, questoes: questionCount, orgao: '', cargo: '', foco: '' });
      });
      return;
    }

    if (items.length > 0 && items[items.length - 1].materia === currentSubject) {
      items[items.length - 1].assunto = normalizeLine(`${items[items.length - 1].assunto} ${cleaned}`);
    } else {
      items.push({ materia: currentSubject, topico: '', assunto: cleaned, questoes: questionCount, orgao: '', cargo: '', foco: '' });
    }
  });

  const seen = new Set<string>();
  return items.map((item) => ({
    ...item,
    assunto: normalizeLine(item.assunto.replace(/[.;]\s*$/, '')),
  })).filter((item) => {
    const key = normalizeForSearch([item.materia, item.topico, item.assunto, item.questoes].filter(Boolean).join('|'));
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, 220);
};

const readPdfText = async (file: File) => {
  const pdfjs = await loadPdfJsModule();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  const maxPages = pdf.numPages;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    let previousY: number | null = null;
    const pageText = textContent.items
      .map((item) => {
        const record = item as { str?: string; transform?: number[] };
        const text = String(record.str || '').trim();
        if (!text) {
          return '';
        }
        const y = Array.isArray(record.transform) ? Math.round(Number(record.transform[5] || 0)) : null;
        const separator = previousY !== null && y !== null && Math.abs(previousY - y) > 2 ? '\n' : ' ';
        previousY = y;
        return `${separator}${text}`;
      })
      .join('');
    pages.push(pageText);
  }

  return pages.join('\n');
};

export const extractExamNoticeMetadataFromText = (rawText: string): ExtractedExamNoticeMetadata => {
  const normalizedText = rawText
    .replace(/\r\n?/g, '\n')
    .replace(/-\s*\n\s*/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const lines = normalizedText
    .split(/\n|(?<!\d\.)(?<=\.)\s+(?=\p{Lu})/u)
    .map(normalizeLine)
    .filter(Boolean);
  const agency = extractAgency(normalizedText);
  const organizations = extractOrganizations(lines);
  const roles = extractRoles(lines);
  const requirements = extractRequirements(lines);
  const remunerations = extractRemunerations(normalizedText);
  const vacancies = extractVacancies(lines);
  const programmaticContent = extractProgrammaticContent(lines);
  const registrationWindow = extractRegistrationWindow(normalizedText);

  return {
    rawText: normalizedText,
    ...agency,
    year: extractYear(normalizedText),
    organizations,
    roles,
    requirements,
    requirementsDetailed: buildScopedItemsFromText(requirements, true),
    remunerations,
    remunerationsDetailed: buildScopedItemsWithDetectedScope(remunerations, roles, 'Remuneração'),
    vacancies,
    vacanciesDetailed: buildScopedItemsWithDetectedScope(vacancies, roles, 'Vagas'),
    programmaticContent,
    programmaticContentDetailed: extractProgrammaticDetailed(programmaticContent),
    stages: extractStages(lines),
    ...registrationWindow,
    examDate: extractExamDate(normalizedText),
    registrationFee: extractRegistrationFee(normalizedText),
    totalQuestions: extractTotalQuestions(normalizedText, programmaticContent),
  };
};

export const extractExamNoticeMetadata = async (file: File): Promise<ExtractedExamNoticeMetadata> => {
  const rawText = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    ? await readPdfText(file)
    : await file.text();

  return extractExamNoticeMetadataFromText(rawText);
};


