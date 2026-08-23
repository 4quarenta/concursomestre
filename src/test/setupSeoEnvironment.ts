// Test fixtures may simulate PRODUCTION, but only against the canonical host
// and with the two independent activation confirmations explicitly present.
process.env.SEO_DEPLOYMENT_ENVIRONMENT = 'PRODUCTION';
process.env.SEO_PRODUCTION_INDEXING = 'CONFIRMED';
process.env.SEO_PRODUCTION_SITEMAP = 'CONFIRMED';
process.env.NEXT_PUBLIC_SITE_URL = 'https://concursomestre.com';
