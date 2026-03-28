import { defaultTheme } from './default.ts';
import { blackFridayTheme } from './black-friday.ts';
import { blackNovemberTheme } from './black-november.ts';
import { estudanteTheme } from './estudante.ts';
import { saoJoaoTheme } from './sao-joao.ts';
import { carnavalTheme } from './carnaval.ts';
import { anoNovoTheme } from './ano-novo.ts';
import { pascoaTheme } from './pascoa.ts';
import { consumidorTheme } from './consumidor.ts';
import { ThemeRegistry } from './types.ts';

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

export * from './types.ts';
