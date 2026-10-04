import Link from "next/link";
import type { ReactNode } from "react";
import { fmtDateStr, fmtInt, fmtWD } from "@/lib/format";

// ------------------------------------------------------------------ Panel

export function Panel({
  title,
  action,
  children,
  className = "",
  pad = true,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-line bg-panel ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-2.5">
          <h2 className="text-[13px] font-semibold tracking-wide text-ink/90">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ KPI

export function Kpi({
  label,
  value,
  sub,
  delta,
  title,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: number | null;
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3" title={title}>
      <div className="text-[11px] text-mut">{label}</div>
      <div className="mt-1 text-[22px] font-semibold leading-tight tabular-nums">{value}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-dim">
        {delta != null && (
          <span className={delta >= 0 ? "text-ok" : "text-bad"}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Horizontal bars

export interface BarItem {
  label: ReactNode;
  value: number;
  valueText: string;
  sub?: ReactNode;
  href?: string;
  title?: string;
}

export function BarRows({ items, barClass = "bg-acc/70" }: { items: BarItem[]; barClass?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <div
          key={i}
          className="grid grid-cols-[minmax(64px,170px)_1fr_minmax(84px,auto)] items-center gap-x-3"
          title={it.title}
        >
          <div className="truncate text-[12px] text-ink/90">
            {it.href ? (
              <Link href={it.href} className="hover:text-acc">
                {it.label}
              </Link>
            ) : (
              it.label
            )}
          </div>
          <div className="h-[7px] overflow-hidden rounded-full bg-panel2">
            <div
              className={`h-full rounded-full ${barClass}`}
              style={{ width: `${Math.max((it.value / max) * 100, 0.5)}%` }}
            />
          </div>
          <div className="text-right">
            <div className="text-[12px] tabular-nums leading-4 text-ink/90">{it.valueText}</div>
            {it.sub && <div className="text-[10px] leading-3 text-dim">{it.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Vertical bars

export function VBars({
  items,
  height = 150,
  unit = "日",
}: {
  items: { d: string; v: number; title: string }[];
  height?: number;
  unit?: string;
}) {
  if (items.length === 0) return <div className="text-xs text-dim">データなし</div>;
  const max = Math.max(...items.map((i) => i.v), 1);
  return (
    <div>
      <div className="mb-1 text-right text-[10px] text-dim">
        最大 {fmtInt(max)} / {unit}
      </div>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {items.map((it) => (
          <div key={it.d} className="group flex h-full flex-1 items-end" title={it.title}>
            <div
              className="w-full rounded-t-[2px] bg-acc/55 group-hover:bg-acc"
              style={{ height: it.v === 0 ? 1 : `${Math.max((it.v / max) * 100, 1.5)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-dim">
        <span>{items.length ? `${fmtDateStr(items[0].d)}${fmtWD(items[0].d)}` : ""}</span>
        <span>{items.length ? `${fmtDateStr(items[items.length - 1].d)}${fmtWD(items[items.length - 1].d)}` : ""}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Heatmap (曜日 × 時間)

export function HourHeatmap({ cells }: { cells: { wd: number; hr: number; c: number }[] }) {
  const map = new Map(cells.map((c) => [`${c.wd}:${c.hr}`, c.c]));
  const max = Math.max(...cells.map((c) => c.c), 1);
  const order = [1, 2, 3, 4, 5, 6, 0]; // 月 .. 日
  const wdLabel = ["日", "月", "火", "水", "木", "金", "土"];
  const shade = (v: number) =>
    v <= 0
      ? "bg-panel2/70"
      : ["bg-acc/20", "bg-acc/35", "bg-acc/55", "bg-acc/75", "bg-acc"][
          Math.min(4, Math.floor((v / max) * 5))
        ];
  return (
    <div>
      <div
        className="grid pb-1 text-[9px] leading-none text-dim"
        style={{ gridTemplateColumns: "1.6rem repeat(24, minmax(0, 1fr))" }}
      >
        <div />
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
          <div key={h} style={{ gridColumn: `${h + 2} / span 3` }}>
            {h}
          </div>
        ))}
      </div>
      {order.map((wd) => (
        <div
          key={wd}
          className="grid items-center gap-y-[3px]"
          style={{ gridTemplateColumns: "1.6rem repeat(24, minmax(0, 1fr))" }}
        >
          <div className="pr-1 text-right text-[10px] text-mut">{wdLabel[wd]}</div>
          {Array.from({ length: 24 }, (_, hr) => {
            const v = map.get(`${wd}:${hr}`) ?? 0;
            return (
              <div
                key={hr}
                title={`${wdLabel[wd]}曜 ${hr}時台: ${fmtInt(v)} メッセージ`}
                className={`mx-[1px] mb-[3px] h-[13px] rounded-[2px] ${shade(v)}`}
              />
            );
          })}
        </div>
      ))}
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-dim">
        <span>少</span>
        {["bg-panel2/70", "bg-acc/20", "bg-acc/35", "bg-acc/55", "bg-acc/75", "bg-acc"].map((c) => (
          <span key={c} className={`h-[10px] w-[10px] rounded-[2px] ${c}`} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Calendar (GitHub風)

export function CalGrid({
  days,
  hrefBase = "/timeline",
}: {
  days: { d: string; c: number; s: number }[];
  hrefBase?: string;
}) {
  if (days.length === 0) return null;
  const map = new Map(days.map((x) => [x.d, x]));
  const first = days[0].d;
  const last = days[days.length - 1].d;
  const fmt = (dt: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dt);
  const startDt = new Date(`${first}T00:00:00+09:00`);
  startDt.setTime(startDt.getTime() - startDt.getDay() * 86400_000);
  const dates: string[] = [];
  const cur = new Date(startDt);
  for (let i = 0; i < 400; i++) {
    const s = fmt(cur);
    dates.push(s);
    if (s >= last) break;
    cur.setTime(cur.getTime() + 86400_000);
  }
  const weeks: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) weeks.push(dates.slice(i, i + 7));

  const nz = days
    .map((x) => x.c)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const q = (p: number) => nz[Math.min(nz.length - 1, Math.max(0, Math.floor(nz.length * p)))] ?? 1;
  const t1 = q(0.25),
    t2 = q(0.5),
    t3 = q(0.75);
  const shade = (v: number) =>
    v <= 0 ? "bg-panel2" : v <= t1 ? "bg-acc/30" : v <= t2 ? "bg-acc/55" : v <= t3 ? "bg-acc/80" : "bg-acc";

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-[3px] pb-1 pl-[25px] text-[10px] leading-none text-dim">
        {weeks.map((wk, i) => {
          const m = wk[0].slice(0, 7);
          const prev = i > 0 ? weeks[i - 1][0].slice(0, 7) : "";
          return (
            <div key={i} className="w-[13px] shrink-0">
              {m !== prev ? `${parseInt(m.slice(5), 10)}月` : ""}
            </div>
          );
        })}
      </div>
      <div className="flex gap-[3px]">
        <div className="flex w-[22px] shrink-0 flex-col gap-[3px] pr-1 text-right text-[9px] leading-[13px] text-dim">
          {["", "月", "", "水", "", "金", ""].map((t, i) => (
            <div key={i} className="h-[13px]">
              {t}
            </div>
          ))}
        </div>
        {weeks.map((wk, i) => (
          <div key={i} className="flex shrink-0 flex-col gap-[3px]">
            {wk.map((d) => {
              const e = map.get(d);
              const v = e?.c ?? 0;
              const s = e?.s ?? 0;
              return (
                <Link
                  key={d}
                  href={`${hrefBase}?date=${d}`}
                  title={`${fmtDateStr(d)} ${fmtWD(d)}: メッセージ ${fmtInt(v)}・開始 ${fmtInt(s)} セッション`}
                  className={`h-[13px] w-[13px] rounded-[3px] hover:ring-1 hover:ring-acc ${
                    d > last ? "opacity-0" : shade(v)
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 pl-[25px] text-[10px] text-dim">
        <span>少</span>
        {["bg-panel2", "bg-acc/30", "bg-acc/55", "bg-acc/80", "bg-acc"].map((c) => (
          <span key={c} className={`h-[10px] w-[10px] rounded-[2px] ${c}`} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Badges

const SOURCE_COLORS: Record<string, string> = {
  desktop: "#1d9bf0",
  telegram: "#2aabee",
  discord: "#7289da",
  cli: "#94a3b8",
  subagent: "#a78bfa",
  cron: "#fbbf24",
  api_server: "#34d399",
  android: "#3ddc84",
  tui: "#f472b6",
  oneshot: "#64748b",
};

export function SourceBadge({ source }: { source: string }) {
  const c = SOURCE_COLORS[source] ?? "#64748b";
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-[1px] text-[10px] leading-3"
      style={{ borderColor: `${c}66`, color: c }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {source}
    </span>
  );
}

const ROLE_STYLE: Record<string, string> = {
  user: "text-acc border-acc/40 bg-acc/10",
  assistant: "text-ok border-ok/40 bg-ok/10",
  tool: "text-warn border-warn/40 bg-warn/10",
  session_meta: "text-mut border-line bg-panel2",
};

const ROLE_LABEL: Record<string, string> = {
  user: "ユーザー",
  assistant: "アシスタント",
  tool: "ツール",
  session_meta: "メタ",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded border px-1.5 py-[1px] text-[10px] leading-3 ${
        ROLE_STYLE[role] ?? ROLE_STYLE.session_meta
      }`}
    >
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

export function ToolChip({ name }: { name: string }) {
  return (
    <span className="whitespace-nowrap rounded border border-warn/30 bg-warn/10 px-1.5 py-[1px] font-mono text-[10px] leading-3 text-warn">
      {name}
    </span>
  );
}
