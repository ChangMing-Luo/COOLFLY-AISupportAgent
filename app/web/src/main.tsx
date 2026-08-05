import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 自托管字体（与原型 Classical 设计系统一致：标题 Cormorant Garamond，正文 Lora）
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/500.css';
import '@fontsource/lora/600.css';
import './tokens.css';
import { App } from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
