/**
 * Cloudflare Worker - allo-electricien.pro Router
 *
 * Routes allo-electricien.pro domain traffic:
 * - /api/* → allo-electricien-api Worker (REST API)
 * - All other paths → allo-electricien-main Pages (Hugo static site)
 *
 * Architecture:
 * allo-electricien.pro → Router Worker → { Pages Deployment | API Worker }
 *
 * This allows seamless integration between static Hugo site and API,
 * with flexible routing and easy rollback capabilities.
 */

// Configuration
const API_WORKER_URL = 'https://allo-electricien.pro'; // API Worker handles its own routes via wrangler.toml
const PAGES_URL = 'https://allo-electricien-main.pages.dev'; // Hugo static site on Pages

// API path prefixes that should be routed to the API Worker
const API_PREFIXES = [
  '/api/'
];

/**
 * Check if the request path should be routed to the API Worker
 * @param {string} pathname - The URL pathname
 * @returns {boolean} - True if should route to API Worker
 */
function isApiPath(pathname) {
  return API_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const pathname = url.pathname;

    // Log for debugging (remove in production if needed)
    console.log(`[Router] ${request.method} ${hostname}${pathname}`);

    // Route API requests to API Worker
    if (isApiPath(pathname)) {
      console.log(`[Router] → API Worker: ${pathname}`);

      // Forward to API Worker
      // The API Worker is already deployed and handles /api/* via its wrangler.toml routes
      // We just need to pass the request through
      try {
        const apiUrl = `${API_WORKER_URL}${pathname}${url.search}`;

        const response = await fetch(apiUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          redirect: 'manual'
        });

        return response;

      } catch (error) {
        console.error(`[Router] API Worker error: ${error.message}`);
        return new Response(
          JSON.stringify({
            error: 'API temporarily unavailable',
            message: error.message
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            }
          }
        );
      }
    }

    // Route all other requests to Hugo Pages deployment
    console.log(`[Router] → Pages: ${pathname}`);

    try {
      // Construct Pages URL
      const pagesUrl = `${PAGES_URL}${pathname}${url.search}`;

      const response = await fetch(pagesUrl, {
        method: request.method,
        headers: request.headers,
        redirect: 'follow'
      });

      // If 404 and path doesn't have extension, try adding .html (Hugo pretty URLs)
      if (response.status === 404 && !pathname.match(/\.[a-z]+$/i) && pathname !== '/') {
        const htmlUrl = `${PAGES_URL}${pathname}/index.html`;

        const htmlResponse = await fetch(htmlUrl, {
          method: request.method,
          headers: request.headers,
          redirect: 'follow'
        });

        if (htmlResponse.ok) {
          // Clone response with proper headers
          const newHeaders = new Headers(htmlResponse.headers);

          // Add cache headers for static content
          if (!pathname.startsWith('/api/')) {
            newHeaders.set('Cache-Control', 'public, max-age=3600');
          }

          return new Response(htmlResponse.body, {
            status: 200,
            statusText: 'OK',
            headers: newHeaders
          });
        }
      }

      // Return the response from Pages
      const newHeaders = new Headers(response.headers);

      // Add cache headers for static content
      if (response.ok && !pathname.startsWith('/api/')) {
        newHeaders.set('Cache-Control', 'public, max-age=3600');
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });

    } catch (error) {
      console.error(`[Router] Pages error: ${error.message}`);
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Site temporairement indisponible</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              max-width: 600px;
              margin: 100px auto;
              padding: 20px;
              text-align: center;
            }
            h1 { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1>Site temporairement indisponible</h1>
          <p>Nous rencontrons actuellement des problèmes techniques.</p>
          <p>Veuillez réessayer dans quelques instants.</p>
          <hr>
          <p><small>Erreur: ${error.message}</small></p>
        </body>
        </html>
        `,
        {
          status: 503,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          }
        }
      );
    }
  }
};
