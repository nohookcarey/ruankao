import { useEffect, useState } from 'react';
import { STORAGE_ERROR_EVENT } from '../model/state';

/**
 * 本地存储写入失败的全局提示。
 * 隐私模式或配额写满时，作答照样能判分、能看解析，但一条都存不下，
 * 用户不刷新根本发现不了 —— 所以必须在页面上明说。
 */
export function StorageAlert() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onError = () => setFailed(true);
    window.addEventListener(STORAGE_ERROR_EVENT, onError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onError);
  }, []);

  if (!failed) return null;

  return (
    <div className="storage-alert" role="alert">
      <div className="storage-alert__body">
        <strong>本地保存失败</strong>
        <span>
          浏览器存储不可用（可能是隐私/无痕模式，或空间已满）。这次的作答能正常判分，但不会保存，
          刷新后就没了。请退出隐私模式，或到设置里导出备份。
        </span>
      </div>
      <button
        className="storage-alert__close"
        onClick={() => setFailed(false)}
        aria-label="关闭提示"
      >
        ×
      </button>
    </div>
  );
}
