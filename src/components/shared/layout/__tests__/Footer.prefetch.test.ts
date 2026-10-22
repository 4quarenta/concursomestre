import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Footer navigation', () => {
  it('does not prefetch institutional routes from every platform page', () => {
    const footerSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/shared/layout/Footer.tsx'),
      'utf8',
    );

    expect(footerSource).toMatch(/href=\{link\.path\}[\s\S]*?prefetch=\{false\}/);
  });

  it('organizes links without decorative icons and displays the configured platform version', () => {
    const footerSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/shared/layout/Footer.tsx'),
      'utf8',
    );

    expect(footerSource).toContain("title: 'Explorar'");
    expect(footerSource).toContain("title: 'Conte\\u00fado'");
    expect(footerSource).toContain("title: 'Ajuda'");
    expect(footerSource).toContain('useEffectiveSystemSettings');
    expect(footerSource).toContain('systemSettings.platformVersion');
    expect(footerSource).toContain('Vers&atilde;o {platformVersion}');
    expect(footerSource).not.toContain('lucide-react');
    expect(footerSource).not.toContain('Desenvolvido com');
  });

  it('offers the Android app and keeps the iOS store action unavailable for now', () => {
    const footerSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/shared/layout/Footer.tsx'),
      'utf8',
    );
    const commercialFooterSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/landing/components/LandingCommercialFooter.tsx'),
      'utf8',
    );
    const appStoreLinksSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/shared/layout/AppStoreLinks.tsx'),
      'utf8',
    );

    expect(footerSource).toContain('<AppStoreLinks');
    expect(commercialFooterSource).toContain('<AppStoreLinks');
    expect(appStoreLinksSource).toContain('Google Play');
    expect(appStoreLinksSource).toContain('App Store');
    expect(appStoreLinksSource).toContain('Em breve');
    expect(appStoreLinksSource).toContain('disabled');
  });
});
