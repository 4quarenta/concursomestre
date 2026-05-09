import { apiClient, readApiData, ENDPOINTS } from '@services/api';
import { withRequestCoalescing } from '@services/api/requestCoalescer';

export type HomeTestimonial = {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
  photoUrl?: string;
  verified: boolean;
  source: 'approved' | 'fallback';
};

export const FALLBACK_HOME_TESTIMONIALS: HomeTestimonial[] = [
  {
    id: 'fallback-lucas',
    name: 'Lucas N.',
    role: 'Aprovado Receita Federal',
    text: 'Eu parei de estudar no chute. O relatorio mostrava onde eu estava perdendo ponto e isso mudou minha revisao.',
    rating: 5,
    photoUrl: 'https://i.pravatar.cc/96?img=12',
    verified: true,
    source: 'fallback',
  },
  {
    id: 'fallback-carolina',
    name: 'Carolina R.',
    role: 'Aprovada Policia Federal',
    text: 'Os simulados ficaram parecidos com a rotina real de prova. Nao era so acertar questao, era entender o padrao da banca.',
    rating: 5,
    photoUrl: 'https://i.pravatar.cc/96?img=32',
    verified: true,
    source: 'fallback',
  },
  {
    id: 'fallback-rafael',
    name: 'Rafael M.',
    role: 'Aprovado Tribunal de Justica',
    text: 'O cronograma organizou meu estudo sem complicar. Eu sabia o que fazer no dia e conseguia medir se estava evoluindo.',
    rating: 5,
    photoUrl: 'https://i.pravatar.cc/96?img=15',
    verified: true,
    source: 'fallback',
  },
  {
    id: 'fallback-marina',
    name: 'Marina A.',
    role: 'Aprovada Prefeitura de Curitiba',
    text: 'Gostei porque a plataforma nao promete milagre. Ela mostra os dados e ajuda a ajustar o estudo com clareza.',
    rating: 5,
    photoUrl: 'https://i.pravatar.cc/96?img=47',
    verified: true,
    source: 'fallback',
  },
  {
    id: 'fallback-eduardo',
    name: 'Eduardo P.',
    role: 'Aprovado Policia Penal',
    text: 'O Raio-X da banca me ajudou a parar de perder tempo com assunto pouco cobrado. Foi bem direto ao ponto.',
    rating: 5,
    photoUrl: 'https://i.pravatar.cc/96?img=18',
    verified: true,
    source: 'fallback',
  },
  {
    id: 'fallback-bianca',
    name: 'Bianca S.',
    role: 'Aprovada Tribunal Regional',
    text: 'Eu usava principalmente para revisar erros. Ver minha taxa de acerto por materia deixou a rotina muito mais honesta.',
    rating: 5,
    photoUrl: 'https://i.pravatar.cc/96?img=44',
    verified: true,
    source: 'fallback',
  },
];

const clampRating = (value: unknown) => Math.max(1, Math.min(5, Math.round(Number(value) || 5)));

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

export const normalizeHomeTestimonials = (value: unknown): HomeTestimonial[] => {
  const items = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : [];

  return items
    .map((item): HomeTestimonial => {
      const row = isRecord(item) ? item : {};

      return {
        id: String(row.id || `${row.name || 'testimonial'}-${row.publishedAt || ''}`),
        name: String(row.name || '').trim(),
        role: String(row.role || row.headline || '').trim(),
        text: String(row.text || row.details || '').trim(),
        rating: clampRating(row.rating),
        photoUrl: String(row.photoUrl || row.photo_url || '').trim() || undefined,
        verified: row.verified !== false,
        source: 'approved' as const,
      };
    })
    .filter((item) => (
      item.name.length >= 2
      && item.role.length >= 3
      && item.text.length >= 20
      && item.rating >= 1
      && item.rating <= 5
    ))
    .slice(0, 12);
};

export const resolveHomeTestimonials = (approvedTestimonials: HomeTestimonial[]) => (
  approvedTestimonials.length > 0 ? approvedTestimonials : FALLBACK_HOME_TESTIMONIALS
);

export const homeTestimonialsService = {
  async getApproved(): Promise<HomeTestimonial[]> {
    return withRequestCoalescing('marketing:home-testimonials', async () => {
      const response = await apiClient.get<unknown>(ENDPOINTS.feedback.testimonials);
      return normalizeHomeTestimonials(readApiData<unknown>(response, {}));
    }, 5000);
  },
};

export default homeTestimonialsService;
