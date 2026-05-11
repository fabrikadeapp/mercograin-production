/**
 * /docs/api — Swagger UI via CDN (jsdelivr).
 * ZERO custo: nenhuma dependência npm; assets servidos do CDN público.
 */
export const metadata = {
  title: 'BH Grain — API Docs',
  description: 'Documentação interativa OpenAPI 3.1 da API do BH Grain.',
}

export default function ApiDocsPage() {
  const html = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '/api/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
        })
      }
    </script>
  `
  return (
    <main style={{ minHeight: '100vh' }}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  )
}
