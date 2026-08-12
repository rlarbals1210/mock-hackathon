import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import insightsHandler from '../api/insights.ts'

function localInsightsApi(environment: Record<string, string>): Plugin {
  return {
    name: 'movin-local-insights-api',
    configureServer(server) {
      server.middlewares.use('/api/insights', (request, response) => {
        let rawBody = ''
        request.on('data', (chunk: Buffer) => {
          rawBody += chunk.toString()
          if (rawBody.length > 16_384) request.destroy()
        })
        request.on('end', async () => {
          let body: unknown = {}
          try {
            body = rawBody ? JSON.parse(rawBody) : {}
          } catch {
            response.statusCode = 400
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.end(JSON.stringify({ error: '요청 본문을 읽을 수 없습니다.' }))
            return
          }

          if (environment.GEMINI_API_KEY) process.env.GEMINI_API_KEY = environment.GEMINI_API_KEY
          if (environment.GEMINI_MODEL) process.env.GEMINI_MODEL = environment.GEMINI_MODEL

          const responseAdapter = {
            status(statusCode: number) {
              response.statusCode = statusCode
              return responseAdapter
            },
            json(payload: unknown) {
              response.setHeader('Content-Type', 'application/json; charset=utf-8')
              response.end(JSON.stringify(payload))
            },
            setHeader(name: string, value: string) {
              response.setHeader(name, value)
            },
          }

          await insightsHandler({ method: request.method, body }, responseAdapter)
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url))
  const environment = loadEnv(mode, projectRoot, '')

  return {
    envDir: projectRoot,
    plugins: [react(), localInsightsApi(environment)],
  }
})
