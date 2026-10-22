// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardOverview from '../DashboardOverview';
import { dashboardFixture } from './dashboardFixture';

vi.mock('@/components/shared/feedback/AdBanner', () => ({ default: () => null }));
vi.mock('@/components/shared/charts/StableResponsiveContainer', () => ({ default: () => <div data-testid="chart" /> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const host = document.createElement('div');
document.body.append(host);
let root: ReturnType<typeof createRoot>;
afterEach(() => { act(() => root.unmount()); });
const render = (props = dashboardFixture) => { root = createRoot(host); act(() => root.render(<DashboardOverview {...props} />)); };

describe('DashboardOverview', () => {
  it('preserves supplied metrics, destinations and secondary information', () => {
    render();
    expect(host.textContent).toContain('320');
    expect(host.textContent).toContain('250 acertos · 70 erros');
    expect(host.textContent).toContain('Acumulado, incluindo a sessão atual');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(host.querySelector('a[href="/performance/subjects"]')).not.toBeNull();
    expect(host.querySelector('a[href="/simulation"]')).not.toBeNull();
    expect(host.textContent).toContain('12 comentários');
  });
  it('changes period and allows calendar navigation without selecting future months', () => {
    const onRangeChange = vi.fn();
    render({ ...dashboardFixture, onRangeChange });
    const week = Array.from(host.querySelectorAll('button')).find(button => button.textContent === '7 dias')!;
    act(() => week.click());
    expect(onRangeChange).toHaveBeenCalledWith('week');
    const next = host.querySelector<HTMLButtonElement>('[aria-label="Próximo mês"]')!;
    expect(next.disabled).toBe(true);
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Mês anterior"]')!.click());
    expect(next.disabled).toBe(false);
  });
  it('shows loading rather than stale counts and supports an empty account', () => {
    render({ ...dashboardFixture, loading: true });
    expect(host.textContent).toContain('Carregando seu desempenho');
    expect(host.textContent).not.toContain('250 acertos');
    act(() => root.render(<DashboardOverview {...dashboardFixture} subjects={[]} timeline={[]} summary={{ totalQuestions: 0, correctAnswers: 0, wrongAnswers: 0, accuracyRate: 0 }} />));
    expect(host.textContent).toContain('Nenhuma resposta neste período');
    expect(host.textContent).toContain('Começar a praticar');
  });
});
