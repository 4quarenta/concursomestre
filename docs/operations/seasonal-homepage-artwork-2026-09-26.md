# Seasonal homepage artwork

## Scope

The default theme retains the desktop/phone study illustration. Every seasonal
theme replaces it entirely with its own raster artwork. No campaign settings,
pricing, billing, email, SEO or persistence authority changed.

## Assets and generation brief

Generated with the built-in image_gen tool, then encoded as 1200x900 WebP with
alpha (quality 85). Assets live in `public/images/marketing/*-hero.webp`.
Shared prompt: premium dimensional editorial campaign illustration, one cohesive
isolated arrangement, transparent background, landscape 4:3, no screens, UI,
logos, prices, numeric discounts or text. Study books connect each occasion to
the product. No competitor assets were reused.

| Theme / file prefix | Distinct subject requested |
| --- | --- |
| black-friday | Black/gold ticket, percent symbol, books and gold ribbon |
| black-november | Monthly calendar, black books, gold bookmark and folded star |
| estudante | Blue backpack, notebooks, pencils, ruler and open book |
| sao-joao | Bonfire, traditional bunting, straw hat, accordion and books |
| carnaval | Carnival mask, feathers, streamers, tambourine and books |
| ano-novo | Gold star, planner, paper firework rays and celebration ribbons |
| pascoa | Decorated Easter eggs, bow, flowers and open book |
| consumidor | Shopping bag, study book, gift and loyalty star |

The Black Friday image received a final edit removing decorative spheres and
polyhedra while preserving ticket, books and ribbon.

## Evidence contract

`SeasonalHeroArtwork.test.tsx` asserts that default retains devices, all eight
seasonal themes remove them, each uses a distinct real WebP under 450 KB, and
the plans link remains present.

Read-only Playwright visual coverage uses the actual homepage with a browser-local
public settings response override (no persisted campaign mutation). The nine
themes are checked at 1440, 430 and 390 pixels for image decoding, absence of
devices in seasonal themes, horizontal overflow and client exceptions.
Screenshots and results: `.tmp/seasonal-artwork-evidence/`.
This evidence verifies rendering, not an authenticated Admin save or a campaign
activation in production.
