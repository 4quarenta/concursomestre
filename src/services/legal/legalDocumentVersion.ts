import legalDocumentVersions from '../../../contracts/legal/legal-document-versions.v1.json';

export const LEGAL_DOCUMENT_VERSIONS = legalDocumentVersions.documents;
const formatEffectiveDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-');
  const monthNames = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${Number(day)} de ${monthNames[Number(month) - 1]} de ${year}`;
};

export const LEGAL_DOCUMENT_VERSION = LEGAL_DOCUMENT_VERSIONS.terms_of_use.version;
export const LEGAL_EFFECTIVE_DATE = formatEffectiveDate(LEGAL_DOCUMENT_VERSIONS.terms_of_use.effectiveDate);
export const PRIVACY_POLICY_VERSION = LEGAL_DOCUMENT_VERSIONS.privacy_policy.version;
export const PRIVACY_POLICY_EFFECTIVE_DATE = formatEffectiveDate(LEGAL_DOCUMENT_VERSIONS.privacy_policy.effectiveDate);
export const CHECKOUT_ADHESION_TERMS_VERSION = LEGAL_DOCUMENT_VERSIONS.checkout_adhesion_terms.version;
export const CHECKOUT_ADHESION_TERMS_EFFECTIVE_DATE = formatEffectiveDate(LEGAL_DOCUMENT_VERSIONS.checkout_adhesion_terms.effectiveDate);
