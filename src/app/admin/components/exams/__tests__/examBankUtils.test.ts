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
import { normalizeProvaRecord } from '../examBankUtils';

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
