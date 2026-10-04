const TZ = "Asia/Tokyo";

const dtfDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dtfDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parts(dtf: Intl.DateTimeFormat, d: Date): Record<string, string> {
  return Object.fromEntries(dtf.formatToParts(d).map((p) => [p.type, p.value]));
}

/** unix秒 → 2026/10/04 19:36 (JST) */
export function fmtDT(ts: number | null | undefined): string {
  if (ts == null) return "—";
  const p = parts(dtfDateTime, new Date(ts * 1000));
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`;
}

/** unix秒 → 2026/10/04 (JST) */
export function fmtDate(ts: number | null | undefined): string {
  if (ts == null) return "—";
  const p = parts(dtfDate, new Date(ts * 1000));
  return `${p.year}/${p.month}/${p.day}`;
}

/** unix秒 → 19:36 (JST) */
export function fmtTime(ts: number | null | undefined): string {
  if (ts == null) return "—";
  const p = parts(dtfDateTime, new Date(ts * 1000));
  return `${p.hour}:${p.minute}`;
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];

/** "2026-10-04" → "2026/10/04" */
export function fmtDateStr(d: string | null | undefined): string {
  if (!d) return "—";
  return d.replaceAll("-", "/");
}

/** "2026-10-04" → "(日)" */
export function fmtWD(d: string): string {
  const dt = new Date(`${d}T00:00:00+09:00`);
  return `(${WD[dt.getDay()]})`;
}

/** 相対時刻: 3分前 / 2時間前 / 2026/10/01 */
export function fmtRel(ts: number | null | undefined): string {
  if (ts == null) return "—";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}日前`;
  return fmtDate(ts);
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("ja-JP");
}

/** 924752379 → 924.8M */
export function fmtCompact(n: number | null | undefined): string {
  if (n == null) return "—";
  const v = Number(n);
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  const v = Number(n);
  if (v === 0) return "$0";
  if (v >= 1000) return `$${Math.round(v).toLocaleString("ja-JP")}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

/** 秒 → 3時間12分 / 12分34秒 / 45秒 */
export function fmtDur(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "—";
  const s = Math.round(sec);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分${s % 60}秒`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間${m % 60}分`;
  return `${Math.floor(h / 24)}日${h % 24}時間`;
}

export function pct(v: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (v / max) * 100));
}
