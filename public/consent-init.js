import { mountConsent } from '/consent.js';

await mountConsent({ endpoint: '/api/consent-config', siteId: 'agile-ai-manifesto' });
