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
    expect(metadata.organizations).not.toEqual(expect.arrayContaining([
      'DE SEGURANÇA',
      'DA DEFESA SOCIAL',
      'COMISSÕES COORDENADORAS',
      'ADITIVO N.º 001 AO EDITAL N.º 001',
      'Publique-se no Diário Oficial do Estado',
    ]));
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

  it('extracts numbered subjects from an attached programmatic-content annex', () => {
    const metadata = extractExamNoticeMetadataFromText(`
      O edital menciona que o conteúdo programático consta em anexo.
      ANEXO III – CONTEÚDO PROGRAMÁTICO
      LÍNGUA PORTUGUESA
      1. Compreensão e intelecção de textos. 2. Tipologia textual. 3. Coesão e coerência. 4. Figuras de linguagem. 5. Ortografia.
      6. Acentuação gráfica. 7. Emprego do sinal indicativo de crase. 8. Formação, classe e emprego de palavras. 9. Sintaxe da
      oração e do período. 10. Pontuação. 11. Concordância nominal e verbal. 12. Colocação pronominal. 13. Regência nominal
      e verbal. 14. Equivalência e transformação de estruturas. 15. Paralelismo sintático.
      NOÇÕES DE INFORMÁTICA:
      1. Conceito de Internet e Intranet. 2. Ferramentas e aplicativos de navegação. 3. Pacote Microsoft Office.
    `);

    const portuguese = metadata.programmaticContentDetailed.filter((item) => item.materia === 'LÍNGUA PORTUGUESA');
    expect(portuguese).toHaveLength(15);
    expect(portuguese.every((item) => item.topico === '')).toBe(true);
    expect(portuguese).toEqual(expect.arrayContaining([
      expect.objectContaining({ assunto: 'Compreensão e intelecção de textos' }),
      expect.objectContaining({ assunto: 'Sintaxe da oração e do período' }),
      expect.objectContaining({ assunto: 'Paralelismo sintático' }),
    ]));
    expect(metadata.programmaticContentDetailed).toEqual(expect.arrayContaining([
      expect.objectContaining({ materia: 'NOÇÕES DE INFORMÁTICA', assunto: 'Pacote Microsoft Office' }),
    ]));
  });

  it('extracts structured edital fields for the exam bank editor', () => {
    const metadata = extractExamNoticeMetadataFromText(`
      EDITAL DO CONCURSO PUBLICO 2026
      BANCA: FGV
      PERIODO DE INSCRICOES: de 01/03/2026 a 20/03/2026
      TAXA DE INSCRICAO: R$ 120,00
      DATA DA PROVA OBJETIVA: 10/05/2026
      A prova objetiva sera composta por 80 questoes.

      2 DOS REQUISITOS
      2.1.1 Escolaridade: Ensino medio completo.
      2.1.2 Idade minima: 18 anos.
      3 DAS VAGAS
      Soldado: 900 vagas + cadastro reserva.
      4 DAS ETAPAS
      Prova objetiva - classificatorio - 10/05/2026
      Teste de aptidao fisica - eliminatorio - 20/06/2026
      ANEXO I - CONTEUDO PROGRAMATICO
      LINGUA PORTUGUESA: Interpretacao de texto; Concordancia verbal.
      DIREITO CONSTITUCIONAL
      1. Direitos e garantias fundamentais; Organizacao do Estado. 10 questoes
    `);

    expect(metadata.registrationStart).toBe('2026-03-01');
    expect(metadata.registrationEnd).toBe('2026-03-20');
    expect(metadata.examDate).toBe('2026-05-10');
    expect(metadata.registrationFee).toBe('R$ 120,00');
    expect(metadata.totalQuestions).toBe('80');
    expect(metadata.requirementsDetailed).toEqual(expect.arrayContaining([
      expect.objectContaining({ chave: 'Escolaridade', texto: 'Ensino medio completo.' }),
      expect.objectContaining({ chave: 'Idade minima', texto: '18 anos.' }),
    ]));
    expect(metadata.vacanciesDetailed).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'Soldado', texto: '900 vagas + cadastro reserva' }),
    ]));
    expect(metadata.programmaticContentDetailed).toEqual(expect.arrayContaining([
      expect.objectContaining({ materia: 'LINGUA PORTUGUESA', assunto: 'Interpretacao de texto' }),
      expect.objectContaining({ materia: 'DIREITO CONSTITUCIONAL', assunto: 'Direitos e garantias fundamentais' }),
    ]));
    expect(metadata.stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ nome: 'Prova objetiva', criterio: 'classificatorio', data: '2026-05-10' }),
      expect.objectContaining({ nome: 'Teste de aptidao fisica', criterio: 'eliminatorio', data: '2026-06-20' }),
    ]));
  });

  it('extracts the registration deadline when the edital writes the end date as a final deadline', () => {
    const metadata = extractExamNoticeMetadataFromText(`
      EDITAL N. 001/2018
      4. DAS INSCRICOES
      As inscricoes serao realizadas a partir de 10/04/2018.
      O pagamento e a confirmacao da inscricao poderao ser feitos ate o dia 30/04/2018, observado o horario oficial.
      DATA DA PROVA OBJETIVA: 29/07/2018
    `);

    expect(metadata.registrationStart).toBe('2018-04-10');
    expect(metadata.registrationEnd).toBe('2018-04-30');
  });

  it('extracts stages from the preliminary provisions table without using unrelated course text', () => {
    const metadata = extractExamNoticeMetadataFromText(`
      1 DAS DISPOSICOES PRELIMINARES
      1.1 O Concurso Publico sera regido por este Edital e demais etapas.
      1.3 O Concurso Publico de que trata este Edital sera composto de 5 (cinco) Etapas, conforme estabelecido a seguir:
      ETAPA DESCRICAO CRITERIO RESPONSABILIDADE
      1ª Exame Intelectual Eliminatorio e Classificatorio IBFC
      2ª Exame Psicologico Eliminatorio IBFC
      3ª Exame de Saude Eliminatorio PMPB/CBMPB
      4ª Exame de Aptidao Fisica Eliminatorio PMPB/CBMPB
      5ª Avaliacao Social Eliminatorio PMPB/CBMPB
      a) Durante o Curso de Formacao de Soldados - PM/1: Bolsa equivalente a um salario minimo vigente.
      b) Apos conclusao com aproveitamento do Curso de Formacao de Soldados - PM/2: R$ 3.202,60
    `);

    expect(metadata.stages).toEqual([
      expect.objectContaining({ nome: 'Exame Intelectual', criterio: 'eliminatorio_classificatorio' }),
      expect.objectContaining({ nome: 'Exame Psicologico', criterio: 'eliminatorio' }),
      expect.objectContaining({ nome: 'Exame de Saude', criterio: 'eliminatorio' }),
      expect.objectContaining({ nome: 'Exame de Aptidao Fisica', criterio: 'eliminatorio' }),
      expect.objectContaining({ nome: 'Avaliacao Social', criterio: 'eliminatorio' }),
    ]);
    expect(metadata.stages.map((stage) => stage.nome)).not.toEqual(expect.arrayContaining([
      expect.stringContaining('Curso de Formacao'),
      expect.stringContaining('Bolsa equivalente'),
    ]));
  });

  it('extracts only literal vacancy amounts from the vacancies section', () => {
    const metadata = extractExamNoticeMetadataFromText(`
      3 DAS VAGAS / CARGOS
      3.1 O Concurso de que trata este Edital oferece 900 (novecentas) vagas para a POLÍCIA MILITAR, sendo 850
      (oitocentos e cinquenta) para o sexo Masculino e 50 (cinquenta) vagas para o sexo Feminino, para o
      preenchimento de claros existentes na PMPB, consoante a Lei Complementar N.º 87, datada de 02 de dezembro
      de 2008.
      3.2 O Concurso também oferece 100 (cem) vagas para o CORPO DE BOMBEIROS MILITAR, sendo 90 para o sexo Masculino
      e 10 para o sexo Feminino.
      4 DAS INSCRICOES
    `);

    expect(metadata.vacancies).toEqual(expect.arrayContaining([
      'POLÍCIA MILITAR: 900 vagas',
      'POLÍCIA MILITAR - Masculino: 850 vagas',
      'CORPO DE BOMBEIROS MILITAR: 100 vagas',
      'CORPO DE BOMBEIROS MILITAR - Masculino: 90 vagas',
      'CORPO DE BOMBEIROS MILITAR - Feminino: 10 vagas',
    ]));
    expect(metadata.vacancies.join('\n')).not.toContain('DAS VAGAS');
    expect(metadata.vacancies.join('\n')).not.toContain('preenchimento de claros');
    expect(metadata.vacancies.join('\n')).not.toContain('Lei Complementar');
  });
});
