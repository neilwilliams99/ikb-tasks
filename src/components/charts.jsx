import { useState, useRef, useEffect } from "react";

// ─── CHARTS (plain SVG) ────────────────────────────────────────────────────
// Series colours, validated for colour-blind separation and contrast on the
// card background (#111820). Assign in this order, never cycled; colour
// follows the loan, so a loan keeps its colour when others are hidden.
export const SERIES = ["#14a8a8", "#d95926", "#9085e9", "#c98500", "#d55181"];
export const seriesColor = (i) => SERIES[i % SERIES.length];

const PAD = { top: 12, right: 12, bottom: 26, left: 64 };

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Round axis maximum and 4–5 ticks
function ticks(max) {
  if (max <= 0) return { top: 1, list: [0] };
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  const list = [];
  for (let v = 0; v <= top + step / 2; v += step) list.push(v);
  return { top, list };
}
const short = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(v % 1e6 ? 1 : 0)}m` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);
const full = (v) => "$" + Math.round(v).toLocaleString("en-AU");

function Legend({ series }) {
  if (series.length < 2) return null;
  return (
    <div className="chart-legend">
      {series.map((s) => (
        <span key={s.name}><i style={{ background: s.dash ? "transparent" : s.color, borderColor: s.color, borderStyle: s.dash ? "dashed" : "solid" }} />{s.name}</span>
      ))}
    </div>
  );
}

function Tooltip({ x, w, title, items, total }) {
  const left = x > w / 2 ? undefined : x + 14;
  const right = x > w / 2 ? w - x + 14 : undefined;
  return (
    <div className="chart-tip" style={{ left, right }}>
      <div className="tip-title">{title}</div>
      {items.map((it) => (
        <div key={it.name} className="tip-row"><i style={{ background: it.color }} /><span>{it.name}</span><b>{full(it.value)}</b></div>
      ))}
      {total != null && <div className="tip-row total"><span>Total</span><b>{full(total)}</b></div>}
    </div>
  );
}

// Over time: stacked areas (stack) or separate lines. `labels[i]` names
// point i; each series has `values` the same length as labels.
export function TimeChart({ labels, series, stack = false, height = 240, tickEvery = 12, tickLabel }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const n = labels.length;
  const iw = w - PAD.left - PAD.right, ih = height - PAD.top - PAD.bottom;
  const cum = series.map((_, si) => labels.map((_, i) => (stack ? series.slice(0, si + 1) : [series[si]]).reduce((s, x) => s + (x.values[i] || 0), 0)));
  const max = Math.max(0, ...cum.flat());
  const { top, list } = ticks(max);
  const x = (i) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const y = (v) => PAD.top + ih - (v / top) * ih;
  const path = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - PAD.left) / iw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <div ref={ref} className="chart">
      <Legend series={series} />
      <div style={{ position: "relative" }}>
        <svg width={w} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
          {list.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="axis">{short(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % tickEvery === 0 && i > 0 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="axis">{tickLabel ? tickLabel(i, l) : l}</text>
          ) : null))}
          {stack && series.map((s, si) => {
            const lower = si ? cum[si - 1] : labels.map(() => 0);
            const d = path(cum[si]) + lower.map((v, i) => `L${x(n - 1 - i).toFixed(1)},${y(lower[n - 1 - i]).toFixed(1)}`).join("") + "Z";
            return <path key={s.name} d={d} fill={s.color} fillOpacity={0.35} />;
          })}
          {series.map((s, si) => (
            <path key={s.name} d={path(cum[si])} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash ? "5 4" : undefined} />
          ))}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} className="crosshair" />
              {series.map((s, si) => <circle key={s.name} cx={x(hover)} cy={y(cum[si][hover])} r={4} fill={s.color} stroke="#111820" strokeWidth={2} />)}
            </g>
          )}
        </svg>
        {hover != null && (
          <Tooltip x={x(hover)} w={w} title={labels[hover]}
            items={series.map((s) => ({ name: s.name, color: s.color, value: s.values[hover] || 0 }))}
            total={stack && series.length > 1 ? cum[series.length - 1][hover] : null} />
        )}
      </div>
    </div>
  );
}

// Stacked bars, one per label (e.g. per year)
export function BarChart({ labels, series, height = 240 }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const n = labels.length;
  const iw = w - PAD.left - PAD.right, ih = height - PAD.top - PAD.bottom;
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] || 0), 0));
  const { top, list } = ticks(Math.max(0, ...totals));
  const slot = iw / Math.max(1, n);
  const bw = Math.max(2, Math.min(28, slot * 0.7));
  const y = (v) => PAD.top + ih - (v / top) * ih;
  const every = Math.ceil(n / Math.max(1, Math.floor(iw / 44)));

  return (
    <div ref={ref} className="chart">
      <Legend series={series} />
      <div style={{ position: "relative" }}>
        <svg width={w} height={height} onMouseLeave={() => setHover(null)} role="img">
          {list.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="axis">{short(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            let acc = 0;
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={ih} fill={hover === i ? "rgba(0,146,146,0.07)" : "transparent"} />
                {series.map((s, si) => {
                  const v = s.values[i] || 0;
                  const y0 = y(acc), y1 = y(acc + v);
                  acc += v;
                  const h = Math.max(0, y0 - y1 - (si ? 2 : 0)); // 2px gap between segments
                  return h > 0 ? <rect key={s.name} x={cx - bw / 2} y={y1} width={bw} height={h} rx={si === series.length - 1 ? 3 : 0} fill={s.color} /> : null;
                })}
                {i % every === 0 && <text x={cx} y={height - 8} textAnchor="middle" className="axis">{l}</text>}
              </g>
            );
          })}
        </svg>
        {hover != null && (
          <Tooltip x={PAD.left + slot * hover + slot / 2} w={w} title={labels[hover]}
            items={series.map((s) => ({ name: s.name, color: s.color, value: s.values[hover] || 0 }))}
            total={series.length > 1 ? totals[hover] : null} />
        )}
      </div>
    </div>
  );
}
