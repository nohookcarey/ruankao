export interface RadarDatum {
  label: string;
  /** 0-1；null 表示该维度还没数据 */
  value: number | null;
}

interface RadarProps {
  data: RadarDatum[];
  /** 画布逻辑尺寸，实际由 CSS 缩放 */
  size?: number;
}

/**
 * 纯 SVG 雷达图：10 个知识域一眼看清强弱分布。
 * 未作答的维度画成 0，但用虚线外圈标出「满格」参照，避免误读成「已考砸」。
 */
export function Radar({ data, size = 300 }: RadarProps) {
  const n = data.length;
  if (n < 3) return null;

  // 画布比绘图区大一圈，给外围标签留位置；否则左右两侧的文字会被 viewBox 裁掉
  const pad = size * 0.12;
  const W = size + pad * 2;
  const c = W / 2;
  const R = size * 0.33;
  const labelR = R + size * 0.075;
  const rings = [0.25, 0.5, 0.75, 1];

  const point = (i: number, r: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + r * Math.cos(angle), c + r * Math.sin(angle)] as const;
  };

  const polygon = (r: number) =>
    data.map((_, i) => point(i, r).join(',')).join(' ');

  const valuePoints = data.map((d, i) => point(i, R * Math.max(0, Math.min(1, d.value ?? 0))));

  return (
    <svg className="radar" viewBox={`0 0 ${W} ${W}`} role="img" aria-label="各知识域掌握度雷达图">
      {rings.map((r) => (
        <polygon key={r} className="radar__grid" points={polygon(R * r)} />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} className="radar__axis" x1={c} y1={c} x2={x} y2={y} />;
      })}

      <polygon className="radar__area" points={valuePoints.map((p) => p.join(',')).join(' ')} />
      {valuePoints.map(([x, y], i) => (
        <circle key={i} className="radar__dot" cx={x} cy={y} r={2.4} />
      ))}

      {data.map((d, i) => {
        const [x, y] = point(i, labelR);
        const anchor = Math.abs(x - c) < 1 ? 'middle' : x > c ? 'start' : 'end';
        return (
          <text
            key={d.label}
            className="radar__label"
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
