import type { Metadata } from 'next';
import { buildKnowledgeTaxonomyMetadata } from '../taxonomias/knowledgeTaxonomyMetadata';
import type { PublicDiscipline } from './disciplineServerData';

export const buildDisciplineMetadata = (discipline: PublicDiscipline | null): Metadata => buildKnowledgeTaxonomyMetadata(discipline);
