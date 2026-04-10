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

import React from 'react';
import { websiteManifest } from '../../config/platform';

export interface DocumentSeoPayload {
  title: string;
  description?: string;
  canonical?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}

const ensureMetaTag = (attribute: 'name' | 'property', key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
};

const ensureLinkTag = (rel: string, href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
};

export const applyDocumentSeo = (payload: DocumentSeoPayload) => {
  document.title = payload.title;

  ensureMetaTag('name', 'description', payload.description || websiteManifest.website.description);
  ensureMetaTag('name', 'robots', payload.robots || 'index,follow');
  ensureMetaTag('property', 'og:type', 'website');
  ensureMetaTag('property', 'og:title', payload.ogTitle || payload.title);
  ensureMetaTag('property', 'og:description', payload.ogDescription || payload.description || websiteManifest.website.description);
  ensureMetaTag('property', 'og:image', payload.ogImage || '');
  ensureMetaTag('name', 'twitter:card', payload.twitterImage || payload.ogImage ? 'summary_large_image' : 'summary');
  ensureMetaTag('name', 'twitter:title', payload.twitterTitle || payload.ogTitle || payload.title);
  ensureMetaTag('name', 'twitter:description', payload.twitterDescription || payload.ogDescription || payload.description || websiteManifest.website.description);
  ensureMetaTag('name', 'twitter:image', payload.twitterImage || payload.ogImage || '');

  if (payload.canonical) {
    ensureLinkTag('canonical', payload.canonical);
    ensureMetaTag('property', 'og:url', payload.canonical);
  }
};

export const useDocumentSeo = (payload: DocumentSeoPayload | null) => {
  React.useEffect(() => {
    if (!payload) {
      return;
    }

    applyDocumentSeo(payload);

    return () => {
      applyDocumentSeo({
        title: websiteManifest.website.title,
        description: websiteManifest.website.description,
        canonical: window.location.origin,
      });
    };
  }, [payload]);
};

