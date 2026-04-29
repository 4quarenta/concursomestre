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

/**
 * Gateway oficial de IA do admin.
 * Toda chamada ao Gemini passa pelo backend autenticado para evitar
 * exposicao de segredos no navegador.
 * @since 1.0.0
 */

import type { Question } from '@types';
import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';

type GeminiSchemaType = 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';

interface GeminiResponseSchema {
  type: GeminiSchemaType;
  properties?: Record<string, GeminiResponseSchema>;
  items?: GeminiResponseSchema;
  enum?: string[];
  required?: string[];
}

interface GeminiAttachment {
  mimeType: string;
  data: string;
}

interface GeminiGatewayPayload {
  prompt: string;
  attachments?: GeminiAttachment[];
  responseMimeType?: string;
  responseSchema?: GeminiResponseSchema;
  model?: string;
}

interface GeminiGatewayResponse {
  text?: string;
}

export interface PageExtractionResult {
  metadata?: {
    agency?: string;
    source?: string;
    year?: string;
    role?: string;
    examType?: 'Concurso' | 'ENEM';
  };
  questions: Partial<Question>[];
}

export type OriginalQuestionModality = 'multipla escolha' | 'certo ou errado';

export interface OriginalQuestionGenerationRequest {
  agency: string;
  quantity: number;
  targetSubject?: string;
  targetModality?: OriginalQuestionModality;
  subjects?: string[];
  topics?: string[];
  organizations?: string[];
  roles?: string[];
  careers?: string[];
  roleFocusPairs?: string[];
  areas?: string[];
}

export interface GeneratedOriginalQuestion {
  enunciado: string;
  introText?: string;
  subject: string;
  topic?: string;
  specificSubject?: string;
  organization?: string;
  role?: string;
  career?: string;
  area?: string;
  year?: string | number;
  level?: string;
  difficulty?: string;
  modality?: OriginalQuestionModality;
  options: string[];
  correctOptionIndex: number;
  teacherComment: string;
  detailedComment: string;
}

export interface OriginalQuestionGenerationResult {
  questions: GeneratedOriginalQuestion[];
}

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

const extractTextFromGatewayResponse = (payload: GeminiGatewayResponse | string): string => {
  if (typeof payload === 'string') {
    return payload;
  }

  return typeof payload?.text === 'string' ? payload.text : '';
};

const normalizeJsonText = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
};

const parseGeminiJson = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(normalizeJsonText(text)) as T;
  } catch {
    return fallback;
  }
};

const requestGeminiText = async (payload: GeminiGatewayPayload): Promise<string> => {
  const response = await apiClient.post<GeminiGatewayResponse | string>(ENDPOINTS.ai.generate, {
    model: DEFAULT_MODEL,
    ...payload,
  }) as unknown;
  const envelope = assertApiSuccess<GeminiGatewayResponse | string>(
    response,
    'Nao foi possivel executar a solicitacao de IA.',
  );
  const data = readApiData<GeminiGatewayResponse | string>(envelope.raw, { text: '' });
  return extractTextFromGatewayResponse(data);
};

const buildQuestionAlternatives = (question: Question): string => {
  const itens = Array.isArray(question.itens) ? question.itens : [];
  return itens
    .map((item, index) => `${String.fromCharCode(65 + index)}) ${item.corpo || ''}`)
    .join('\n');
};

const resolveCorrectLetter = (question: Question): string => {
  const itens = Array.isArray(question.itens) ? question.itens : [];
  const correctItemIndex = itens.findIndex((item) => item.id === question.resposta);
  return correctItemIndex !== -1 ? String.fromCharCode(65 + correctItemIndex) : '?';
};

const normalizeGeneratedCommentText = (value: string) => String(value || '')
  .replace(/^```(?:markdown|md)?\s*/i, '')
  .replace(/```\s*$/i, '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n\n')
  .replace(/<p[^>]*>/gi, '')
  .replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n')
  .replace(/<li[^>]*>/gi, '- ')
  .replace(/<\/li>/gi, '\n')
  .replace(/<strong[^>]*>|<b[^>]*>/gi, '**')
  .replace(/<\/strong>|<\/b>/gi, '**')
  .replace(/<em[^>]*>|<i[^>]*>/gi, '*')
  .replace(/<\/em>|<\/i>/gi, '*')
  .replace(/<mark[^>]*>/gi, '**')
  .replace(/<\/mark>/gi, '**')
  .replace(/<\/?[a-z][^>]*>/gi, '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim();

const resolveOptionLetter = (index: number): string => {
  if (!Number.isInteger(index) || index < 0 || index > 25) {
    return '';
  }

  return String.fromCharCode(65 + index);
};

const ensureTeacherCommentMentionsAnswer = (comment: string, letter: string): string => {
  const normalized = normalizeGeneratedCommentText(comment);
  if (!normalized || !letter) {
    return normalized;
  }

  const escapedLetter = letter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicateOpeningPattern = new RegExp(
    `^(Gabarito\\s*:?\\s*${escapedLetter}\\s*[.!?]?\\s*)`
    + `(?:A\\s+)?(?:alternativa|resposta|letra)\\s*(?:correta\\s*)?(?:e|\\u00e9|:)?\\s*(?:a\\s+)?${escapedLetter}\\s*[.!?]?\\s*`,
    'i',
  );
  const compacted = normalized
    .replace(duplicateOpeningPattern, `Gabarito: ${letter}. `)
    .replace(/\s{2,}/g, ' ')
    .trim();

  const answerPattern = new RegExp(
    `(?:gabarito|resposta|alternativa|letra)\\s*(?:correta\\s*)?(?:e|\\u00e9|:)?\\s*(?:a\\s+)?${escapedLetter}\\b`,
    'i',
  );

  if (answerPattern.test(compacted)) {
    return compacted;
  }

  return `Gabarito: ${letter}. ${compacted}`;
};

/**
 * Centraliza os fluxos de IA usados pelo frontend administrativo.
 * @since 1.0.0
 */
export const aiService = {
  /**
   * Extrai questoes de uma imagem de pagina via backend.
   * @since 1.0.0
   */
  async extractQuestionsFromPage(
    pageBase64: string,
    includeTeacherComment: boolean = true,
  ): Promise<PageExtractionResult> {
    const commentInstruction = includeTeacherComment
      ? '- Comentario do Professor (teacherComment): gere uma mini-resolucao objetiva: cite o gabarito/alternativa correta e mostre o passo essencial que leva a resposta. Em questoes com calculo, inclua a formula com substituicao dos dados; em questoes teoricas, mencione a regra/conceito concreto aplicado. Nao faca comentario generico nem analise todas as alternativas. Escreva em tom humano, sem abertura padronizada; nao comece com frases como "A pegadinha aqui..." ou "O pulo do gato...". Quando houver formulas, use LaTeX entre $...$ para formulas inline e $$...$$ para blocos.'
      : '';

    const prompt = `
Voce e um especialista em OCR e estruturacao de dados de provas de concursos e ENEM.
Analise a imagem da pagina da prova fornecida.

IMPORTANTE:
- Extraia TODAS as questoes visiveis na pagina.
- Se a prova estiver em colunas, leia todas as colunas.
- Nao ignore questoes incompletas se o enunciado estiver legivel.

1. Identifique os metadados da prova: banca (agency), orgao/fonte (source), ano (year), cargo (role), tipo (examType).
2. Para cada questao encontrada, gere obrigatoriamente:
   - Enunciado (text)
   - Texto de apoio (introText), se houver
   - Alternativas (options)
   - Materia (subject)
   - Assunto especifico (topic)
   - Nivel de escolaridade (level): Fundamental, Medio ou Superior
   ${commentInstruction}

Retorne APENAS um JSON seguindo o esquema informado.
    `.trim();

    const schemaProperties: Record<string, GeminiResponseSchema> = {
      text: { type: 'STRING' },
      introText: { type: 'STRING' },
      subject: { type: 'STRING' },
      topic: { type: 'STRING' },
      level: { type: 'STRING', enum: ['Fundamental', 'Medio', 'Superior'] },
      difficulty: { type: 'STRING' },
      options: { type: 'ARRAY', items: { type: 'STRING' } },
    };

    const requiredFields = ['text', 'subject', 'options', 'topic', 'level'];

    if (includeTeacherComment) {
      schemaProperties.teacherComment = { type: 'STRING' };
      requiredFields.push('teacherComment');
    }

    const text = await requestGeminiText({
      prompt,
      attachments: [{ mimeType: 'image/jpeg', data: pageBase64 }],
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          metadata: {
            type: 'OBJECT',
            properties: {
              agency: { type: 'STRING' },
              source: { type: 'STRING' },
              year: { type: 'STRING' },
              role: { type: 'STRING' },
              examType: { type: 'STRING', enum: ['Concurso', 'ENEM'] },
            },
          },
          questions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: schemaProperties,
              required: requiredFields,
            },
          },
        },
      },
    });

    return parseGeminiJson<PageExtractionResult>(text, { questions: [] });
  },

  /**
   * Extrai o gabarito oficial a partir de uma imagem.
   * @since 1.0.0
   */
  async extractAnswerKeyMapping(keyImageBase64: string): Promise<Record<number, number>> {
    const prompt = `
Analise a imagem do gabarito oficial.
Extraia o mapeamento de numero da questao para a alternativa correta.
Retorne um objeto JSON onde a chave e o numero da questao e o valor e o indice da alternativa (0 para A, 1 para B, 2 para C, 3 para D, 4 para E).
Exemplo: {"1": 2, "2": 0}
    `.trim();

    const text = await requestGeminiText({
      prompt,
      attachments: [{ mimeType: 'image/jpeg', data: keyImageBase64 }],
      responseMimeType: 'application/json',
    });

    return parseGeminiJson<Record<number, number>>(text, {});
  },

  /**
   * Gera uma analise detalhada em Markdown para uma questao.
   * @since 1.0.0
   */
  async generateDetailedAnalysis(question: Question): Promise<string> {
    const prompt = `
Atue como um professor senior de cursinho preparatorio.
Analise a seguinte questao:

Enunciado: ${question.enunciado}
Alternativas:
${buildQuestionAlternatives(question)}

A resposta correta e a letra: ${resolveCorrectLetter(question)}

Gere um comentario detalhado, didatico e estruturado em Markdown.

REGRAS ESTRITAS DE ESTILO:
1. Nao use saudacoes, introducoes ou conclusoes genericas.
2. Va direto ao ponto.
3. Explique brevemente o conceito central.
4. Analise cada alternativa (A, B, C, D, E) explicando o erro ou acerto.
5. Use negrito para palavras-chave.
6. Quando houver formulas, use LaTeX entre $...$ para formulas inline e $$...$$ para blocos. Nao deixe comandos como \sqrt fora desses delimitadores.

Nao retorne JSON, retorne apenas o texto em Markdown.
    `.trim();

    const text = await requestGeminiText({ prompt });
    return normalizeGeneratedCommentText(text) || 'Nao foi possivel gerar a analise detalhada.';
  },

  /**
   * Gera um comentario curto do professor para uma questao.
   * @since 1.0.0
   */
  async generateTeacherComment(question: Question): Promise<string> {
    const itens = Array.isArray(question.itens) ? question.itens : [];
    const prompt = `
Analise a questao: "${question.enunciado}".
Alternativas: ${itens.map((item) => item.corpo).join(', ')}.
A correta e a letra ${resolveCorrectLetter(question)}.

Gere um comentario curto e didatico do professor explicando o gabarito. Sem saudacoes.
O comentario deve citar explicitamente a alternativa correta, por exemplo "Gabarito: ${resolveCorrectLetter(question)}.", e mostrar a resolucao resumida em 2 a 4 frases.
Se a questao tiver calculo, inclua a formula essencial com os valores substituidos e o resultado. Nao diga apenas que "a formula permite encontrar"; mostre a conta principal.
Se a questao for teorica, mencione a regra, conceito, artigo ou criterio concreto que torna a alternativa correta.
Use uma unica abertura de gabarito. Nao escreva "Gabarito: ${resolveCorrectLetter(question)}. A alternativa correta e a ${resolveCorrectLetter(question)}."; isso e repetitivo.
Nao faca um comentario generico que poderia servir para qualquer questao; mencione a regra, conceito ou detalhe concreto que justifica a resposta.
Nao analise todas as alternativas aqui; isso pertence a analise detalhada.
Escreva como um professor humano, com abertura natural e variada. Nao comece com frases padronizadas como "A pegadinha aqui esta...", "A pegadinha esta..." ou "O pulo do gato e...".
So mencione pegadinha, macete ou cuidado de prova quando isso realmente ajudar a entender a questao; caso contrario, explique pelo caminho mais natural.
Quando houver formulas, use LaTeX entre $...$ para formulas inline e $$...$$ para blocos. Nao deixe comandos como \sqrt fora desses delimitadores.
    `.trim();

    const text = await requestGeminiText({ prompt });
    return ensureTeacherCommentMentionsAnswer(text, resolveCorrectLetter(question));
  },

  /**
   * Gera questoes ineditas prontas para o fluxo administrativo de criacao.
   * @since 1.0.0
   */
  async generateOriginalQuestions({
    agency,
    quantity,
    targetSubject = '',
    targetModality,
    subjects = [],
    topics = [],
    organizations = [],
    roles = [],
    careers = [],
    roleFocusPairs = [],
    areas = [],
  }: OriginalQuestionGenerationRequest): Promise<GeneratedOriginalQuestion[]> {
    const safeQuantity = Math.max(1, Math.min(20, Math.round(Number(quantity) || 1)));
    const targetSubjectInstruction = targetSubject.trim()
      ? `\nMateria obrigatoria da geracao: ${targetSubject.trim()}. Todas as questoes devem pertencer a essa materia.`
      : '';
    const targetModalityInstruction = targetModality
      ? `\nModalidade obrigatoria da geracao: ${targetModality}. Todas as questoes devem usar exatamente essa modalidade.`
      : '';
    const subjectHint = subjects.length > 0
      ? `\nMaterias ja cadastradas que podem orientar a escolha: ${subjects.slice(0, 40).join(', ')}.`
      : '';
    const topicHint = topics.length > 0
      ? `\nTopicos/assuntos ja cadastrados que podem orientar a escolha: ${topics.slice(0, 60).join(', ')}.`
      : '';
    const organizationHint = organizations.length > 0
      ? `\nOrgaos/fonte cadastrados que podem orientar filtros: ${organizations.slice(0, 35).join(', ')}.`
      : '';
    const roleHint = roles.length > 0
      ? `\nCargos cadastrados que podem orientar filtros: ${roles.slice(0, 45).join(', ')}.`
      : '';
    const careerHint = careers.length > 0
      ? `\nFocos/carreiras cadastrados que podem orientar filtros: ${careers.slice(0, 35).join(', ')}.`
      : '';
    const roleFocusHint = roleFocusPairs.length > 0
      ? `\nHierarquia obrigatoria Foco -> Cargo cadastrada: ${roleFocusPairs.slice(0, 80).join('; ')}.`
      : '';
    const areaHint = areas.length > 0
      ? `\nAreas cadastradas que podem orientar filtros: ${areas.slice(0, 35).join(', ')}.`
      : '';

    const prompt = `
Voce e uma banca examinadora especializada em concursos publicos.
Crie ${safeQuantity} questao(oes) INEDITA(S), gerada(s) pela plataforma, com estilo 100% caracteristico da banca ${agency}.

Regras obrigatorias:
1. As questoes devem parecer questoes reais da banca ${agency}: comando, nivel de abstracao, pegadinhas, distribuicao das alternativas e linguagem devem seguir o padrao da banca.
2. Nao copie questoes existentes e nao mencione prova, ano, cargo, edital ou fonte real.
3. Gere conteudo pronto para publicacao na plataforma.
4. Preencha TODOS os filtros editoriais de acordo com a questao: materia, topico, assunto especifico, dificuldade, banca, orgao/fonte, ano, nivel, foco/carreira, cargo e modalidade. Nenhum desses campos pode vir vazio.
5. Use filtros coerentes com o conteudo; quando possivel, escolha itens das listas cadastradas abaixo. Se precisar criar um filtro novo, use um nome curto, canonico e especifico.
6. Cargo e subordinado a foco/carreira. O campo career deve ser a area/carreira em que o cargo se aplica, nunca um agrupador generico como "Outras" quando houver relacao clara.
7. Exemplos de pares corretos: Policial -> Soldado; Tribunais -> Analista Judiciario; Fiscal -> Auditor Fiscal; Educacao -> Professor.
8. Se escolher um cargo da hierarquia cadastrada, use exatamente o foco pai correspondente.
9. organization, role, career, subject, topic, specificSubject, level, difficulty, modality e year sao obrigatorios no JSON. Nao use "Outras", "Geral" ou "Diversos" se houver opcao mais especifica.
10. topic deve ser o topico intermediario e specificSubject deve ser o assunto mais especifico da questao. Eles nao podem ser iguais. Exemplo: subject "Matematica", topic "Sequencias", specificSubject "Progressao Aritmetica".
11. Inclua obrigatoriamente comentario do professor e analise detalhada.
12. O comentario do professor deve ser uma mini-resolucao objetiva: cite explicitamente a letra do gabarito conforme correctOptionIndex e mostre o passo essencial que leva aquela alternativa.
13. Em questoes com calculo, inclua a formula essencial com os valores substituidos e o resultado. Nao diga apenas que uma formula "permite encontrar"; mostre a conta principal.
14. Em questoes teoricas, mencione a regra, conceito, artigo ou criterio concreto aplicado.
15. Use uma unica abertura de gabarito. Exemplo desejado: "Gabarito: C. Como $S_n = ...$, temos ...". Nao escreva "Gabarito: C. A alternativa correta e a C."; isso e repetitivo.
16. Nao faca comentario generico que poderia servir para qualquer questao; mencione a regra, conceito, calculo ou detalhe concreto que justifica o gabarito.
17. Nao analise todas as alternativas no comentario do professor; isso pertence a analise detalhada.
18. O comentario do professor deve soar humano, leve e util, como uma observacao curta de professor depois da correcao.
19. Varie a primeira frase entre as questoes geradas; nao use a mesma abertura nem os mesmos primeiros 4 termos em mais de uma questao do lote.
20. Nao comece o comentario com frases padronizadas como "A pegadinha aqui esta...", "A pegadinha esta...", "Aqui a pegadinha...", "O pulo do gato e..." ou "Atencao:".
21. Nao force sempre pegadinha. Escolha naturalmente entre explicar o raciocinio, apontar um detalhe de prova, dar um macete, mostrar por que uma alternativa seduz ou lembrar um conceito central.
22. A analise detalhada deve explicar o conceito central e comentar cada alternativa.
23. Use apenas Markdown simples nos comentarios. Nao use tags HTML como <ul>, <li>, <strong>, <em>, <mark> ou tabelas.
24. Na analise, destaque erros das alternativas em Markdown, por exemplo: **Erro da B:** ...
25. A questao deve ter uma unica alternativa correta, sem ambiguidade. Todas as demais alternativas precisam estar claramente erradas ou incompletas.
26. Antes de retornar, confira se correctOptionIndex aponta para a unica alternativa correta e se nenhuma outra alternativa tambem poderia ser aceita como gabarito.
27. Quando houver formulas, use LaTeX entre $...$ para formulas inline e $$...$$ para blocos. Nao deixe comandos como \\sqrt fora desses delimitadores.
28. Para questoes no estilo certo/errado, retorne modality "certo ou errado" e exatamente duas alternativas: "Certo" e "Errado".
29. Para questoes de multipla escolha, retorne modality "multipla escolha" e de 4 a 5 alternativas plausiveis, mas apenas uma pode estar correta.
30. correctOptionIndex deve ser zero-based: 0 para a primeira alternativa, 1 para a segunda, e assim por diante.
${targetSubjectInstruction}${targetModalityInstruction}${subjectHint}${topicHint}${organizationHint}${roleHint}${careerHint}${roleFocusHint}${areaHint}

Retorne APENAS JSON seguindo o schema informado.
    `.trim();

    const text = await requestGeminiText({
      prompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          questions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                enunciado: { type: 'STRING' },
                introText: { type: 'STRING' },
                subject: { type: 'STRING' },
                topic: { type: 'STRING' },
                specificSubject: { type: 'STRING' },
                organization: { type: 'STRING' },
                role: { type: 'STRING' },
                career: { type: 'STRING' },
                area: { type: 'STRING' },
                year: { type: 'STRING' },
                level: { type: 'STRING', enum: ['Fundamental', 'Medio', 'Superior'] },
                difficulty: { type: 'STRING', enum: ['Facil', 'Medio', 'Dificil'] },
                modality: { type: 'STRING', enum: ['multipla escolha', 'certo ou errado'] },
                options: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                },
                correctOptionIndex: { type: 'INTEGER' },
                teacherComment: { type: 'STRING' },
                detailedComment: { type: 'STRING' },
              },
              required: [
                'enunciado',
                'subject',
                'topic',
                'specificSubject',
                'organization',
                'role',
                'career',
                'year',
                'level',
                'difficulty',
                'modality',
                'options',
                'correctOptionIndex',
                'teacherComment',
                'detailedComment',
              ],
            },
          },
        },
        required: ['questions'],
      },
    });

    const payload = parseGeminiJson<OriginalQuestionGenerationResult>(text, { questions: [] });
    return (payload.questions || [])
      .filter((question) => (
        String(question.enunciado || '').trim()
        && Array.isArray(question.options)
        && question.options.length >= 2
      ))
      .slice(0, safeQuantity)
      .map((question) => ({
        ...question,
        teacherComment: ensureTeacherCommentMentionsAnswer(
          question.teacherComment || '',
          resolveOptionLetter(Number(question.correctOptionIndex)),
        ),
        detailedComment: normalizeGeneratedCommentText(question.detailedComment || ''),
      }));
  },

  /**
   * Gera uma explicacao direta da questao em Markdown.
   * @since 1.0.0
   */
  async getQuestionExplanation(question: Question): Promise<string> {
    const prompt = `Explique didaticamente a questao: "${question.enunciado}" com resposta correta sendo a alternativa ${resolveCorrectLetter(question)}. Use Markdown.`;
    const text = await requestGeminiText({ prompt });
    return normalizeGeneratedCommentText(text) || 'Sem explicacao.';
  },

  /**
   * Extrai uma lista de aprovados a partir de um PDF.
   * @since 1.0.0
   */
  async extractApprovedListFromPDF(pdfBase64: string): Promise<string[]> {
    const text = await requestGeminiText({
      prompt: 'Extraia os numeros de inscricao dos aprovados deste PDF. Retorne um JSON { "approvedRegistrationNumbers": ["123", "456"] }.',
      attachments: [{ mimeType: 'application/pdf', data: pdfBase64 }],
      responseMimeType: 'application/json',
    });

    const result = parseGeminiJson<{ approvedRegistrationNumbers?: string[] }>(text, {});
    return Array.isArray(result.approvedRegistrationNumbers) ? result.approvedRegistrationNumbers : [];
  },
};

export default aiService;
