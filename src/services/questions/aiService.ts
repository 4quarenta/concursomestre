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
  const response = await apiClient.post<any>(ENDPOINTS.ai.generate, {
    model: DEFAULT_MODEL,
    ...payload,
  }) as any;
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
      ? '- Comentario do Professor (teacherComment): gere uma explicacao didatica e resumida de por que a resposta correta e a correta.'
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

Nao retorne JSON, retorne apenas o texto em Markdown.
    `.trim();

    const text = await requestGeminiText({ prompt });
    return text || 'Nao foi possivel gerar a analise detalhada.';
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
    `.trim();

    const text = await requestGeminiText({ prompt });
    return text || '';
  },

  /**
   * Gera uma explicacao direta da questao em Markdown.
   * @since 1.0.0
   */
  async getQuestionExplanation(question: Question): Promise<string> {
    const prompt = `Explique didaticamente a questao: "${question.enunciado}" com resposta correta sendo a alternativa ${resolveCorrectLetter(question)}. Use Markdown.`;
    const text = await requestGeminiText({ prompt });
    return text || 'Sem explicacao.';
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
