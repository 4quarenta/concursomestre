import type { Metadata } from 'next';
import { buildNoIndexMetadata, buildPublicPageMetadata } from '../seoMetadata';
import type { PublicOrganization } from './organizationServerData';

export const organizationDisplayName = (organization: Pick<PublicOrganization, 'name' | 'acronym'>): string => (
  organization.acronym && organization.acronym.toLocaleLowerCase('pt-BR') !== organization.name.toLocaleLowerCase('pt-BR')
    ? `${organization.name} (${organization.acronym})`
    : organization.name
);

export const organizationDescription = (organization: PublicOrganization): string => (
  organization.description
  || `Consulte ${organization.questionCount.toLocaleString('pt-BR')} questões e ${organization.examCount.toLocaleString('pt-BR')} provas públicas relacionadas a ${organizationDisplayName(organization)}.`
);

export const buildOrganizationMetadata = (organization: PublicOrganization | null): Metadata => {
  if (!organization) return buildNoIndexMetadata({ title: 'Órgão não encontrado' });
  const displayName = organization.acronym || organization.name;
  return buildPublicPageMetadata({
    title: `Questões e provas de ${displayName}`,
    description: organizationDescription(organization),
    path: organization.canonicalPath,
  });
};
