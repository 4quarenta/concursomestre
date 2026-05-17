import { redirectAuthAlias, type AuthAliasSearchParams } from '../_helpers/authAliasRedirect';

export default async function ForgotPasswordAliasPage({
  searchParams = {},
}: {
  searchParams?: Promise<AuthAliasSearchParams> | AuthAliasSearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  return redirectAuthAlias('/forgot-password', resolvedSearchParams || {}, '/reset-password');
}
