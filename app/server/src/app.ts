import { randomBytes } from 'node:crypto';
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
import { registerReviewRoutes } from './routes/reviews.js';
import { registerAdminRoutes } from './routes/admin.js';
import { getZendesk } from './integrations/zendesk.js';
import { getLlm } from './integrations/llm.js';

const here = dirname(fileURLToPath(import.meta.url));

/** 无需登录的接口白名单 */
const PUBLIC_PATHS = new Set(['/api/auth/login']);

/**
 * 首次登录必须改密码期间仍可访问的接口——除此之外一律 428 拦下。
 * 缺了这道闸，`must_change_password` 只是个显示字段：一次性初始密码永久有效。
 */
const MUST_CHANGE_ALLOWED = new Set([
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/change-password',
  '/api/bootstrap',
]);

/**
 * Cookie 签名密钥。缺失时**不能**回退到源码里的固定串——那等于把签名密钥公开，
 * 任何人都能为任意 user 伪造合法签名 Cookie。改为当场生成随机密钥：
 * 安全性有保证，代价只是重启后已签发的会话失效（生产请显式配置 COOKIE_SECRET）。
 */
function cookieSecret(log: FastifyInstance['log']): string {
  const configured = process.env.COOKIE_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (configured) log.warn('COOKIE_SECRET 短于 16 位，已忽略并改用随机密钥');
  log.warn('未配置 COOKIE_SECRET，本次启动使用随机密钥——重启后所有登录态失效；生产环境请在 .env 中配置');
  return randomBytes(32).toString('base64url');
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  await app.register(cookie, { secret: cookieSecret(app.log) });
  await app.register(rateLimit, { global: false });
  // 一键导入用：单文件 20MB 上限
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 1 } });

  app.addHook('preHandler', async (req, reply) => {
    await attachUser(req);
    const path = req.url.split('?')[0];
    if (!path.startsWith('/api/')) return;
    if (!PUBLIC_PATHS.has(path) && !req.currentUser) {
      await reply.code(401).send({ error: 'unauthorized', message: '未登录或会话已失效' });
      return;
    }
    if (req.currentUser?.mustChangePassword && !MUST_CHANGE_ALLOWED.has(path)) {
      await reply.code(428).send({
        error: 'must_change_password',
        message: '首次登录请先修改初始密码后再使用系统。',
      });
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
    // 未预期错误的原文会带出表名/列名/约束名与 SQL 片段，甚至外部服务的返回内容——
    // 详情只进服务端日志，回给客户端的是泛化文案
    return reply.code(500).send({ error: 'internal', message: '服务内部错误，请稍后重试或联系管理员。' });
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
  await registerReviewRoutes(app);
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
