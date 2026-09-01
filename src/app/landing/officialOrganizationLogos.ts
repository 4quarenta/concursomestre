export type OfficialOrganizationLogo = {
  organization: string;
  organizationSlugs: readonly string[];
  publicPath: string | null;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: 'OFFICIAL';
  retrievedAt: string;
  originalMime: string | null;
  normalizedMime: string | null;
  width: number | null;
  height: number | null;
  sha256: string | null;
  usageContext: 'ORGANIZATION_IDENTIFICATION';
  status: 'READY';
};

export const OFFICIAL_ORGANIZATION_LOGOS: readonly OfficialOrganizationLogo[] = [
  {
    organization: 'Polícia Federal', organizationSlugs: ['policia-federal'], publicPath: '/assets/organizations/policia-federal.png',
    sourceUrl: 'https://www.gov.br/pf/pt-br/principios-fundamentais/simbolos-da-policia-federal-2/emblema.png/view', sourceDomain: 'gov.br', sourceType: 'OFFICIAL', retrievedAt: '2026-08-31', originalMime: 'image/png', normalizedMime: 'image/png', width: 451, height: 566, sha256: '273d85c40c377bf273f98666a660cf9e784911f780c5cba747cdb8b48f3c8652', usageContext: 'ORGANIZATION_IDENTIFICATION', status: 'READY',
  },
  {
    organization: 'INSS', organizationSlugs: ['inss'], publicPath: '/assets/organizations/inss.png',
    sourceUrl: 'https://www.gov.br/previdencia/pt-br/media/logo-inss.png/view', sourceDomain: 'gov.br', sourceType: 'OFFICIAL', retrievedAt: '2026-08-31', originalMime: 'image/png', normalizedMime: 'image/png', width: 1920, height: 661, sha256: 'c6f769b6a48221b048defbc2a00343b1dd3d1fe0cdfb1e7d79cc32dddc1fc908', usageContext: 'ORGANIZATION_IDENTIFICATION', status: 'READY',
  },
  {
    organization: 'Receita Federal do Brasil', organizationSlugs: ['receita-federal'], publicPath: '/assets/organizations/receita-federal.jpg',
    sourceUrl: 'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/institucional/arquivos-e-imagens/logo-rfb.jpg/view', sourceDomain: 'gov.br', sourceType: 'OFFICIAL', retrievedAt: '2026-08-31', originalMime: 'image/jpeg', normalizedMime: 'image/jpeg', width: 350, height: 220, sha256: '4e3ca389c6ddab8b0443e98c4e3a906e847d4c62a9702f6d981348cf593b685c', usageContext: 'ORGANIZATION_IDENTIFICATION', status: 'READY',
  },
  {
    organization: 'Banco Central do Brasil', organizationSlugs: ['banco-central'], publicPath: '/assets/organizations/banco-central.png',
    sourceUrl: 'https://www.bcb.gov.br/Adm/Edital/concorrencia/DEMAP0722020/arq11_DEMAP072020.pdf', sourceDomain: 'bcb.gov.br', sourceType: 'OFFICIAL', retrievedAt: '2026-08-31', originalMime: 'image/png', normalizedMime: 'image/png', width: 1650, height: 1247, sha256: '846d312f2e5d6cf7686c577a63c2fc3f40b95615e3dd7ed8a38767718c13adae', usageContext: 'ORGANIZATION_IDENTIFICATION', status: 'READY',
  },
  {
    organization: 'Polícia Rodoviária Federal', organizationSlugs: ['policia-rodoviaria-federal'], publicPath: '/assets/organizations/policia-rodoviaria-federal.png',
    sourceUrl: 'https://www.gov.br/prf/pt-br/imagens/portal_prf.png', sourceDomain: 'gov.br', sourceType: 'OFFICIAL', retrievedAt: '2026-08-31', originalMime: 'image/png', normalizedMime: 'image/png', width: 1920, height: 856, sha256: '3e49d270fc8c7778f5d23cf47f205297fd8c46c831e993794beecbd65955e719', usageContext: 'ORGANIZATION_IDENTIFICATION', status: 'READY',
  },
  {
    organization: 'Banco do Brasil', organizationSlugs: ['banco-do-brasil'], publicPath: '/assets/organizations/banco-do-brasil.png',
    sourceUrl: 'https://www.gov.br/mcom/pt-br/assuntos/5g/seminarios-5g.br/imagens/LOGOBBAZUL.png/view', sourceDomain: 'gov.br', sourceType: 'OFFICIAL', retrievedAt: '2026-08-31', originalMime: 'image/png', normalizedMime: 'image/png', width: 600, height: 334, sha256: 'd0fcbf0fadd9e4c98377a1dbf5c1a99d44f4f91c50267721029aa6332a15f654', usageContext: 'ORGANIZATION_IDENTIFICATION', status: 'READY',
  },
  {
    organization: 'Tribunal de Contas da União', organizationSlugs: ['tcu'], publicPath: '/assets/organizations/tcu.png',
    sourceUrl: 'https://portal.tcu.gov.br/publicacoes-institucionais/cartilha-manual-ou-tutorial/programa-de-identidade-visual-do-tcu-manual-de-aplicacao-da-marca-versao-20', sourceDomain: 'portal.tcu.gov.br', sourceType: 'OFFICIAL', retrievedAt: '2026-08-31', originalMime: 'image/png', normalizedMime: 'image/png', width: 2801, height: 584, sha256: 'd26bd5a1203662959a0fbf7028bf1d5b3c66531292837b5246a94c64aa0407db', usageContext: 'ORGANIZATION_IDENTIFICATION', status: 'READY',
  },
  {
    organization: 'Justiça Eleitoral / Tribunal Superior Eleitoral', organizationSlugs: ['justica-eleitoral', 'tribunal-superior-eleitoral'], publicPath: '/assets/organizations/justica-eleitoral.jpg',
    sourceUrl: 'https://www.tse.jus.br/@@site-logo/logo.jpg', sourceDomain: 'tse.jus.br', sourceType: 'OFFICIAL', retrievedAt: '2026-08-31', originalMime: 'image/jpeg', normalizedMime: 'image/jpeg', width: 1200, height: 628, sha256: 'f52b04e67ba5b8600111682c4a208a8c5477c0de56a61fc38cd7c6bdbeafcde3', usageContext: 'ORGANIZATION_IDENTIFICATION', status: 'READY',
  },
];

const READY_LOGO_PATHS = new Map(
  OFFICIAL_ORGANIZATION_LOGOS
    .filter((logo): logo is OfficialOrganizationLogo & { publicPath: string } => logo.status === 'READY' && logo.publicPath !== null)
    .flatMap((logo) => logo.organizationSlugs.map((slug) => [slug, logo.publicPath] as const)),
);

export const officialOrganizationLogoPath = (slug: string): string | null => (
  READY_LOGO_PATHS.get(slug.trim().toLowerCase()) || null
);
