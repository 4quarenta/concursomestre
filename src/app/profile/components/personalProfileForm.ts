import type { AuthenticatedPersonalProfile, UpdatePersonalProfileInput } from '@services/profile';

const formValue = (formData: FormData, name: string) => String(formData.get(name) || '').trim();

const hasValue = (value: unknown) => String(value || '').trim() !== '';

export const isPersonalProfileComplete = (profile?: AuthenticatedPersonalProfile | null): boolean => {
  const address = profile?.personal.address;
  return Boolean(
    profile
    && hasValue(profile.displayName)
    && hasValue(profile.personal.cpf)
    && hasValue(profile.personal.phone)
    && hasValue(address?.zipCode)
    && hasValue(address?.street)
    && hasValue(address?.number)
    && hasValue(address?.neighborhood)
    && hasValue(address?.city)
    && /^[A-Z]{2}$/i.test(String(address?.state || '').trim()),
  );
};

export const buildPersonalProfileUpdate = (formData: FormData): UpdatePersonalProfileInput => ({
  name: formValue(formData, 'name'),
  cpf: formValue(formData, 'cpf').replace(/\D/g, ''),
  phone: formValue(formData, 'phone').replace(/\D/g, ''),
  targetExam: formValue(formData, 'targetExam'),
  address: {
    zipCode: formValue(formData, 'zipCode').replace(/\D/g, ''),
    street: formValue(formData, 'street'),
    number: formValue(formData, 'number'),
    complement: formValue(formData, 'complement'),
    neighborhood: formValue(formData, 'neighborhood'),
    city: formValue(formData, 'city'),
    state: formValue(formData, 'state').toUpperCase(),
  },
});

const isValidCpf = (value: string) => {
  if (value.length !== 11 || /^(\d)\1{10}$/.test(value)) return false;
  const digit = (base: string, factor: number) => {
    const total = base.split('').reduce((sum, item) => sum + (Number(item) * factor--), 0);
    const result = 11 - (total % 11);
    return result > 9 ? 0 : result;
  };
  return digit(value.slice(0, 9), 10) === Number(value[9])
    && digit(value.slice(0, 10), 11) === Number(value[10]);
};

export const validatePersonalProfileUpdate = (input: UpdatePersonalProfileInput): string | null => {
  if (!input.name) return 'Nome é obrigatório.';
  if (!input.cpf) return 'CPF é obrigatório.';
  if (!isValidCpf(input.cpf)) return 'CPF inválido. Verifique e tente novamente.';
  if (!input.phone) return 'Telefone é obrigatório.';
  if (![10, 11].includes(input.phone.length)) return 'Telefone inválido. Informe DDD + número com 10 ou 11 dígitos.';
  if (!input.address.zipCode) return 'CEP é obrigatório.';
  if (input.address.zipCode.length !== 8) return 'CEP inválido. Informe um CEP com 8 dígitos.';
  if (input.address.street.length < 3) return 'Logradouro inválido. Informe um endereço válido.';
  if (!/[0-9a-z]/i.test(input.address.number)) return 'Número inválido. Informe um número de endereço válido.';
  if (input.address.neighborhood.length < 2) return 'Bairro inválido. Informe um bairro válido.';
  if (input.address.city.length < 2) return 'Cidade inválida. Informe uma cidade válida.';
  if (!/^[A-Z]{2}$/.test(input.address.state)) return 'UF inválida. Use a sigla com 2 letras (ex.: SP).';
  return null;
};
