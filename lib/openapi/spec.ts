/**
 * OpenAPI 3.1 spec generator — BH Grain.
 *
 * Itera `app/api/**\/route.ts`, detecta métodos exportados (GET/POST/PUT/PATCH/DELETE)
 * via regex (sem AST/dep externa), gera spec mínimo válido. ZERO custo.
 *
 * Path params [slug] -> {slug}. Tags derivadas do primeiro segmento.
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
type Method = (typeof METHODS)[number]

export type OpenAPIObject = {
  openapi: '3.1.0'
  info: { title: string; version: string; description: string; contact?: { url: string } }
  servers: Array<{ url: string; description?: string }>
  tags: Array<{ name: string; description?: string }>
  paths: Record<string, Record<string, unknown>>
  components: { securitySchemes: Record<string, unknown> }
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...walk(p))
    else if (e === 'route.ts' || e === 'route.js') out.push(p)
  }
  return out
}

function fileToApiPath(fileAbs: string, apiRoot: string): string {
  const rel = relative(apiRoot, fileAbs).split(sep).slice(0, -1) // remove route.ts
  const parts = rel.map((seg) => {
    // [slug] -> {slug}; [...rest] -> {rest}
    const m = seg.match(/^\[\.{0,3}(\w+)\]$/)
    return m ? `{${m[1]}}` : seg
  })
  return '/api/' + parts.join('/')
}

function detectMethods(src: string): Method[] {
  const found: Method[] = []
  for (const m of METHODS) {
    const re = new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b|export\\s+const\\s+${m}\\b`)
    if (re.test(src)) found.push(m)
  }
  return found
}

function extractPathParams(path: string): Array<{ name: string; in: 'path'; required: true; schema: { type: 'string' } }> {
  const out: Array<{ name: string; in: 'path'; required: true; schema: { type: 'string' } }> = []
  const re = /{(\w+)}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(path))) out.push({ name: m[1], in: 'path', required: true, schema: { type: 'string' } })
  return out
}

function detectZod(src: string): boolean {
  return /from\s+['"]zod['"]/i.test(src) || /z\.object/.test(src)
}

export function gerarOpenAPISpec(projectRoot: string): OpenAPIObject {
  const apiRoot = join(projectRoot, 'app', 'api')
  const files = walk(apiRoot)
  const paths: Record<string, Record<string, unknown>> = {}
  const tagSet = new Set<string>()

  for (const f of files) {
    const apiPath = fileToApiPath(f, apiRoot)
    const tag = apiPath.split('/')[2] || 'root'
    tagSet.add(tag)
    const src = readFileSync(f, 'utf8')
    const methods = detectMethods(src)
    const hasZod = detectZod(src)
    const params = extractPathParams(apiPath)
    if (!paths[apiPath]) paths[apiPath] = {}
    for (const m of methods) {
      const op: Record<string, unknown> = {
        tags: [tag],
        summary: `${m} ${apiPath}`,
        parameters: params,
        responses: {
          '200': { description: 'OK' },
          '400': { description: 'Bad Request' },
          '401': { description: 'Unauthorized' },
          '500': { description: 'Internal Server Error' },
        },
        security: [{ sessionCookie: [] }],
      }
      if (m === 'POST' || m === 'PUT' || m === 'PATCH') {
        op.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: hasZod
                ? { type: 'object', description: 'Validado via Zod schema (ver código)' }
                : { type: 'object' },
            },
          },
        }
      }
      ;(paths[apiPath] as Record<string, unknown>)[m.toLowerCase()] = op
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'BH Grain API',
      version: '1.0.0',
      description: 'API REST do BH Grain — sistema de trading de grãos multi-tenant. Auto-gerado a partir do filesystem.',
      contact: { url: 'https://www.profitsync.ia.br' },
    },
    servers: [
      { url: 'https://www.profitsync.ia.br', description: 'Production' },
      { url: 'http://localhost:3000', description: 'Local' },
    ],
    tags: [...tagSet].sort().map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        sessionCookie: { type: 'apiKey', in: 'cookie', name: 'next-auth.session-token' },
        portalSession: { type: 'apiKey', in: 'cookie', name: 'portal-session' },
      },
    },
  }
}
