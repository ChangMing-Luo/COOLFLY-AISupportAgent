import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { attachUser } from './core/auth.js';
import { DomainError } from './services/entries.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerEntryRoutes } from './routes/entries.js';
import { registerMetaRoutes } from './routes/meta.js';
import { registerOpsRoutes } from './routes/ops.js';
import { registerAdminRoutes } from './routes/admin.js';
import { getZendesk } from './integrations/zendesk.js';
import { getLlm } from './integrations/llm.js';

const here = dirname(fileURLToPath(import.meta.url));

/** 无需登录的接口白名单 */
const PUBLIC_PATHS = new Set(['/api/auth/login']);

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET ?? 'kb-console-dev-cookie-secret-change-me',
  });
  await app.register(rateLimit, { global: false });
  // 一键导入用：单文件 20MB 上限
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 1 } });

  app.addHook('preHandler', async (req, reply) => {
    await attachUser(req);
    const path = req.url.split('?')[0];
    if (path.startsWith('/api/') && !PUBLIC_PATHS.has(path) && !req.currentUser) {
      await reply.code(401).send({ error: 'unauthorized', message: '未登录或会话已失效' });
    }
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
  await registerEntryRoutes(app);
  await registerMetaRoutes(app);
  await registerOpsRoutes(app);
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
