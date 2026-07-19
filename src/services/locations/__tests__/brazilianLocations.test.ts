import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BRAZILIAN_STATES,
  formatBrazilianPostalCode,
  listBrazilianCities,
  listBrazilianStates,
  lookupBrazilianPostalCode,
} from '../brazilianLocations';

const mockJsonResponse = (payload: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(payload),
}) as unknown as Response;

describe('brazilianLocations', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('formats and resolves a valid postal code through ViaCEP', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({
      cep: '01001-000',
      logradouro: 'Praça da Sé',
      bairro: 'Sé',
      localidade: 'São Paulo',
      uf: 'SP',
      ibge: '3550308',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupBrazilianPostalCode('01001-000')).resolves.toEqual({
      zipCode: '01001-000',
      street: 'Praça da Sé',
      neighborhood: 'Sé',
      city: 'São Paulo',
      state: 'SP',
      ibgeCode: '3550308',
    });
    expect(formatBrazilianPostalCode('01001000')).toBe('01001-000');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/01001000/json/',
      expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }),
    );
  });

  it('rejects an unknown postal code without clearing manual entry support', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockJsonResponse({ erro: true })));
    await expect(lookupBrazilianPostalCode('99999-999')).rejects.toThrow('CEP nao encontrado');
  });

  it('normalizes IBGE states and cities', async () => {
    const statesPayload = BRAZILIAN_STATES.map((state) => ({ id: state.id, sigla: state.code, nome: state.name }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockJsonResponse(statesPayload))
      .mockResolvedValueOnce(mockJsonResponse([{ id: 3550308, nome: 'São Paulo' }]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listBrazilianStates()).resolves.toHaveLength(27);
    await expect(listBrazilianCities('sp')).resolves.toEqual([{ id: 3550308, name: 'São Paulo' }]);
  });
});
