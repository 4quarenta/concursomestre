import { redirectAuthAlias, type AuthAliasSearchParams } from '../_helpers/authAliasRedirect';

export default async function ResetAliasPage({
  searchParams = {},
}: {
  searchParams?: Promise<AuthAliasSearchParams> | AuthAliasSearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  return redirectAuthAlias('/reset', resolvedSearchParams || {}, '/reset-password');
}
