import { sessionStorage } from '@/storage/sessionStorage';

/**
 * @deprecated Use `sessionStorage` from `src/storage/sessionStorage`.
 * Ponte temporaria para evitar quebrar servicos ainda nao migrados por feature.
 */
export const sessionStore = sessionStorage;
