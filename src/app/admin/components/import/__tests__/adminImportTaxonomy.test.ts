import { describe, expect, it } from 'vitest';
import {
  buildQuestionFiltersPayload,
  partitionQuestionTaxonomies,
} from '../adminImportWorkflowPublicationCore';

const granTaxonomies = [
  {
    id: null,
    name: 'Microsoft Excel',
    materia: false,
    taxonomyLevel: 'assunto',
    externalId: 405118,
    externalParentId: 420298,
    externalRootId: 405030,
    rootSubjectName: 'Informática',
  },
  {
    id: null,
    name: 'Suítes ou Pacotes de Escritório',
    materia: false,
    taxonomyLevel: 'topico',
    externalId: 405107,
    externalParentId: 405030,
    externalRootId: 405030,
    parentName: 'Informática',
  },
  {
    id: null,
    name: 'Windows',
    materia: false,
    taxonomy_level: 'assunto',
    externalId: 405201,
    externalParentId: 405200,
    externalRootId: 405030,
    parentName: 'Sistemas Operacionais',
  },
  {
    id: null,
    name: 'Sistemas Operacionais',
    materia: false,
    taxonomyLevel: 'topico',
    externalId: 405200,
    externalParentId: 405030,
    externalRootId: 405030,
    parentName: 'Informática',
  },
  {
    id: null,
    name: 'Informática',
    materia: true,
    taxonomyLevel: 'materia',
    externalId: 405030,
    externalRootId: 405030,
    palavrasChave: ['Noções básicas de informática'],
  },
];

describe('taxonomia hierárquica do importador', () => {
  it('particiona matéria, todos os tópicos e todos os assuntos sem depender da ordem', () => {
    const partition = partitionQuestionTaxonomies(granTaxonomies);

    expect(partition.subjects.map((item) => item.name)).toEqual(['Informática']);
    expect(partition.topics.map((item) => item.name)).toEqual([
      'Suítes ou Pacotes de Escritório',
      'Sistemas Operacionais',
    ]);
    expect(partition.subtopics.map((item) => item.name)).toEqual([
      'Microsoft Excel',
      'Windows',
    ]);
  });

  it('publica todas as ramificações e preserva a linhagem externa sem usá-la como id local', () => {
    const filters = buildQuestionFiltersPayload({ assuntos: granTaxonomies });

    expect(filters.materias).toHaveLength(1);
    expect(filters.topicos).toHaveLength(2);
    expect(filters.assuntos).toHaveLength(2);
    expect(filters.assuntos?.[0]).toMatchObject({
      id: null,
      label: 'Microsoft Excel',
      taxonomyLevel: 'assunto',
      externalId: 405118,
      externalParentId: 420298,
      externalRootId: 405030,
      rootSubjectName: 'Informática',
    });
    expect(filters.topicos?.[1]).toMatchObject({
      id: null,
      label: 'Sistemas Operacionais',
      taxonomyLevel: 'topico',
      parentName: 'Informática',
    });
  });

  it('mantém compatibilidade com o contrato legado ordenado sem taxonomyLevel', () => {
    const filters = buildQuestionFiltersPayload({
      assuntos: [
        { id: 1, name: 'Direito', materia: true },
        { id: 2, name: 'Direito Constitucional', materia: false },
        { id: 3, name: 'Direitos fundamentais', materia: false },
        { id: 4, name: 'Controle de constitucionalidade', materia: false },
      ],
    });

    expect(filters.materias?.map((item) => item.label)).toEqual(['Direito']);
    expect(filters.topicos?.map((item) => item.label)).toEqual(['Direito Constitucional']);
    expect(filters.assuntos?.map((item) => item.label)).toEqual([
      'Direitos fundamentais',
      'Controle de constitucionalidade',
    ]);
  });
});
