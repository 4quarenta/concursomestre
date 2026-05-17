import { redirectAuthAlias, type AuthAliasSearchParams } from '../_helpers/authAliasRedirect';

export default async function VerifyEmailAliasPage({
  searchParams = {},
}: {
  searchParams?: Promise<AuthAliasSearchParams> | AuthAliasSearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  return redirectAuthAlias('/verify-email', resolvedSearchParams || {}, '/confirm-email');
}
