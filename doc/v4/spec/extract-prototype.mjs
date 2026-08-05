// 从 v4 打包原型（dc-runtime bundle）里解出模板 / 逻辑 / 设计 tokens。
// 用法：node doc/v4/spec/extract-prototype.mjs
// 产物：doc/v4/spec/{prototype.template.html, prototype.logic.js, tokens.css, page.html}
//
// 原型结构：单文件 HTML，第 393 行是 __bundler/manifest（base64+gzip 的资源表，
// 含 React UMD、字体、页面脚本），第 405 行是 __bundler/template（JSON 字符串形式的整页 HTML）。
// 整页 HTML 里：<x-dc> 内是模板，<script data-dc-script> 内是组件逻辑，<helmet> 内是样式。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'COOLFLY 知识运营中台 (offline).html');
const lines = fs.readFileSync(src, 'utf8').split('\n');

const templateLine = lines.findIndex((l) => l.trim().startsWith('"<!DOCTYPE html>'));
if (templateLine < 0) throw new Error('未找到 __bundler/template 行');
const page = JSON.parse(lines[templateLine]);
fs.writeFileSync(path.join(here, 'page.html'), page);

const pageLines = page.split('\n');
const scriptStart = pageLines.findIndex((l) => l.includes('data-dc-script'));
if (scriptStart < 0) throw new Error('未找到 data-dc-script');

// 模板：<x-dc> 之后、</helmet> 之后到 script 之前
const helmetEnd = pageLines.findIndex((l) => l.trim() === '</helmet>');
fs.writeFileSync(
  path.join(here, 'prototype.template.html'),
  pageLines.slice(helmetEnd + 1, scriptStart).join('\n'),
);
const scriptEnd = pageLines.findIndex((l, i) => i > scriptStart && l.trim() === '</script>');
fs.writeFileSync(
  path.join(here, 'prototype.logic.js'),
  pageLines.slice(scriptStart + 1, scriptEnd).join('\n') + '\n',
);

// 设计 tokens：:root 起，到该 <style> 块结束；再拼 CJK 回退与页面级补充样式
const rootStart = pageLines.findIndex((l) => l.trim() === ':root {');
const styleEnds = pageLines.reduce((acc, l, i) => (l.trim() === '</style>' ? [...acc, i] : acc), []);
const tokensEnd = styleEnds.find((i) => i > rootStart);
const tail = styleEnds.filter((i) => i > tokensEnd);
const css = [
  '/* v4 原型设计系统（Classical）——从 doc/v4/COOLFLY 知识运营中台 (offline).html 原样抽出。',
  '   已剔除 @font-face（原型内联 woff2，工程实现改用 Google Fonts / 本地字体）。 */',
  '',
  pageLines.slice(rootStart, tokensEnd).join('\n'),
  '',
  '/* CJK 回退 */',
  pageLines.slice(tokensEnd + 2, tail[0]).join('\n'),
  '',
  '/* 页面级补充样式（动画 / contenteditable） */',
  pageLines.slice(tail[0] + 3, tail[1]).join('\n'),
].join('\n');
fs.writeFileSync(path.join(here, 'tokens.css'), css);

console.log('已导出 prototype.template.html / prototype.logic.js / tokens.css / page.html');
