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

import { describe, expect, it } from 'vitest';
import { formatProvaLabel, normalizeProvaRecord } from '../examBankUtils';

describe('examBankUtils', () => {
  it('preserves booklet metadata from imported exam metadata_json', () => {
    const prova = normalizeProvaRecord({
      id: 77,
      nome: 'Analista - TJSP (2026)',
      ano: 2026,
      metadata_json: JSON.stringify({
        raw: {
          bookletType: 'Tipo B',
          bookletColor: 'Amarelo',
          caderno: 'Tipo B - Amarelo',
        },
      }),
      banca: { id: 1, nome: 'VUNESP', sigla: 'VUNESP' },
      orgao: { id: 2, nome: 'TJSP', sigla: 'TJSP' },
      cargo: { id: 3, descricao: 'Analista' },
    });

    expect(prova).toEqual(expect.objectContaining({
      caderno: 'Tipo B - Amarelo',
      tipoCaderno: 'Tipo B',
      corCaderno: 'Amarelo',
      bookletType: 'Tipo B',
      bookletColor: 'Amarelo',
    }));
  });

  it('preserves multiple roles from imported exam metadata_json', () => {
    const prova = normalizeProvaRecord({
      id: 78,
      nome: 'Soldado PM / Soldado BM - Secretaria de Seguranca (2026)',
      ano: 2026,
      metadata_json: JSON.stringify({
        raw: {
          roles: [
            'Soldado PM - Combatentes - QPC',
            'Soldado BM - Combatentes - QBMP - 0',
          ],
        },
      }),
      banca: { id: 1, nome: 'CEBRASPE', sigla: 'CEBRASPE' },
      orgao: { id: 2, nome: 'SSP', sigla: 'SSP' },
      cargo: { id: 3, descricao: 'Soldado PM - Combatentes - QPC' },
    });

    expect(prova?.roles).toEqual([
      'Soldado PM - Combatentes - QPC',
      'Soldado BM - Combatentes - QBMP - 0',
    ]);
    expect(prova?.cargos?.map((cargo) => cargo.descricao)).toEqual([
      'Soldado PM - Combatentes - QPC',
      'Soldado BM - Combatentes - QBMP - 0',
    ]);
    expect(prova?.cargo.descricao).toBe('Soldado PM - Combatentes - QPC');
  });

  it('preserves multiple organizations from imported exam metadata_json', () => {
    const prova = normalizeProvaRecord({
      id: 79,
      nome: 'IBFC - 2018 - PM-PB/CBM-PB - SOLDADO',
      ano: 2018,
      metadata_json: JSON.stringify({
        sources: ['PM-PB', 'CBM-PB'],
        orgaos: ['PM-PB', 'CBM-PB'],
      }),
      banca: { id: 1, nome: 'IBFC', sigla: 'IBFC' },
      orgao: { id: 2, nome: 'PM-PB', sigla: 'PM-PB' },
      cargo: { id: 3, descricao: 'SOLDADO' },
    });

    expect(prova?.orgao.nome).toBe('PM-PB');
    expect(prova?.orgaos?.map((orgao) => orgao.nome)).toEqual(['PM-PB', 'CBM-PB']);
    expect(prova ? formatProvaLabel(prova) : '').toBe('IBFC - 2018 - PM-PB/CBM-PB - SOLDADO');
  });

  it('preserves notice metadata used by the exam editor', () => {
    const prova = normalizeProvaRecord({
      id: 82,
      nome: 'FGV - 2026 - TJ-SP - Analista',
      ano: 2026,
      requisitos: ['Nivel superior em Direito', 'Registro profissional quando exigido'],
      remuneracoes: ['R$ 8.000,00'],
      conteudoProgramatico: ['Direito Constitucional', 'Direito Administrativo'],
      orgaos: ['TJ-SP', 'TRF-3'],
      cargos: ['Analista Judiciario', 'Tecnico Judiciario'],
      banca: { id: 1, nome: 'FGV', sigla: 'FGV' },
      orgao: { id: 2, nome: 'TJ-SP', sigla: 'TJ-SP' },
      cargo: { id: 3, descricao: 'Analista Judiciario' },
    });

    expect(prova?.orgaos?.map((orgao) => orgao.nome)).toEqual(['TJ-SP', 'TRF-3']);
    expect(prova?.cargos?.map((cargo) => cargo.descricao)).toEqual(['Analista Judiciario', 'Tecnico Judiciario']);
    expect(prova?.requisitos).toEqual(['Nivel superior em Direito', 'Registro profissional quando exigido']);
    expect(prova?.remuneracoes).toEqual(['R$ 8.000,00']);
    expect(prova?.conteudoProgramatico).toEqual(['Direito Constitucional', 'Direito Administrativo']);
  });

  it('preserves structured requirements, stages, vacancies and linked question ids', () => {
    const prova = normalizeProvaRecord({
      id: 84,
      nome: 'IBFC - 2026 - PM-PB - Soldado',
      ano: 2026,
      banca: { id: 1, nome: 'IBFC', sigla: 'IBFC' },
      orgao: { id: 2, nome: 'Polícia Militar da Paraíba', sigla: 'PM-PB' },
      cargo: { id: 3, descricao: 'Soldado', parent_id: 9 },
      vagas: ['900 vagas', 'Cadastro reserva'],
      requisitosDetalhados: [{
        id: 'req-1',
        scopeType: 'cargo',
        scope: 'Soldado',
        chave: 'Escolaridade',
        texto: 'Ensino médio completo',
      }],
      etapas: [{
        id: 'stage-1',
        nome: 'Prova objetiva',
        criterio: 'eliminatorio_classificatorio',
        data: '2026-09-20',
      }],
      totalQuestoes: 80,
      questoesVinculadas: [101, 102],
    });

    expect(prova?.vagas).toEqual(['900 vagas', 'Cadastro reserva']);
    expect(prova?.requirementsDetailed).toEqual([
      expect.objectContaining({
        chave: 'Escolaridade',
        texto: 'Ensino médio completo',
        scope: 'Soldado',
      }),
    ]);
    expect(prova?.etapas).toEqual([
      expect.objectContaining({
        nome: 'Prova objetiva',
        criterio: 'eliminatorio_classificatorio',
      }),
    ]);
    expect(prova?.totalQuestoes).toBe('80');
    expect(prova?.platformQuestionIds).toEqual(['101', '102']);
  });

  it('preserves taxonomy ids and role parent focus from canonical exam records', () => {
    const prova = normalizeProvaRecord({
      id: 83,
      nome: 'FGV - 2026 - PC-SP - Agente',
      ano: 2026,
      banca: { id: 10, nome: 'Fundacao Getulio Vargas', sigla: 'FGV' },
      orgao: { id: 20, nome: 'Policia Civil de Sao Paulo', sigla: 'PC-SP' },
      orgaos: [
        { id: 20, nome: 'Policia Civil de Sao Paulo', sigla: 'PC-SP', slug: 'pc-sp' },
        { id: 21, nome: 'Secretaria de Seguranca Publica', sigla: 'SSP-SP', slug: 'ssp-sp' },
      ],
      foco: { id: 30, nome: 'Policial', slug: 'policial' },
      cargo: { id: 40, descricao: 'Agente de Seguranca', parent_id: 30, slug: 'agente-de-seguranca' },
      cargos: [
        { id: 40, descricao: 'Agente de Seguranca', parent_id: 30, slug: 'agente-de-seguranca' },
        { id: 41, descricao: 'Investigador', parent_id: 30, slug: 'investigador' },
      ],
    });

    expect(prova?.orgaos?.map((orgao) => orgao.id)).toEqual([20, 21]);
    expect(prova?.foco).toEqual(expect.objectContaining({ id: 30, nome: 'Policial' }));
    expect(prova?.carreira).toEqual(expect.objectContaining({ id: 30, nome: 'Policial' }));
    expect(prova?.cargo).toEqual(expect.objectContaining({ id: 40, parent_id: 30 }));
    expect(prova?.cargos?.map((cargo) => ({ id: cargo.id, parent_id: cargo.parent_id }))).toEqual([
      { id: 40, parent_id: 30 },
      { id: 41, parent_id: 30 },
    ]);
  });

  it('does not append the year again when the exam name already includes it', () => {
    const prova = normalizeProvaRecord({
      id: 81,
      nome: 'IBFC - 2018 - PM-PB/CBM-PB - SOLDADO',
      ano: 2018,
      banca: { id: 1, nome: 'IBFC', sigla: 'IBFC' },
      orgao: { id: 2, nome: 'PM-PB', sigla: 'PM-PB' },
      cargo: { id: 3, descricao: 'SOLDADO' },
    });

    expect(prova ? formatProvaLabel(prova) : '').not.toContain('(2018)');
  });

  it('preserves exam file attachments and legacy URLs', () => {
    const prova = normalizeProvaRecord({
      id: 80,
      nome: 'FGV - 2025 - TJ-SP - Analista',
      ano: 2025,
      pdfUrl: 'uploads/exams/prova.pdf',
      gabaritoUrl: 'uploads/exams/gabarito.pdf',
      files: [
        {
          kind: 'edital',
          name: 'edital.pdf',
          url: 'uploads/exams/edital.pdf',
          mimeType: 'application/pdf',
          size: 1234,
        },
      ],
      banca: { id: 1, nome: 'FGV', sigla: 'FGV' },
      orgao: { id: 2, nome: 'TJ-SP', sigla: 'TJ-SP' },
      cargo: { id: 3, descricao: 'Analista' },
    });

    expect(prova?.files?.map((file) => file.kind).sort()).toEqual(['edital', 'gabarito', 'prova']);
    expect(prova?.pdfUrl).toBe('uploads/exams/prova.pdf');
    expect(prova?.editalUrl).toBe('uploads/exams/edital.pdf');
    expect(prova?.gabaritoUrl).toBe('uploads/exams/gabarito.pdf');
  });
});
