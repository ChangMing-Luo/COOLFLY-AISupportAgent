/**
 * 向量能力（技术方案 §6.2）——只服务本台内部三用途：
 * 挖掘查重 / 缺口聚类 / 发布门禁代理评测；不服务任何 C 端检索。
 *
 * 实现：进程内字符 n-gram 哈希向量（64 维，L2 归一化），中英文同构、零外部模型下载。
 * 技术方案登记的 fastembed(bge-small-en) 为升级位——接口不变，替换 embed() 实现即可。
 */

export const VECTOR_DIM = 64;

function ngrams(text: string, n: number): string[] {
  const clean = text.replace(/\s+/g, '').toLowerCase();
  if (clean.length < n) return clean ? [clean] : [];
  const out: string[] = [];
  for (let i = 0; i <= clean.length - n; i += 1) out.push(clean.slice(i, i + n));
  return out;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function embed(text: string): number[] {
  const vec = new Array<number>(VECTOR_DIM).fill(0);
  const grams = [...ngrams(text, 2), ...ngrams(text, 3)];
  if (grams.length === 0) return vec;
  for (const g of grams) {
    vec[hash(g) % VECTOR_DIM] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) dot += a[i] * b[i];
  return Number(Math.max(0, Math.min(1, dot)).toFixed(4));
}

export function toPgVector(v: number[]): string {
  return `[${v.join(',')}]`;
}
