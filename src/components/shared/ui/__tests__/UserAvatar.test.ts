/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { describe, expect, it } from 'vitest';
import { getAvatarInitials } from '../UserAvatar';

describe('getAvatarInitials', () => {
  it('usa o primeiro e o ultimo nome', () => {
    expect(getAvatarInitials('John da Silva')).toBe('JS');
  });

  it('usa ate duas letras quando existe apenas um nome', () => {
    expect(getAvatarInitials('Ana')).toBe('AN');
  });

  it('mantem caracteres acentuados e possui fallback seguro', () => {
    expect(getAvatarInitials('Érica Álvares')).toBe('ÉÁ');
    expect(getAvatarInitials('')).toBe('U');
  });
});
