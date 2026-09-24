"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Lightweight SVG charts following the data-viz method:
   thin marks, 4px rounded data-ends, 2px surface gaps, hairline grid,
   text in text tokens, tooltips that list every series at a position,
   legends for >= 2 series.
   ------------------------------------------------------------------ */

export interface Series {
  id: string;
  name: string;
  color: string;
}

const INK = "var(--ds-chart-ink)";
const MUTED = "var(--ds-chart-muted)";
const GRID = "var(--ds-chart-grid)";
const AXIS = "var(--ds-chart-axis)";
const SURFACE = "var(--ds-surface)";

function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number, ticks = 4) {
  if (v <= 0) return ticks;
  const raw = v / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return step * ticks;
}

export function Legend({ series, className, onHover, active }: { series: Series[]; className?: string; onHover?: (id: string | null) => void; active?: string | null }) {
  if (series.length < 2) return null;
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-ds-text-subtle", className)}>
      {series.map((s) => (
        <span key={s.id} className={cn("inline-flex items-center gap-1.5 transition-opacity", active && active !== s.id && "opacity-40")} onMouseEnter={() => onHover?.(s.id)} onMouseLeave={() => onHover?.(null)}>
          <span className="size-2.5 rounded-[2px]" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

/* ---------- Stacked / single-series columns ---------- */
export function ColumnChart({
  categories,
  series,
  values,
  format,
  height = 220,
  className,
  emptyText = "No data for this period",
  grouped = false,
}: {
  categories: { id: string; label: string; sublabel?: string }[];
  series: Series[];
  /** values[categoryId][seriesId] */
  values: Record<string, Record<string, number>>;
  format: (v: number) => string;
  height?: number;
  className?: string;
  emptyText?: string;
  /** Side-by-side bars per series instead of a stack */
  grouped?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);
  const [activeSeries, setActiveSeries] = React.useState<string | null>(null);
  const m = { top: 12, right: 8, bottom: 26, left: 48 };
  const plotW = Math.max(0, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const totals = categories.map((c) => series.reduce((a, s) => a + (values[c.id]?.[s.id] ?? 0), 0));
  const maxSingle = Math.max(0, ...categories.flatMap((c) => series.map((s) => values[c.id]?.[s.id] ?? 0)));
  const max = niceMax(grouped ? maxSingle : Math.max(0, ...totals));
  const ticks = 4;
  const band = categories.length ? plotW / categories.length : 0;
  const thick = grouped ? Math.max(4, Math.min(20, (band * 0.7) / Math.max(1, series.length))) : Math.max(4, Math.min(24, band * 0.6));
  const hasData = totals.some((t) => t > 0);

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          {Array.from({ length: ticks + 1 }).map((_, i) => {
            const y = m.top + plotH - (plotH * i) / ticks;
            return (
              <g key={i}>
                <line x1={m.left} x2={m.left + plotW} y1={y} y2={y} style={{ stroke: i === 0 ? AXIS : GRID }} strokeWidth={1} />
                <text x={m.left - 8} y={y + 3} fontSize={11} style={{ fill: MUTED }} textAnchor="end">
                  {format((max * i) / ticks)}
                </text>
              </g>
            );
          })}
          {categories.map((c, ci) => {
            const x0 = m.left + band * ci + (band - thick) / 2;
            let yCursor = m.top + plotH;
            const segs = series.map((s) => ({ s, v: values[c.id]?.[s.id] ?? 0 })).filter((x) => x.v > 0);
            if (grouped) {
              const groupW = thick * series.length + 2 * (series.length - 1);
              const gx = m.left + band * ci + (band - groupW) / 2;
              return (
                <g key={c.id} onMouseEnter={() => setHover(ci)} onMouseLeave={() => setHover(null)}>
                  <rect x={m.left + band * ci} y={m.top} width={band} height={plotH} style={{ fill: hover === ci ? "var(--ds-bg-neutral-subtle-hovered)" : "transparent" }} />
                  {series.map((s, si) => {
                    const v = values[c.id]?.[s.id] ?? 0;
                    const h = (v / max) * plotH;
                    const x = gx + si * (thick + 2);
                    const y = m.top + plotH - h;
                    const r = Math.min(4, thick / 2, h);
                    const path = h > 0 ? `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + thick - r},${y} Q${x + thick},${y} ${x + thick},${y + r} L${x + thick},${y + h} Z` : "";
                    return path ? <path key={s.id} d={path} style={{ fill: s.color }} opacity={activeSeries && activeSeries !== s.id ? 0.3 : 1} /> : null;
                  })}
                  <text x={m.left + band * ci + band / 2} y={height - 10} fontSize={11} style={{ fill: hover === ci ? INK : MUTED }} textAnchor="middle">
                    {c.label}
                  </text>
                </g>
              );
            }
            return (
              <g key={c.id} onMouseEnter={() => setHover(ci)} onMouseLeave={() => setHover(null)}>
                <rect x={m.left + band * ci} y={m.top} width={band} height={plotH} style={{ fill: hover === ci ? "var(--ds-bg-neutral-subtle-hovered)" : "transparent" }} />
                {segs.map(({ s, v }, si) => {
                  const h = (v / max) * plotH;
                  const gap = si < segs.length - 1 ? 2 : 0;
                  const y = yCursor - h;
                  const isTop = si === segs.length - 1;
                  const r = isTop ? Math.min(4, thick / 2, Math.max(0, h - gap)) : 0;
                  const hh = Math.max(0, h - gap);
                  const path = isTop
                    ? `M${x0},${y + hh} L${x0},${y + r} Q${x0},${y} ${x0 + r},${y} L${x0 + thick - r},${y} Q${x0 + thick},${y} ${x0 + thick},${y + r} L${x0 + thick},${y + hh} Z`
                    : `M${x0},${y + hh} L${x0},${y} L${x0 + thick},${y} L${x0 + thick},${y + hh} Z`;
                  yCursor = y;
                  return <path key={s.id} d={path} style={{ fill: s.color }} opacity={activeSeries && activeSeries !== s.id ? 0.3 : 1} />;
                })}
                <text x={m.left + band * ci + band / 2} y={height - 10} fontSize={11} style={{ fill: hover === ci ? INK : MUTED }} textAnchor="middle">
                  {c.label}
                </text>
              </g>
            );
          })}
          {!hasData && (
            <text x={m.left + plotW / 2} y={m.top + plotH / 2} fontSize={12} style={{ fill: MUTED }} textAnchor="middle">
              {emptyText}
            </text>
          )}
        </svg>
      )}
      {hover !== null && totals[hover] > 0 && (
        <div
          className="pointer-events-none absolute z-20 min-w-40 rounded-ds bg-ds-tooltip px-3 py-2 text-xs text-ds-tooltip-text shadow-ds-overlay"
          style={{ left: Math.min(Math.max(0, m.left + band * hover + band / 2 - 80), Math.max(0, width - 176)), top: m.top - 4, transform: "translateY(-100%)" }}
        >
          <div className="mb-1 font-semibold">{categories[hover].sublabel ?? categories[hover].label}</div>
          {series
            .map((s) => ({ s, v: values[categories[hover].id]?.[s.id] ?? 0 }))
            .filter((x) => x.v > 0)
            .map(({ s, v }) => (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 opacity-80">
                  <span className="h-0.5 w-3 rounded" style={{ background: s.color }} /> {s.name}
                </span>
                <span className="tabular-nums font-semibold">{format(v)}</span>
              </div>
            ))}
          {series.length > 1 && !grouped && (
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-current/20 pt-1">
              <span className="opacity-80">Total</span>
              <span className="tabular-nums font-semibold">{format(totals[hover])}</span>
            </div>
          )}
        </div>
      )}
      <Legend series={series} className="mt-2 pl-12" onHover={setActiveSeries} active={activeSeries} />
    </div>
  );
}

/* ---------- Donut ---------- */
export function Donut({
  data,
  format,
  size = 160,
  thickness = 22,
  centerValue,
  centerLabel,
  className,
  showPercent = true,
}: {
  data: { id: string; name: string; value: number; color: string; icon?: React.ReactNode }[];
  format: (v: number) => string;
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
  className?: string;
  showPercent?: boolean;
}) {
  const [hover, setHover] = React.useState<string | null>(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = size / 2 - 2;
  const ri = r - thickness;
  const cx = size / 2;
  const cy = size / 2;
  const nonZero = data.filter((d) => d.value > 0);
  const gapAngle = nonZero.length > 1 ? 2 / r : 0; // ~2px gap at outer radius

  const arc = (a0: number, a1: number) => {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, ang: number) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
    const [x0, y0] = p(r, a0);
    const [x1, y1] = p(r, a1);
    const [x2, y2] = p(ri, a1);
    const [x3, y3] = p(ri, a0);
    return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${ri},${ri} 0 ${large} 0 ${x3},${y3} Z`;
  };

  const arcs = React.useMemo(() => {
    const out: { d: (typeof data)[number]; a0: number; a1: number }[] = [];
    let angle = -Math.PI / 2;
    for (const d of data) {
      if (d.value <= 0) continue;
      const span = (d.value / total) * Math.PI * 2;
      out.push({ d, a0: angle + gapAngle / 2, a1: angle + span - gapAngle / 2 });
      angle += span;
    }
    return out;
  }, [data, total, gapAngle]);

  return (
    <div className={cn("flex items-center gap-6", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          {total === 0 && <circle cx={cx} cy={cy} r={r - thickness / 2} fill="none" style={{ stroke: "var(--ds-chart-track)" }} strokeWidth={thickness} />}
          {arcs.map(({ d, a0, a1 }) => {
            if (a1 <= a0) return null;
            return (
              <path
                key={d.id}
                d={arc(a0, a1)}
                style={{ fill: d.color }}
                opacity={hover && hover !== d.id ? 0.35 : 1}
                onMouseEnter={() => setHover(d.id)}
                onMouseLeave={() => setHover(null)}
                className="transition-opacity"
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-semibold leading-none text-ds-text">{hover ? format(data.find((d) => d.id === hover)!.value) : centerValue ?? format(total)}</span>
          <span className="mt-1 max-w-[80%] truncate text-[11px] text-ds-text-subtlest">{hover ? data.find((d) => d.id === hover)!.name : centerLabel}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-sm">
        {data.map((d) => (
          <li key={d.id} className={cn("flex items-center gap-2 rounded-ds px-1 py-0.5 transition-opacity", hover && hover !== d.id && "opacity-40")} onMouseEnter={() => setHover(d.id)} onMouseLeave={() => setHover(null)}>
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: d.color }} />
            {d.icon}
            <span className="min-w-0 flex-1 truncate text-ds-text-subtle">{d.name}</span>
            <span className="tabular-nums font-semibold text-ds-text">{format(d.value)}</span>
            {showPercent && <span className="tabular-nums w-10 text-right text-xs text-ds-text-subtlest">{total ? Math.round((d.value / total) * 100) : 0}%</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Horizontal bars (single hue) ---------- */
export function HBars({
  rows,
  format,
  color = "var(--ds-chart-blue)",
  className,
  showPercent,
  labelWidth = 160,
}: {
  rows: { id: string; label: React.ReactNode; value: number; color?: string; href?: string }[];
  format: (v: number) => string;
  color?: string;
  className?: string;
  showPercent?: boolean;
  labelWidth?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <div className={cn("space-y-2", className)}>
      {rows.map((r) => (
        <div key={r.id} className="group/hb flex items-center gap-3 text-sm">
          <div className="flex shrink-0 items-center gap-2 truncate text-ds-text-subtle" style={{ width: labelWidth }}>
            {r.label}
          </div>
          <div className="relative h-4 flex-1 rounded-r-[4px] bg-ds-track/40">
            <div className="absolute inset-y-0 left-0 rounded-r-[4px] transition-all group-hover/hb:brightness-95" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? color }} title={format(r.value)} />
          </div>
          <div className="tabular-nums w-16 shrink-0 text-right text-xs font-semibold text-ds-text">{format(r.value)}</div>
          {showPercent && <div className="tabular-nums w-10 shrink-0 text-right text-xs text-ds-text-subtlest">{total ? Math.round((r.value / total) * 100) : 0}%</div>}
        </div>
      ))}
      {rows.length === 0 && <div className="text-sm text-ds-text-subtlest">No data</div>}
    </div>
  );
}

/* ---------- Line chart (single/multi series) ---------- */
export function LineChart({
  points,
  series,
  format,
  height = 220,
  className,
  guide,
  guideLabel = "Ideal",
}: {
  points: { id: string; label: string }[];
  series: (Series & { values: (number | null)[] })[];
  format: (v: number) => string;
  height?: number;
  className?: string;
  /** Optional reference line values (e.g. ideal burndown), drawn thin and grey */
  guide?: (number | null)[];
  guideLabel?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);
  const m = { top: 12, right: 16, bottom: 26, left: 44 };
  const plotW = Math.max(0, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const all = [...series.flatMap((s) => s.values), ...(guide ?? [])].filter((v): v is number => v !== null);
  const max = niceMax(Math.max(0, ...all));
  const ticks = 4;
  const n = points.length;
  const x = (i: number) => m.left + (n > 1 ? (plotW * i) / (n - 1) : plotW / 2);
  const y = (v: number) => m.top + plotH - (v / max) * plotH;
  const path = (vals: (number | null)[]) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i)},${y(v)} `;
      pen = true;
    });
    return d;
  };

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible" onMouseLeave={() => setHover(null)}>
          {Array.from({ length: ticks + 1 }).map((_, i) => {
            const yy = m.top + plotH - (plotH * i) / ticks;
            return (
              <g key={i}>
                <line x1={m.left} x2={m.left + plotW} y1={yy} y2={yy} style={{ stroke: i === 0 ? AXIS : GRID }} strokeWidth={1} />
                <text x={m.left - 8} y={yy + 3} fontSize={11} style={{ fill: MUTED }} textAnchor="end">{format((max * i) / ticks)}</text>
              </g>
            );
          })}
          {points.map((p, i) => (
            (n <= 10 || i % Math.ceil(n / 10) === 0) && (
              <text key={p.id} x={x(i)} y={height - 10} fontSize={11} style={{ fill: MUTED }} textAnchor="middle">{p.label}</text>
            )
          ))}
          {guide && <path d={path(guide)} fill="none" style={{ stroke: "var(--ds-chart-gray)" }} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
          {series.map((s) => (
            <g key={s.id}>
              <path d={path(s.values)} fill="none" style={{ stroke: s.color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (v !== null && (hover === i || i === s.values.findLastIndex((q) => q !== null)) ? <circle key={i} cx={x(i)} cy={y(v)} r={4} style={{ fill: s.color, stroke: SURFACE }} strokeWidth={2} /> : null))}
            </g>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + plotH} style={{ stroke: "var(--ds-chart-gray)" }} strokeWidth={1} />}
          {points.map((_, i) => (
            <rect key={i} x={x(i) - (n > 1 ? plotW / (n - 1) / 2 : plotW / 2)} y={m.top} width={n > 1 ? plotW / (n - 1) : plotW} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
      )}
      {hover !== null && (
        <div className="pointer-events-none absolute z-20 min-w-36 rounded-ds bg-ds-tooltip px-3 py-2 text-xs text-ds-tooltip-text shadow-ds-overlay" style={{ left: Math.min(Math.max(0, x(hover) - 72), Math.max(0, width - 160)), top: m.top - 4, transform: "translateY(-100%)" }}>
          <div className="mb-1 font-semibold">{points[hover].label}</div>
          {series.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 opacity-80"><span className="h-0.5 w-3 rounded" style={{ background: s.color }} /> {s.name}</span>
              <span className="tabular-nums font-semibold">{s.values[hover] === null ? "—" : format(s.values[hover]!)}</span>
            </div>
          ))}
          {guide && guide[hover] !== null && (
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 opacity-80"><span className="h-0.5 w-3 rounded bg-chart-gray" /> {guideLabel}</span>
              <span className="tabular-nums font-semibold">{format(guide[hover]!)}</span>
            </div>
          )}
        </div>
      )}
      <Legend series={[...series, ...(guide ? [{ id: "_guide", name: guideLabel, color: "var(--ds-chart-gray)" }] : [])]} className="mt-2 pl-11" />
    </div>
  );
}

/* ---------- Stat tile ---------- */
export function StatTile({ label, value, hint, icon, iconBg, href, className }: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; iconBg?: string; href?: string; className?: string }) {
  const inner = (
    <div className={cn("flex items-center gap-3 rounded-ds-lg border border-ds-border bg-ds-surface px-4 py-3 shadow-ds-raised", href && "transition-colors hover:bg-ds-surface-hovered", className)}>
      {icon && (
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full [&>svg]:size-5" style={{ background: iconBg ?? "var(--ds-bg-information)" }}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div className="text-2xl font-semibold leading-7 text-ds-text">{value}</div>
        <div className="truncate text-xs text-ds-text-subtle">{label}</div>
        {hint && <div className="truncate text-[11px] text-ds-text-subtlest">{hint}</div>}
      </div>
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

export function ChartCard({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-ds-lg border border-ds-border bg-ds-surface p-5 shadow-ds-raised", className)}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="ds-heading-md">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ds-text-subtlest">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
