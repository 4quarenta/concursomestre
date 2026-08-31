import { redirectAuthAlias, type AuthAliasSearchParams } from '../_helpers/authAliasRedirect';

export default async function RecoverAliasPage({
  searchParams = {},
}: {
  searchParams?: Promise<AuthAliasSearchParams> | AuthAliasSearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  return redirectAuthAlias('/recover', resolvedSearchParams || {}, '/reset-password');
}
