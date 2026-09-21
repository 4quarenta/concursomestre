import type { UserProfile } from '@/types/auth';

export type CheckoutProfileField =
  | 'name'
  | 'cpf'
  | 'zipCode'
  | 'street'
  | 'number'
  | 'neighborhood'
  | 'city'
  | 'state'
  | 'emailVerified';

export const checkoutProfileFieldLabels: Record<CheckoutProfileField, string> = {
  name: 'nome completo',
  cpf: 'CPF',
  zipCode: 'CEP',
  street: 'logradouro',
  number: 'número',
  neighborhood: 'bairro',
  city: 'cidade',
  state: 'UF',
  emailVerified: 'confirmação do e-mail',
};

const onlyDigits = (value: unknown): string => String(value ?? '').replace(/\D/g, '');

/** Valida o CPF pelos dígitos verificadores oficiais. */
export const isValidCpf = (value: unknown): boolean => {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  for (let position = 9; position < 11; position += 1) {
    let sum = 0;
    for (let index = 0; index < position; index += 1) {
      sum += Number(cpf[index]) * (position + 1 - index);
    }

    const digit = ((10 * sum) % 11) % 10;
    if (digit !== Number(cpf[position])) return false;
  }

  return true;
};

/** Mantém as mesmas regras mínimas de endereço usadas no checkout web. */
export const isValidCheckoutProfileField = (
  field: CheckoutProfileField,
  user: Pick<UserProfile, 'name' | 'cpf' | 'address' | 'emailVerified'> | null | undefined,
): boolean => {
  const address = user?.address;

  switch (field) {
    case 'name':
      return String(user?.name || '').trim().length > 0;
    case 'cpf':
      return isValidCpf(user?.cpf);
    case 'zipCode':
      return onlyDigits(address?.zipCode).length === 8;
    case 'street':
      return String(address?.street || '').trim().length >= 3;
    case 'number':
      return /[0-9a-z]/i.test(String(address?.number || '').trim());
    case 'neighborhood':
      return String(address?.neighborhood || '').trim().length >= 2;
    case 'city':
      return String(address?.city || '').trim().length >= 2;
    case 'state':
      return /^[a-z]{2}$/i.test(String(address?.state || '').trim());
    case 'emailVerified':
      return user?.emailVerified === true;
    default:
      return false;
  }
};

export const getMissingCheckoutProfileFields = (
  user: Pick<UserProfile, 'name' | 'cpf' | 'address' | 'emailVerified'> | null | undefined,
): CheckoutProfileField[] => {
  const address = user?.address;
  const missing: CheckoutProfileField[] = [];

  (['name', 'cpf', 'zipCode', 'street', 'number', 'neighborhood', 'city', 'state', 'emailVerified'] as CheckoutProfileField[])
    .forEach((field) => {
      if (!isValidCheckoutProfileField(field, user)) missing.push(field);
    });

  return missing;
};

export const formatCheckoutProfileFields = (
  fields: CheckoutProfileField[],
): string => fields.map((field) => checkoutProfileFieldLabels[field]).join(', ');
