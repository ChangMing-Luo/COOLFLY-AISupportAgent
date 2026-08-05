/**
 * 全局前置：把数据库重置回种子基线（每轮只跑一次）。
 *
 * 不这么做，测试就只在「刚手动跑完 db:seed」时才通过：实测连跑第二次会挂 8 项——
 * 上一轮建的用户没清（建同名用户 409）、被测条目状态被前面的用例改过（下线/归档/翻译）。
 * 靠「跑之前记得先 seed」是隐含前提，迟早再踩；让测试自己保证基线才可重复。
 *
 * 放 globalSetup 而不是 setupFiles：后者按测试文件各跑一次，3 个文件并行会互相 TRUNCATE。
 * 用子进程而不是直接 import：seed 脚本自带 pool 生命周期，同进程调用会关掉测试共用的连接池。
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const EXTERNAL_KEYS = [
  'ZENDESK_SUBDOMAIN', 'ZENDESK_EMAIL', 'ZENDESK_API_TOKEN',
  'ZENDESK_OAUTH_CLIENT_ID', 'ZENDESK_OAUTH_CLIENT_SECRET',
  'QWEN_API_KEY', 'ANTHROPIC_API_KEY',
];

export default function setup(): void {
  const root = dirname(fileURLToPath(import.meta.url));
  // 子进程也要擦干净外部凭据：globalSetup 早于 setupFiles 执行，
  // 不擦的话 seed 会带着真实凭据跑，把演示文章推进生产帮助中心。
  const env = { ...process.env };
  for (const k of EXTERNAL_KEYS) delete env[k];
  execFileSync('npx', ['tsx', join(root, 'src/db/seed.ts')], { stdio: 'inherit', cwd: root, env });
}
