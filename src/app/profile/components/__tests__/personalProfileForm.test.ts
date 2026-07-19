import { describe, expect, it } from 'vitest';
import { buildPersonalProfileUpdate, isPersonalProfileComplete, validatePersonalProfileUpdate } from '../personalProfileForm';

const validForm = () => {
  const form = new FormData();
  form.set('name', 'John Teste');
  form.set('cpf', '529.982.247-25');
  form.set('phone', '(83) 99999-9999');
  form.set('targetExam', 'Policial');
  form.set('zipCode', '58000-000');
  form.set('street', 'Rua Teste');
  form.set('number', '10A');
  form.set('complement', 'Apto 1');
  form.set('neighborhood', 'Centro');
  form.set('city', 'João Pessoa');
  form.set('state', 'pb');
  return form;
};

describe('personal profile form', () => {
  const completeProfile = {
    id: 'user-1',
    displayName: 'John Teste',
    email: 'john@example.com',
    avatarUrl: null,
    status: 'active',
    emailVerified: true,
    personal: {
      cpf: '***.***.***-**',
      phone: '(83) 99999-9999',
      targetExam: 'Policial',
      address: {
        zipCode: '58000-000',
        street: 'Rua Teste',
        number: '10',
        complement: null,
        neighborhood: 'Centro',
        city: 'João Pessoa',
        state: 'PB',
      },
      preferences: {},
    },
    account: {
      referralCode: null,
      twoFactorEnabled: false,
      deletion: { pending: false, requestedAt: null },
    },
    linkedProviders: [],
  };

  it('uses the private profile as the source of truth for completion', () => {
    expect(isPersonalProfileComplete(completeProfile)).toBe(true);
    expect(isPersonalProfileComplete({
      ...completeProfile,
      personal: { ...completeProfile.personal, address: { ...completeProfile.personal.address, city: '' } },
    })).toBe(false);
    expect(isPersonalProfileComplete(null)).toBe(false);
  });

  it('normalizes the private profile contract before sending it', () => {
    const payload = buildPersonalProfileUpdate(validForm());
    expect(payload).toMatchObject({
      cpf: '52998224725',
      phone: '83999999999',
      targetExam: 'Policial',
      address: { zipCode: '58000000', state: 'PB' },
    });
    expect(validatePersonalProfileUpdate(payload)).toBeNull();
  });

  it('rejects malformed personal data before the request', () => {
    const payload = buildPersonalProfileUpdate(validForm());
    payload.cpf = '11111111111';
    expect(validatePersonalProfileUpdate(payload)).toBe('CPF inválido. Verifique e tente novamente.');
  });
});
