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

/**
 * Centraliza a largura maxima do conteudo principal compartilhado entre o shell do app, o admin e os fallbacks.
 * Isso garante que as paginas internas usem a mesma caixa visual larga da area administrativa.
 *
 * @since 1.0.0
 */
export const PLATFORM_MAIN_CONTENT_WIDTH_CLASS = 'max-w-7xl';

/**
 * Define o tamanho padrao do titulo principal das paginas internas da plataforma.
 * A classe segue a proporcao mais usada entre painel admin, ranking, simulados e areas autenticadas.
 *
 * @since 1.0.0
 */
export const PLATFORM_PAGE_TITLE_CLASS = 'text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100';

/**
 * Define o tamanho padrao dos subtitulos descritivos logo abaixo do titulo da pagina.
 * Esse texto orienta o usuario sem competir com o cabecalho principal.
 *
 * @since 1.0.0
 */
export const PLATFORM_PAGE_DESCRIPTION_CLASS = 'max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400';

/**
 * Define o tamanho padrao dos titulos de secoes internas e cards principais.
 * O objetivo e manter hierarquia consistente entre dashboard, admin e paginas detalhadas.
 *
 * @since 1.0.0
 */
export const PLATFORM_SECTION_TITLE_CLASS = 'text-lg md:text-xl font-black tracking-tight text-slate-900 dark:text-slate-100';

/**
 * Define o tamanho padrao dos numeros de destaque em KPIs e caixas resumidas.
 * Isso evita boxes desproporcionais em relacao ao restante das paginas.
 *
 * @since 1.0.0
 */
export const PLATFORM_METRIC_VALUE_CLASS = 'text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100';

/**
 * Define o box padrao das paginas internas.
 * Essa base mantem borda, fundo e sombra consistentes em todo o app.
 *
 * @since 1.0.0
 */
export const PLATFORM_SURFACE_CARD_CLASS = 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none';
