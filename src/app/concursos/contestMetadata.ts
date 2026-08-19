import type { Metadata } from 'next';
import { buildNoIndexMetadata, buildPublicPageMetadata } from '../seoMetadata';
import type { PublicContest } from './contestServerData';

const STATUS: Record<string, string> = { announced: 'anunciado', authorized: 'autorizado', notice_published: 'com edital publicado', registration_closed: 'com inscrições encerradas', exam_scheduled: 'com prova agendada', exam_completed: 'com prova realizada', results: 'em fase de resultados', completed: 'concluído', suspended: 'suspenso', cancelled: 'cancelado' };
export const contestStatusLabel = (status: string, isOpen?: boolean) => status === 'registration_open'
  ? (isOpen === true ? 'com inscrições abertas' : isOpen === false ? 'fora da janela de inscrições' : 'com cronograma de inscrições')
  : STATUS[status] || 'em acompanhamento';
export const contestDescription = (contest: PublicContest): string => contest.description || [
  `${contest.title} está ${contestStatusLabel(contest.status, contest.isOpen)}.`,
  contest.organizations.length ? `Órgão: ${contest.organizations.map((item) => item.acronym || item.name).join(', ')}.` : '',
  contest.board ? `Banca: ${contest.board.acronym || contest.board.name}.` : '',
].filter(Boolean).join(' ');
export const contestMetadataTitle = (contest: PublicContest): string => {
  const context: string[] = [];
  if (contest.year && !contest.title.includes(String(contest.year))) context.push(String(contest.year));
  const organization = contest.organizations[0]?.acronym || contest.organizations[0]?.name || '';
  if (organization && !contest.title.toLocaleLowerCase('pt-BR').includes(organization.toLocaleLowerCase('pt-BR'))) context.push(organization);
  return context.length ? `${contest.title} - ${context.join(', ')}` : contest.title;
};
export const buildContestMetadata = (contest: PublicContest | null): Metadata => contest
  ? buildPublicPageMetadata({ title: contestMetadataTitle(contest), description: contestDescription(contest), path: contest.canonicalPath })
  : buildNoIndexMetadata({ title: 'Concurso não encontrado' });
