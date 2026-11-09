export function createWorker({ pages, assets, parseConfig }) {
  return {
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      if (url.hostname === 'www.agileaimanifesto.org') {
        url.protocol = 'https:';
        url.host = 'agileaimanifesto.org';
        url.port = '';
        return Response.redirect(url.href, 308);
      }
      const configRequest = url.pathname === '/api/consent-config';
      const asset = assets[url.pathname];
      if (!configRequest && !asset && !Object.hasOwn(pages, url.pathname)) {
        if (!Object.hasOwn(pages, url.pathname + '/')) return new Response('Not found', { status: 404 });
        url.pathname += '/';
        return Response.redirect(url.href, 308);
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
      }
      if (configRequest) {
        const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
        try {
          const row = await env.CONSENT_DB.prepare('SELECT config_json FROM consent_config_versions WHERE site_id = ? ORDER BY revision DESC LIMIT 1').bind('agile-ai-manifesto').first();
          const config = parseConfig(JSON.parse(row.config_json));
          if (config.siteId !== 'agile-ai-manifesto') throw new Error('Configuration site mismatch');
          return new Response(request.method === 'HEAD' ? null : JSON.stringify(config), { headers });
        } catch {
          return new Response(request.method === 'HEAD' ? null : JSON.stringify({ error: 'Consent configuration unavailable' }), { status: 503, headers });
        }
      }
      return new Response(request.method === 'HEAD' ? null : asset?.body ?? pages[url.pathname], {
        headers: {
          'Content-Type': asset?.type ?? 'text/html; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Cache-Control': 'no-cache',
        },
      });
    },
  };
}
