import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { attachUser } from './core/auth.js';
import { DomainError } from './services/entries.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerKbRoutes } from './routes/kb.js';
import { registerReviewRoutes } from './routes/review.js';
import { registerSyncRoutes } from './routes/sync.js';
import { registerMineRoutes } from './routes/mine.js';
import { registerDataRoutes } from './routes/data.js';
import { registerAdminRoutes } from './routes/admin.js';
import { getZendesk } from './integrations/zendesk.js';
import { getLlm } from './integrations/llm.js';

const here = dirname(fileURLToPath(import.meta.url));

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET ?? 'kb-console-dev-cookie-secret-change-me',
  });
  await app.register(rateLimit, { global: false });

  app.addHook('preHandler', async (req) => {
    await attachUser(req);
  });

  app.setErrorHandler(async (err, _req, reply) => {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return reply.code(400).send({ error: 'validation', message: first?.message ?? '参数校验失败', issues: err.issues });
    }
    if (err instanceof DomainError) {
      return reply.code(err.status).send({ error: 'domain', message: err.message, ...err.extra });
    }
    app.log.error(err);
    const message = err instanceof Error ? err.message : '服务内部错误';
    return reply.code(500).send({ error: 'internal', message });
  });

  app.get('/healthz', async () => ({
    status: 'ok',
    zendesk: getZendesk().mode,
    llm: getLlm().mode,
    time: new Date().toISOString(),
  }));

  await registerAuthRoutes(app);
  await registerKbRoutes(app);
  await registerReviewRoutes(app);
  await registerSyncRoutes(app);
  await registerMineRoutes(app);
  await registerDataRoutes(app);
  await registerAdminRoutes(app);

  // 前端静态资源（同仓构建，随引擎部署）
  const webDist = join(here, '..', '..', 'web', 'dist');
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, prefix: '/' });
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith('/api')) {
        return reply.code(404).send({ error: 'not_found', message: '接口不存在' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
