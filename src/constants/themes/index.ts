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

import { defaultTheme } from './default';
import { blackFridayTheme } from './black-friday';
import { blackNovemberTheme } from './black-november';
import { estudanteTheme } from './estudante';
import { saoJoaoTheme } from './sao-joao';
import { carnavalTheme } from './carnaval';
import { anoNovoTheme } from './ano-novo';
import { pascoaTheme } from './pascoa';
import { consumidorTheme } from './consumidor';
import { ThemeRegistry } from './types';

export const themeConfig: ThemeRegistry = {
    'default': defaultTheme,
    'black-friday': blackFridayTheme,
    'black-november': blackNovemberTheme,
    'estudante': estudanteTheme,
    'sao-joao': saoJoaoTheme,
    'carnaval': carnavalTheme,
    'ano-novo': anoNovoTheme,
    'pascoa': pascoaTheme,
    'consumidor': consumidorTheme,
};

export * from './types';
