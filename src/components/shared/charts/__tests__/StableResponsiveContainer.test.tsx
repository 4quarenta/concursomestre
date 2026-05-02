import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StableResponsiveContainer from '../StableResponsiveContainer';

describe('StableResponsiveContainer', () => {
  it('renders only a sized shell on the server', () => {
    const markup = renderToString(
      <StableResponsiveContainer height={280}>
        <svg data-testid="chart-content" />
      </StableResponsiveContainer>,
    );

    expect(markup).toContain('data-chart-ready="false"');
    expect(markup).toContain('height:280px');
    expect(markup).toContain('min-height:280px');
    expect(markup).not.toContain('data-testid="chart-content"');
  });

  it('allows an explicit fallback while waiting for a valid size', () => {
    const markup = renderToString(
      <StableResponsiveContainer
        fallback={<div data-testid="chart-loading">Carregando</div>}
        height={96}
      >
        <svg data-testid="chart-content" />
      </StableResponsiveContainer>,
    );

    expect(markup).toContain('data-testid="chart-loading"');
    expect(markup).toContain('height:96px');
    expect(markup).not.toContain('data-testid="chart-content"');
  });
});
