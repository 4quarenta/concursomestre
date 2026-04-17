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
 * Representa uma categoria de itens dentro de uma versão do changelog.
 * Usada na tela ChangelogScreen para renderizar as seções de cada release.
 * @since v1.0.0
 */
export type ChangelogCategory = {
  /** Título da categoria (ex.: "Questões", "Simulados") */
  title: string;
  /** Nome do ícone a ser mapeado na UI */
  icon: string;
  /** Lista de melhorias/correções da categoria */
  items: string[];
};

/**
 * Representa uma versão publicada no changelog oficial da plataforma.
 * Consumida pelo changelogService e exibida em ChangelogScreen.
 * @since v1.0.0
 */
export type ChangelogVersion = {
  id: number;
  version: string;
  release_date: string;
  title: string;
  description: string;
  content_json: ChangelogCategory[];
};
