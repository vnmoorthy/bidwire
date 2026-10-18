export function Sparkline({
  values,
  width = 240,
  height = 48,
  color = "var(--agent)",
  min,
  max,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  min?: number;
  max?: number;
}) {
  if (values.length === 0) return <svg width={width} height={height} />;
  const pts = values.length === 1 ? [values[0], values[0]] : values;
  const lo = min ?? Math.min(...pts);
  const hi = max ?? Math.max(...pts);
  const span = hi - lo || 1;
  const pad = 4;
  const xy = pts.map((v, i) => {
    const x = pad + (i / (pts.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - lo) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${xy[xy.length - 1][0].toFixed(1)},${height} L${xy[0][0].toFixed(1)},${height} Z`;
  const id = `sg${Math.round(Math.random() * 1e9)}`;
  const last = xy[xy.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} />
    </svg>
  );
}
