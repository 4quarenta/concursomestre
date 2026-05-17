import { redirectAuthAlias, type AuthAliasSearchParams } from '../_helpers/authAliasRedirect';

export default async function ActivationAliasPage({
  searchParams = {},
}: {
  searchParams?: Promise<AuthAliasSearchParams> | AuthAliasSearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  return redirectAuthAlias('/activation', resolvedSearchParams || {}, '/confirm-email');
}
