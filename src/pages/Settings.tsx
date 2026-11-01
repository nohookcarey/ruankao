import { useRef, useState } from 'react';
import { useApp } from '../model/StateContext';
import {
  decodeSyncCode,
  encodeSyncCode,
  exportJSON,
  parseImport,
} from '../model/state';

export function Settings() {
  const { state, updateSettings, replaceState, reset } = useApp();
  const [toast, setToast] = useState('');
  const [syncCode, setSyncCode] = useState('');
  const [pasteCode, setPasteCode] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2200);
  };

  const doExport = () => {
    const data = exportJSON(state);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `ruankao-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate(),
    ).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('已导出备份文件');
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = parseImport(String(reader.result ?? ''));
        replaceState(next);
        flash('导入成功，记录已恢复');
      } catch (e) {
        flash(`导入失败：${(e as Error).message}`);
      }
    };
    reader.readAsText(file);
  };

  const genCode = () => {
    const code = encodeSyncCode(state);
    setSyncCode(code);
    flash('同步码已生成，复制后发到另一台设备');
  };

  const copyCode = async () => {
    if (!syncCode) return;
    try {
      await navigator.clipboard.writeText(syncCode);
      flash('已复制到剪贴板');
    } catch {
      flash('复制失败，请手动长按选择文本');
    }
  };

  const applyCode = () => {
    if (!pasteCode.trim()) return;
    try {
      const next = decodeSyncCode(pasteCode);
      replaceState(next);
      setPasteCode('');
      flash('同步完成，记录已覆盖为本机最新');
    } catch (e) {
      flash(`同步码无效：${(e as Error).message}`);
    }
  };

  return (
    <div className="page">
      <h1 className="h1">设置</h1>
      <p className="sub">所有数据仅保存在本机浏览器，不会有任何上传</p>

      <div className="setting-group">
        <div className="setting-title">外观</div>
        <div className="card" style={{ padding: 12 }}>
          <div className="seg">
            {(['auto', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                className={`seg__item${state.settings.theme === t ? ' is-active' : ''}`}
                onClick={() => updateSettings({ theme: t })}
              >
                {t === 'auto' ? '跟随系统' : t === 'light' ? '浅色' : '深色'}
              </button>
            ))}
          </div>
          <div className="seg" style={{ marginTop: 10 }}>
            {([0, 1, 2] as const).map((f) => (
              <button
                key={f}
                className={`seg__item${state.settings.fontScale === f ? ' is-active' : ''}`}
                onClick={() => updateSettings({ fontScale: f })}
              >
                {f === 0 ? '标准字号' : f === 1 ? '大字号' : '特大字号'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="setting-group">
        <div className="setting-title">答题</div>
        <div className="card">
          <div className="setting-row">
            <div className="setting-row__main">
              <div className="setting-row__title">练习模式即时判定</div>
              <div className="setting-row__desc">
                选中选项后立刻显示对错与解析；关闭后需点「确认答案」
              </div>
            </div>
            <button
              className={`switch${state.settings.immediateJudge ? ' is-on' : ''}`}
              onClick={() => updateSettings({ immediateJudge: !state.settings.immediateJudge })}
              aria-label="切换即时判定"
            />
          </div>
        </div>
      </div>

      <div className="setting-group">
        <div className="setting-title">数据备份（跨设备唯一途径）</div>
        <div className="card">
          <button className="setting-row" style={{ width: '100%' }} onClick={doExport}>
            <div className="setting-row__main">
              <div className="setting-row__title">导出 JSON 备份</div>
              <div className="setting-row__desc">下载到本机，可用于换设备或长期存档</div>
            </div>
            <span className="chevron">›</span>
          </button>
          <button
            className="setting-row"
            style={{ width: '100%' }}
            onClick={() => fileRef.current?.click()}
          >
            <div className="setting-row__main">
              <div className="setting-row__title">从文件导入恢复</div>
              <div className="setting-row__desc">会覆盖当前进度，请先确认已备份</div>
            </div>
            <span className="chevron">›</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = '';
            }}
          />

          <div style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
            <div className="setting-row__title" style={{ marginBottom: 6 }}>
              同步码（手机 ↔ 电脑最省事）
            </div>
            <div className="setting-row__desc" style={{ marginBottom: 10 }}>
              生成一段压缩文本，通过微信发到另一台设备粘贴即可恢复
            </div>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn--ghost btn--sm" onClick={genCode}>
                生成同步码
              </button>
              {syncCode && (
                <button className="btn btn--primary btn--sm" onClick={copyCode}>
                  复制
                </button>
              )}
            </div>
            {syncCode && (
              <textarea
                className="textarea"
                style={{ marginTop: 10 }}
                readOnly
                value={syncCode}
                onFocus={(e) => e.currentTarget.select()}
              />
            )}

            <div className="divider" />
            <div className="setting-row__title" style={{ marginBottom: 6 }}>
              粘贴同步码恢复
            </div>
            <textarea
              className="textarea"
              placeholder="把另一台设备生成的同步码粘贴到这里"
              value={pasteCode}
              onChange={(e) => setPasteCode(e.target.value)}
            />
            <button
              className="btn btn--primary btn--block mt8"
              disabled={!pasteCode.trim()}
              onClick={applyCode}
            >
              应用同步码
            </button>
          </div>
        </div>
      </div>

      <div className="setting-group">
        <div className="setting-title">危险操作</div>
        <div className="card">
          <button
            className="setting-row"
            style={{ width: '100%' }}
            onClick={() => {
              if (window.confirm('将清空全部答题记录、错题、收藏与模考成绩，且无法恢复。确定吗？')) {
                reset();
                flash('已清空全部记录');
              }
            }}
          >
            <div className="setting-row__main">
              <div className="setting-row__title" style={{ color: 'var(--bad)' }}>
                清空所有记录
              </div>
              <div className="setting-row__desc">不可恢复，建议先导出备份</div>
            </div>
            <span className="chevron">›</span>
          </button>
        </div>
      </div>

      <p className="sub" style={{ textAlign: 'center', marginTop: 28, lineHeight: 1.9 }}>
        软考·软件设计师刷题 · 静态站点 / PWA
        <br />
        题库仅供个人学习使用，请勿用于商业传播
      </p>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
