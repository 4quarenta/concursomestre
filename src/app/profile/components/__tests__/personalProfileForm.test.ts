import { describe, expect, it } from 'vitest';
import { buildPersonalProfileUpdate, validatePersonalProfileUpdate } from '../personalProfileForm';

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
