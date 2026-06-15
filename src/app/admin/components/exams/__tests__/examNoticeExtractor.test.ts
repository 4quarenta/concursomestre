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
import { extractExamNoticeMetadataFromText } from '../examNoticeExtractor';

describe('examNoticeExtractor', () => {
  it('keeps requirements scoped to the DOS REQUISITOS section and extracts programmatic content separately', () => {
    const metadata = extractExamNoticeMetadataFromText(`
      ADITIVO N.º 001 AO EDITAL N.º 001/2018 - CFSd PM/BM 2018
      ANEXO III - CONTEÚDO PROGRAMÁTICO
      LÍNGUA PORTUGUESA
      1. Compreensão e intelecção de textos.
      RACIOCÍNIO LÓGICO
      1. Argumentação lógica.

      ESTADO DA PARAÍBA
      POLÍCIA MILITAR
      CORPO DE BOMBEIROS MILITAR
      IBFC
      2 DOS REQUISITOS
      2.1 Para se credenciar ao ingresso na Polícia Militar e Corpo de Bombeiros Militar do Estado da Paraíba, o candidato deve preencher os seguintes requisitos:
      2.1.1 Ser brasileiro nato ou naturalizado.
      2.1.2 Estar em dia com as obrigações militares e eleitorais.
      2.1.6 Ter concluído o ensino médio ou equivalente.
      3 DAS VAGAS/CARGOS
      Soldado PM
      Combatentes - QPC
      Soldado BM
      Combatentes - QBMP - 0
      3.4.1 Remuneração do cargo: R$ 3.202,60.
    `);

    expect(metadata.year).toBe('2018');
    expect(metadata.agency).toBe('IBFC');
    expect(metadata.organizations).toEqual(expect.arrayContaining(['PM-PB', 'CBM-PB']));
    expect(metadata.roles).toEqual(expect.arrayContaining([
      'Soldado PM Combatentes - QPC',
      'Soldado BM Combatentes - QBMP - 0',
    ]));
    expect(metadata.requirements.join('\n')).toContain('2.1.1 Ser brasileiro nato ou naturalizado.');
    expect(metadata.requirements.join('\n')).toContain('2.1.6 Ter concluído o ensino médio ou equivalente.');
    expect(metadata.requirements.join('\n')).not.toContain('Compreensão e intelecção de textos');
    expect(metadata.programmaticContent.join('\n')).toContain('LÍNGUA PORTUGUESA');
    expect(metadata.programmaticContent.join('\n')).toContain('RACIOCÍNIO LÓGICO');
    expect(metadata.remunerations).toContain('R$ 3.202,60');
  });
});
