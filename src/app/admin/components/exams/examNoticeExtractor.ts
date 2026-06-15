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

export interface ExtractedExamNoticeMetadata {
  rawText: string;
  agency?: string;
  agencyName?: string;
  year?: string;
  organizations: string[];
  roles: string[];
  requirements: string[];
  remunerations: string[];
  programmaticContent: string[];
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
  return normalizeLine(value);
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

  const match = text.match(/(?:banca|organizadora|executora|realizacao|realização)\s*:?\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^\n.]{2,90})/i);
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
  const acronymMatches = headText.match(/\b(?:PM-?PB|PMPB|CBM-?PB|CBMPB|PC-?[A-Z]{2}|TJ-?[A-Z]{2}|TRT-?\d{1,2}|TRE-?[A-Z]{2}|TCE-?[A-Z]{2}|MP-?[A-Z]{2}|DPE-?[A-Z]{2}|SEFAZ-?[A-Z]{2}|SEDUC-?[A-Z]{2}|SEE-?[A-Z]{2}|SEAP-?[A-Z]{2}|SEJUSP-?[A-Z]{2}|PRF|PF|PCDF|PMDF)\b/gi) || [];

  lines.forEach((line, index) => {
    const searchableLine = normalizeForSearch(line);
    if (/\bORGAO(S)?\b|\bINSTITUICAO(ES)?\b|\bSECRETARIA\b|\bPREFEITURA\b|\bPOLICIA\b|\bCORPO DE BOMBEIROS\b/.test(searchableLine)) {
      values.push(...extractWindowValues(lines, index, /.*?(?:org[aã]o(?:s)?|institui[cç][aã]o(?:es)?|secretaria|prefeitura)\s*:?\s*/i, 2));
    }
  });

  if (normalizeForSearch(headText).includes('POLICIA MILITAR')) {
    values.push('PM-PB');
  }
  if (normalizeForSearch(headText).includes('CORPO DE BOMBEIROS')) {
    values.push('CBM-PB');
  }

  return dedupe([...values, ...acronymMatches.map(canonicalOrganization)].map(canonicalOrganization)).slice(0, 20);
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
  const section = findSectionLines(lines, [
    /CONTEUDO\s+PROGRAMATICO/,
    /ANEXO\s+[IVX]+\s*[-–]?\s*CONTEUDO\s+PROGRAMATICO/,
  ], [
    /^ANEXO\s+[IVX]+\b(?!.*CONTEUDO\s+PROGRAMATICO)/,
    /^ESTADO\s+DA\s+PARAIBA\b/,
    /^\d+\.?\s*DAS?\s+DISPOSICOES\s+FINAIS\b/,
  ], true);

  return dedupe(section)
    .filter((line) => !/^\d+$/.test(line))
    .slice(0, 180);
};

const extractRemunerations = (text: string) => (
  dedupe(Array.from(text.matchAll(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}(?:\s*(?:a|ate|até|e)\s*R\$\s*\d{1,3}(?:\.\d{3})*,\d{2})?/gi))
    .map((match) => match[0]))
    .slice(0, 20)
);

const readPdfText = async (file: File) => {
  const pdfjs = await loadPdfJsModule();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  const maxPages = Math.min(pdf.numPages, 30);

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
    .split(/\n|(?<=\.)\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/)
    .map(normalizeLine)
    .filter(Boolean);
  const agency = extractAgency(normalizedText);

  return {
    rawText: normalizedText,
    ...agency,
    year: extractYear(normalizedText),
    organizations: extractOrganizations(lines),
    roles: extractRoles(lines),
    requirements: extractRequirements(lines),
    remunerations: extractRemunerations(normalizedText),
    programmaticContent: extractProgrammaticContent(lines),
  };
};

export const extractExamNoticeMetadata = async (file: File): Promise<ExtractedExamNoticeMetadata> => {
  const rawText = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    ? await readPdfText(file)
    : await file.text();

  return extractExamNoticeMetadataFromText(rawText);
};
