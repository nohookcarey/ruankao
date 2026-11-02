import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * 兜底错误边界：任何页面渲染异常时给出可操作的恢复入口，
 * 而不是留一个白屏让用户以为「网站挂了 / 404 了」。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ruankao] 渲染异常', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  private resetCache = () => {
    // 清掉本地学习数据之外的东西：Service Worker 与 Cache Storage
    void (async () => {
      try {
        const regs = await navigator.serviceWorker?.getRegistrations?.();
        await Promise.all((regs ?? []).map((r) => r.unregister()));
        const keys = await caches?.keys?.();
        await Promise.all((keys ?? []).map((k) => caches.delete(k)));
      } catch {
        /* 忽略：清不掉也能刷新 */
      }
      window.location.reload();
    })();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="error-boundary">
        <div className="error-boundary__icon">⚠️</div>
        <div className="error-boundary__title">页面出了点问题</div>
        <div className="error-boundary__desc">
          你的练习记录不会丢失，重新加载即可继续。
        </div>
        <pre className="error-boundary__msg">{this.state.error.message}</pre>
        <div className="error-boundary__actions">
          <button className="btn btn--primary" onClick={this.reload}>
            重新加载
          </button>
          <button className="btn" onClick={this.resetCache}>
            清除缓存并重载
          </button>
        </div>
      </div>
    );
  }
}
