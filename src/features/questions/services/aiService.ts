/**
 * AI Service (Gemini)
 * Handles AI-powered question analysis and generation
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { Question } from 'types';

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

export const aiService = {
    /**
     * Extract questions from image using Gemini AI
     */
    async extractQuestionsFromPage(
        apiKey: string,
        pageBase64: string,
        includeTeacherComment: boolean = true
    ): Promise<PageExtractionResult> {
        if (!apiKey || apiKey.includes('PLACEHOLDER')) {
            throw new Error("Chave de API inválida. Configure nas Configurações do Admin.");
        }

        const ai = new GoogleGenAI({ apiKey });

        const commentInstruction = includeTeacherComment
            ? "- Comentário do Professor (teacherComment): Gere uma explicação didática e RESUMIDA de por que a resposta correta é a correta."
            : "";

        const prompt = `
      Você é um especialista em OCR e estruturação de dados de provas de Concursos e ENEM.
      Analise a imagem da página da prova fornecida.
      
      IMPORTANTE:
      - Extraia TODAS as questões visíveis na página.
      - Se a prova estiver em colunas, leia todas as colunas.
      - Não ignore questões incompletas se o enunciado estiver legível.
      
      1. Identifique os metadados da prova: Banca (agency), Órgão/Fonte (source), Ano (year), Cargo (role), Tipo (examType).
      2. Para cada questão encontrada, gere obrigatoriamente:
         - Enunciado (text)
         - Texto de Apoio (introText) se houver.
         - Alternativas (options).
         - Matéria (Subject) baseado no conteúdo.
         - Assunto Específico (topic). Ex: 'Crase', 'Probabilidade', 'Atos Administrativos'.
         - Nível de Escolaridade (level). Ex: 'Fundamental', 'Médio', 'Superior'.
         ${commentInstruction}
      
      Retorne APENAS um JSON seguindo o esquema.
    `;

        const schemaProperties: any = {
            text: { type: Type.STRING },
            introText: { type: Type.STRING },
            subject: { type: Type.STRING },
            topic: { type: Type.STRING },
            level: { type: Type.STRING, enum: ['Fundamental', 'Médio', 'Superior'] },
            difficulty: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } }
        };

        const requiredFields = ["text", "subject", "options", "topic", "level"];

        if (includeTeacherComment) {
            schemaProperties.teacherComment = { type: Type.STRING };
            requiredFields.push("teacherComment");
        }

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash-latest',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: pageBase64 } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        metadata: {
                            type: Type.OBJECT,
                            properties: {
                                agency: { type: Type.STRING },
                                source: { type: Type.STRING },
                                year: { type: Type.STRING },
                                role: { type: Type.STRING },
                                examType: { type: Type.STRING, enum: ['Concurso', 'ENEM'] }
                            }
                        },
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: schemaProperties,
                                required: requiredFields
                            }
                        }
                    }
                }
            }
        });

        return JSON.parse(response.text || '{"questions": []}') as PageExtractionResult;
    },

    /**
     * Extract answer key mapping from image
     */
    async extractAnswerKeyMapping(
        apiKey: string,
        keyImageBase64: string
    ): Promise<Record<number, number>> {
        if (!apiKey) throw new Error("API Key inválida.");

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
      Analise a imagem do gabarito oficial.
      Extraia o mapeamento de Número da Questão para a Alternativa Correta.
      Retorne um objeto JSON onde a chave é o número da questão e o valor é o índice da alternativa (0 para A, 1 para B, 2 para C, 3 para D, 4 para E).
      Exemplo: {"1": 2, "2": 0}
    `;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash-latest',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: keyImageBase64 } },
                    { text: prompt }
                ]
            },
            config: { responseMimeType: "application/json" }
        });

        return JSON.parse(response.text || '{}');
    },

    /**
     * Generate detailed analysis for a question
     */
    async generateDetailedAnalysis(apiKey: string, question: Question): Promise<string> {
        if (!apiKey) throw new Error("API Key inválida.");

        const ai = new GoogleGenAI({ apiKey });

        const correctItemIndex = question.itens.findIndex(it => it.id === question.resposta);
        const correctLetter = correctItemIndex !== -1 ? String.fromCharCode(65 + correctItemIndex) : '?';

        const prompt = `
      Atue como um professor sênior de cursinho preparatório.
      Analise a seguinte questão:
      
      Enunciado: ${question.enunciado}
      Alternativas:
      ${question.itens.map((it, i) => `${String.fromCharCode(65 + i)}) ${it.corpo}`).join('\n')}
      
      A resposta correta é a letra: ${correctLetter}
      
      Gere um comentário detalhado, didático e estruturado em Markdown.
      
      REGRAS ESTRITAS DE ESTILO:
      1. NÃO use saudações, introduções ("Olá aluno", "Vamos analisar") ou conclusões genéricas.
      2. Vá DIRETO AO PONTO. Comece imediatamente com a análise.
      3. Explique brevemente o conceito central.
      4. Analise CADA alternativa (A, B, C, D, E) explicando o erro ou acerto.
      5. Use formatação negrito para palavras-chave.
      
      Não retorne JSON, retorne o texto em Markdown diretamente.
    `;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash-latest',
            contents: prompt
        });

        return response.text || "Não foi possível gerar a análise detalhada.";
    },

    /**
     * Generate teacher comment for a question
     */
    async generateTeacherComment(apiKey: string, question: Question): Promise<string> {
        if (!apiKey) throw new Error("API Key inválida.");

        const ai = new GoogleGenAI({ apiKey });

        const correctItemIndex = question.itens.findIndex(it => it.id === question.resposta);
        const correctLetter = correctItemIndex !== -1 ? String.fromCharCode(65 + correctItemIndex) : '?';

        const prompt = `
      Analise a questão: "${question.enunciado}".
      Alternativas: ${question.itens.map(it => it.corpo).join(', ')}.
      A correta é a letra ${correctLetter}.
      
      Gere um comentário curto e didático do professor explicando o gabarito. Sem saudações.
    `;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash-latest',
            contents: prompt
        });

        return response.text || "";
    },

    /**
     * Get question explanation
     */
    async getQuestionExplanation(apiKey: string, question: Question): Promise<string> {
        if (!apiKey) throw new Error("API Key inválida.");

        const ai = new GoogleGenAI({ apiKey });

        const correctItemIndex = question.itens.findIndex(it => it.id === question.resposta);
        const correctLetter = correctItemIndex !== -1 ? String.fromCharCode(65 + correctItemIndex) : '?';

        const prompt = `Explique didaticamente a questão: "${question.enunciado}" com resposta correta sendo a alternativa ${correctLetter}. Use Markdown.`;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash-latest',
            contents: prompt
        });

        return response.text || "Sem explicação.";
    },

    /**
     * Extract approved list from PDF
     */
    async extractApprovedListFromPDF(apiKey: string, pdfBase64: string): Promise<string[]> {
        if (!apiKey) throw new Error("API Key inválida.");

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `Extraia os números de inscrição dos aprovados deste PDF. Retorne um JSON { "approvedRegistrationNumbers": ["123", "456"] }.`;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash-latest',
            contents: [{
                parts: [
                    { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
                    { text: prompt }
                ]
            }],
            config: { responseMimeType: "application/json" }
        });

        const result = JSON.parse(response.text || '{"approvedRegistrationNumbers": []}');
        return result.approvedRegistrationNumbers;
    },
};

export default aiService;
