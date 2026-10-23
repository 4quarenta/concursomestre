// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { isModalInteraction } from '../profileMenuDismissal';

describe('isModalInteraction', () => {
  it('keeps the profile menu mounted while clicking inside a portaled modal', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"><button>Confirmar</button></div>';

    expect(isModalInteraction(document.querySelector('button'))).toBe(true);
  });

  it('does not suppress outside-click dismissal for other targets', () => {
    document.body.innerHTML = '<button>Outside</button>';

    expect(isModalInteraction(document.querySelector('button'))).toBe(false);
    expect(isModalInteraction(null)).toBe(false);
  });
});
