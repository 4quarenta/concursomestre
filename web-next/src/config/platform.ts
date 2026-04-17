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

import baseManifest from '../../config/platform/base.json';
import websiteManifestSource from '../../config/platform/website.json';
import androidManifestSource from '../../config/platform/android.json';

type BasePlatformManifest = typeof baseManifest;
type WebsitePlatformOverride = typeof websiteManifestSource;
type AndroidPlatformOverride = typeof androidManifestSource;

export type WebsitePlatformManifest = BasePlatformManifest & WebsitePlatformOverride;
export type AndroidPlatformManifest = BasePlatformManifest & AndroidPlatformOverride;

/**
 * Mescla o manifesto base com o manifesto de um canal especifico.
 * Esse contrato evita duplicacao e prepara a plataforma para compartilhar identidade entre web e app Android.
 * @since v1.0.0
 */
const mergePlatformManifest = <TChannelManifest extends object>(channelManifest: TChannelManifest) => ({
  ...baseManifest,
  ...channelManifest,
  product: {
    ...baseManifest.product,
    ...((channelManifest as { product?: object }).product || {}),
  },
  branding: {
    ...baseManifest.branding,
    ...((channelManifest as { branding?: object }).branding || {}),
  },
});

export const websiteManifest: WebsitePlatformManifest = mergePlatformManifest(websiteManifestSource);
export const androidManifest: AndroidPlatformManifest = mergePlatformManifest(androidManifestSource);
export const platformVersion = baseManifest.version;

/**
 * Garante que uma meta tag exista e possa ser atualizada a partir do manifesto.
 * Ela e usada para manter `description` e `application-name` sincronizados com a identidade central da plataforma.
 * @since v1.0.0
 */
const ensureMetaTag = (attribute: 'name' | 'property', key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
};

/**
 * Garante que um link de head exista e aponte para o recurso configurado no manifesto.
 * Esse helper prepara favicon e futuros manifests sem hardcode espalhado no HTML.
 * @since v1.0.0
 */
const ensureLinkTag = (rel: string, href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
};

/**
 * Aplica no documento web os metadados oficiais definidos no manifesto da plataforma.
 * Esse bootstrap mantem título, descrição, nome da aplicação e ícone alinhados ao contrato central.
 * @since v1.0.0
 */
export const applyWebsiteMetadata = (manifest: WebsitePlatformManifest = websiteManifest) => {
  document.title = manifest.website.title;
  ensureMetaTag('name', 'application-name', manifest.website.applicationName);
  ensureMetaTag('name', 'description', manifest.website.description);
  ensureMetaTag('name', 'theme-color', manifest.branding.primaryColor);
  ensureLinkTag('icon', manifest.branding.icon.publicPath);

  if (manifest.website.manifestPath) {
    ensureLinkTag('manifest', manifest.website.manifestPath);
  }
};

export default websiteManifest;
