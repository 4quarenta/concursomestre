import { describe, expect, it } from 'vitest';
import { metadata } from './layout';

describe('/concursos metadata', () => {
  it('renders but remains NOINDEX while no canonical contest entity exists', () => {
    expect(metadata.alternates?.canonical).toBe('/concursos');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });
});
