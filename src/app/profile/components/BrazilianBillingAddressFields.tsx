'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, MapPin } from 'lucide-react';
import type { PersonalProfileAddress } from '@services/profile';
import {
  BRAZILIAN_STATES,
  formatBrazilianPostalCode,
  listBrazilianCities,
  listBrazilianStates,
  lookupBrazilianPostalCode,
  normalizeBrazilianPostalCode,
} from '@services/locations/brazilianLocations';

type AddressDraft = {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

type BrazilianBillingAddressFieldsProps = {
  initialAddress?: PersonalProfileAddress | null;
};

const fieldClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const labelClassName = 'text-[10px] font-black uppercase text-slate-500 dark:text-slate-400';

const createAddressDraft = (address?: PersonalProfileAddress | null): AddressDraft => ({
  zipCode: formatBrazilianPostalCode(address?.zipCode || ''),
  street: String(address?.street || ''),
  number: String(address?.number || ''),
  complement: String(address?.complement || ''),
  neighborhood: String(address?.neighborhood || ''),
  city: String(address?.city || ''),
  state: String(address?.state || '').trim().toUpperCase(),
});

const RequiredMark = () => <span className="text-rose-500">*</span>;

export default function BrazilianBillingAddressFields({ initialAddress }: BrazilianBillingAddressFieldsProps) {
  const [address, setAddress] = React.useState<AddressDraft>(() => createAddressDraft(initialAddress));
  const zipCodeDigits = normalizeBrazilianPostalCode(address.zipCode);

  const statesQuery = useQuery({
    queryKey: ['locations', 'brazil', 'states'],
    queryFn: ({ signal }) => listBrazilianStates(signal),
    staleTime: 24 * 60 * 60 * 1_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const citiesQuery = useQuery({
    queryKey: ['locations', 'brazil', 'cities', address.state],
    queryFn: ({ signal }) => listBrazilianCities(address.state, signal),
    enabled: /^[A-Z]{2}$/.test(address.state),
    staleTime: 24 * 60 * 60 * 1_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const postalCodeQuery = useQuery({
    queryKey: ['locations', 'brazil', 'postal-code', zipCodeDigits],
    queryFn: ({ signal }) => lookupBrazilianPostalCode(zipCodeDigits, signal),
    enabled: zipCodeDigits.length === 8,
    staleTime: 24 * 60 * 60 * 1_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    const result = postalCodeQuery.data;
    if (!result) return;

    const updateId = globalThis.setTimeout(() => {
      setAddress((current) => ({
        ...current,
        zipCode: result.zipCode,
        street: result.street || current.street,
        neighborhood: result.neighborhood || current.neighborhood,
        city: result.city,
        state: result.state,
      }));
    }, 0);

    return () => globalThis.clearTimeout(updateId);
  }, [postalCodeQuery.data]);

  const stateOptions = statesQuery.data?.length ? statesQuery.data : BRAZILIAN_STATES;
  const cityOptions = citiesQuery.data || [];
  const currentCityIsListed = cityOptions.some((city) => city.name === address.city);
  const updateField = (field: keyof AddressDraft, value: string) => {
    setAddress((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Dados de cobrança e endereço</h3>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Informe o CEP para preencher automaticamente o endereço. Revise os dados antes de salvar.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
          <MapPin size={13} /> ViaCEP + IBGE
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <label className={labelClassName} htmlFor="personal-zip-code">CEP <RequiredMark /></label>
          <div className="relative">
            <input
              id="personal-zip-code"
              name="zipCode"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              value={address.zipCode}
              onChange={(event) => updateField('zipCode', formatBrazilianPostalCode(event.target.value))}
              placeholder="00000-000"
              maxLength={9}
              className={`${fieldClassName} pr-10`}
            />
            {postalCodeQuery.isFetching && <Loader2 size={16} className="absolute right-3 top-3.5 animate-spin text-indigo-500" />}
            {postalCodeQuery.isSuccess && <CheckCircle2 size={16} className="absolute right-3 top-3.5 text-emerald-500" />}
          </div>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className={labelClassName} htmlFor="personal-street">Logradouro <RequiredMark /></label>
          <input id="personal-street" name="street" type="text" autoComplete="address-line1" value={address.street} onChange={(event) => updateField('street', event.target.value)} placeholder="Ex.: Avenida Paulista" className={fieldClassName} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClassName} htmlFor="personal-number">Número <RequiredMark /></label>
          <input id="personal-number" name="number" type="text" autoComplete="address-line2" value={address.number} onChange={(event) => updateField('number', event.target.value)} placeholder="123" className={fieldClassName} />
        </div>
      </div>

      {postalCodeQuery.isError && zipCodeDigits.length === 8 && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          {postalCodeQuery.error instanceof Error ? postalCodeQuery.error.message : 'Não foi possível consultar o CEP. Preencha o endereço manualmente.'}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelClassName} htmlFor="personal-complement">Complemento</label>
          <input id="personal-complement" name="complement" type="text" autoComplete="address-line3" value={address.complement} onChange={(event) => updateField('complement', event.target.value)} placeholder="Apto., bloco ou referência" className={fieldClassName} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClassName} htmlFor="personal-neighborhood">Bairro <RequiredMark /></label>
          <input id="personal-neighborhood" name="neighborhood" type="text" value={address.neighborhood} onChange={(event) => updateField('neighborhood', event.target.value)} placeholder="Centro" className={fieldClassName} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className={labelClassName} htmlFor="personal-state">Estado <RequiredMark /></label>
          <select
            id="personal-state"
            name="state"
            autoComplete="address-level1"
            value={address.state}
            onChange={(event) => setAddress((current) => ({ ...current, state: event.target.value, city: '' }))}
            className={fieldClassName}
          >
            <option value="">Selecione a UF</option>
            {stateOptions.map((state) => <option key={state.id} value={state.code}>{state.code} - {state.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className={labelClassName} htmlFor="personal-city">Cidade <RequiredMark /></label>
          {citiesQuery.isError ? (
            <input id="personal-city" name="city" type="text" autoComplete="address-level2" value={address.city} onChange={(event) => updateField('city', event.target.value)} placeholder="Informe a cidade" className={fieldClassName} />
          ) : (
            <div className="relative">
              <select
                id="personal-city"
                name="city"
                autoComplete="address-level2"
                value={address.city}
                onChange={(event) => updateField('city', event.target.value)}
                disabled={!address.state || citiesQuery.isFetching}
                className={`${fieldClassName} disabled:cursor-wait disabled:opacity-60`}
              >
                <option value="">{citiesQuery.isFetching ? 'Carregando cidades...' : 'Selecione a cidade'}</option>
                {address.city && !currentCityIsListed && <option value={address.city}>{address.city}</option>}
                {cityOptions.map((city) => <option key={city.id} value={city.name}>{city.name}</option>)}
              </select>
              {citiesQuery.isFetching && <Loader2 size={16} className="absolute right-9 top-3.5 animate-spin text-indigo-500" />}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400"><RequiredMark /> Campos obrigatórios. Complemento é opcional.</p>
    </div>
  );
}
