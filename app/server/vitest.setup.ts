/**
 * 测试前置守卫：**强制沙箱**，禁止测试触碰真实外部系统。
 *
 * 配了 .env 之后（真实 Zendesk OAuth + 真实千问 key），只要 shell 里 export 过这些变量，
 * vitest 里的 upsertArticle 就会往**生产帮助中心**真写文章、archiveArticle 会真归档，
 * LLM 断言也会变成不可复现的网络调用。这不是假设——RULE-04 / FLOW-08 都会调用它们。
 *
 * 所以在任何模块加载前清空外部凭据：测试只跑沙箱 + 本地 provider，
 * 真实依赖的验证走独立的 LIVE 验收（见 TDD 契约 §6），不与单测混跑。
 */
for (const key of [
  'ZENDESK_SUBDOMAIN',
  'ZENDESK_EMAIL',
  'ZENDESK_API_TOKEN',
  'ZENDESK_OAUTH_CLIENT_ID',
  'ZENDESK_OAUTH_CLIENT_SECRET',
  'QWEN_API_KEY',
  'ANTHROPIC_API_KEY',
]) {
  delete process.env[key];
}
