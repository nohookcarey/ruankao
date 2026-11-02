import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/global.css';

/**
 * GitHub Pages 上没有 hash 的深链接（如 /ruankao/today）有两种下场：
 * 1. 没有 Service Worker 时，服务端找不到文件，落到 public/404.html 兜底；
 * 2. 装了 Service Worker 后，navigateFallback 直接返回 index.html，内容能显示，
 *    但地址栏还是错的，刷新/收藏都会留下坏链接。
 * 这里在渲染前统一纠正成 hash 路由，保证地址栏始终是 /ruankao/#/xxx。
 */
const BASE = '/ruankao/';
const SKIP = new Set(['', '/', '/index.html', '/404.html', '/404']);

/**
 * 部署新版本后文件名哈希会变，已打开的旧页面仍指向旧 chunk，加载即 404。
 * 捕获 Vite 的 preloadError 后直接刷新，拿到新版本。
 */
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  window.location.reload();
});

/** 返回 true 表示正在跳转，此时不渲染，避免先闪一下首页 */
function normalizeDeepLink(): boolean {
  const pathname = window.location.pathname;
  if (!pathname.startsWith('/ruankao')) return false;

  const sub = pathname.slice('/ruankao'.length).replace(/\/+$/, '');
  if (SKIP.has(sub)) return false;

  const route = sub.startsWith('/') ? sub : '/' + sub;
  window.location.replace(
    BASE + '#' + route + window.location.search + window.location.hash,
  );
  return true;
}

if (!normalizeDeepLink()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
