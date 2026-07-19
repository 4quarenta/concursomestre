const VIA_CEP_BASE_URL = 'https://viacep.com.br/ws';
const IBGE_LOCALITIES_BASE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades';
const REQUEST_TIMEOUT_MS = 8_000;

export type BrazilianState = {
  id: number;
  code: string;
  name: string;
};

export type BrazilianCity = {
  id: number;
  name: string;
};

export type BrazilianPostalAddress = {
  zipCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  ibgeCode: string | null;
};

export const BRAZILIAN_STATES: BrazilianState[] = [
  [12, 'AC', 'Acre'], [27, 'AL', 'Alagoas'], [16, 'AP', 'Amapa'],
  [13, 'AM', 'Amazonas'], [29, 'BA', 'Bahia'], [23, 'CE', 'Ceara'],
  [53, 'DF', 'Distrito Federal'], [32, 'ES', 'Espirito Santo'], [52, 'GO', 'Goias'],
  [21, 'MA', 'Maranhao'], [51, 'MT', 'Mato Grosso'], [50, 'MS', 'Mato Grosso do Sul'],
  [31, 'MG', 'Minas Gerais'], [15, 'PA', 'Para'], [25, 'PB', 'Paraiba'],
  [41, 'PR', 'Parana'], [26, 'PE', 'Pernambuco'], [22, 'PI', 'Piaui'],
  [33, 'RJ', 'Rio de Janeiro'], [24, 'RN', 'Rio Grande do Norte'], [43, 'RS', 'Rio Grande do Sul'],
  [11, 'RO', 'Rondonia'], [14, 'RR', 'Roraima'], [42, 'SC', 'Santa Catarina'],
  [35, 'SP', 'Sao Paulo'], [28, 'SE', 'Sergipe'], [17, 'TO', 'Tocantins'],
].map(([id, code, name]) => ({ id: Number(id), code: String(code), name: String(name) }));

const requestJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Servico de endereco indisponivel (${response.status}).`);
    }
    return await response.json() as T;
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
};

export const normalizeBrazilianPostalCode = (value: string): string => value.replace(/\D/g, '').slice(0, 8);

export const formatBrazilianPostalCode = (value: string): string => {
  const digits = normalizeBrazilianPostalCode(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

export const lookupBrazilianPostalCode = async (
  value: string,
  signal?: AbortSignal,
): Promise<BrazilianPostalAddress> => {
  const zipCode = normalizeBrazilianPostalCode(value);
  if (zipCode.length !== 8) {
    throw new Error('Informe um CEP com 8 digitos.');
  }

  const payload = await requestJson<{
    erro?: boolean;
    cep?: string;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
    ibge?: string;
  }>(`${VIA_CEP_BASE_URL}/${zipCode}/json/`, signal);

  if (payload.erro === true || !payload.uf || !payload.localidade) {
    throw new Error('CEP nao encontrado. Confira os numeros e tente novamente.');
  }

  return {
    zipCode: formatBrazilianPostalCode(payload.cep || zipCode),
    street: String(payload.logradouro || '').trim(),
    neighborhood: String(payload.bairro || '').trim(),
    city: String(payload.localidade || '').trim(),
    state: String(payload.uf || '').trim().toUpperCase(),
    ibgeCode: String(payload.ibge || '').trim() || null,
  };
};

export const listBrazilianStates = async (signal?: AbortSignal): Promise<BrazilianState[]> => {
  const payload = await requestJson<Array<{ id?: number; sigla?: string; nome?: string }>>(
    `${IBGE_LOCALITIES_BASE_URL}/estados?orderBy=nome`,
    signal,
  );

  const states = payload
    .map((item) => ({
      id: Number(item.id || 0),
      code: String(item.sigla || '').trim().toUpperCase(),
      name: String(item.nome || '').trim(),
    }))
    .filter((item) => item.id > 0 && /^[A-Z]{2}$/.test(item.code) && item.name !== '');

  return states.length === 27 ? states : BRAZILIAN_STATES;
};

export const listBrazilianCities = async (
  stateCode: string,
  signal?: AbortSignal,
): Promise<BrazilianCity[]> => {
  const normalizedState = stateCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedState)) return [];

  const payload = await requestJson<Array<{ id?: number; nome?: string }>>(
    `${IBGE_LOCALITIES_BASE_URL}/estados/${normalizedState}/municipios?orderBy=nome`,
    signal,
  );

  return payload
    .map((item) => ({ id: Number(item.id || 0), name: String(item.nome || '').trim() }))
    .filter((item) => item.id > 0 && item.name !== '');
};
