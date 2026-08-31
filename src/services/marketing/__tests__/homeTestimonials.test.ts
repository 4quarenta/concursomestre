import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
  },
  ENDPOINTS: {
    feedback: {
      testimonials: 'feedback/testimonials.php',
    },
  },
  readApiData: (response: unknown, fallback: unknown) => {
    const envelope = response && typeof response === 'object'
      ? response as { data?: unknown }
      : null;
    return envelope?.data ?? response ?? fallback;
  },
}));

import {
  FALLBACK_HOME_TESTIMONIALS,
  homeTestimonialsService,
  normalizeHomeTestimonials,
  resolveHomeTestimonials,
} from '../homeTestimonials';

describe('home testimonials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps only approved testimonial cards with all public fields', () => {
    const testimonials = normalizeHomeTestimonials({
      items: [
        { id: 1, name: 'Ana S.', role: 'Aprovada TJ', text: 'A plataforma ajudou minha revisao semanal.', rating: 5 },
        { id: 2, name: 'B', role: 'Aprovado', text: 'Curto demais para home.', rating: 5 },
        { id: 3, name: 'Carlos M.', role: '', text: 'Texto valido, mas sem contexto publico suficiente.', rating: 4 },
      ],
    });

    expect(testimonials).toHaveLength(1);
    expect(testimonials[0]).toMatchObject({
      id: '1',
      name: 'Ana S.',
      role: 'Aprovada TJ',
      rating: 5,
      source: 'approved',
    });
  });

  it('falls back to mock testimonials when there are no approved items', () => {
    expect(resolveHomeTestimonials([])).toBe(FALLBACK_HOME_TESTIMONIALS);
  });

  it('loads approved testimonials from the public feedback endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          {
            id: 8,
            name: 'Marina A.',
            role: 'Aprovada Prefeitura',
            text: 'Usei o cronograma para organizar revisoes e simulados.',
            rating: 5,
          },
        ],
      },
    });

    const testimonials = await homeTestimonialsService.getApproved();

    expect(mockGet).toHaveBeenCalledWith('feedback/testimonials.php');
    expect(testimonials).toHaveLength(1);
    expect(testimonials[0].source).toBe('approved');
  });
});
