import Link from "next/link";
import {
  BarRows,
  HourHeatmap,
  Kpi,
  Panel,
  SourceBadge,
  VBars,
} from "@/components/charts";
import {
  fmtCompact,
  fmtDT,
  fmtDate,
  fmtDateStr,
  fmtInt,
  fmtUsd,
  fmtWD,
} from "@/lib/format";
import {
  dailyMessages,
  dailySessions,
  fillDays,
  heatmap,
  listSessions,
  messageTrend,
  modelStats,
  sessionTrend,
  sourceStats,
  toolStats,
  totals,
} from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "ダッシュボード" };

const RANGES: [string, string][] = [
  ["7", "7日"],
  ["30", "30日"],
  ["90", "90日"],
  ["all", "全期間"],
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = RANGES.some(([k]) => k === sp.range) ? sp.range! : "90";
  const days = range === "all" ? null : parseInt(range, 10);

  const t = totals();
  const mt = messageTrend();
  const st = sessionTrend();
  const dmsg = dailyMessages(days);
  const dsess = dailySessions(days);
  const smap = new Map(dsess.map((r) => [r.d, r.s]));
  const series = fillDays(
    new Map(dmsg.map((r) => [r.d, r.c])),
    days,
    dmsg[0]?.d ?? "",
    dmsg[dmsg.length - 1]?.d ?? "",
  );
  const rangeMsgs = series.reduce((a, b) => a + b.v, 0);
  const peak = series.reduce((a, b) => (b.v > a.v ? b : a), { d: "", v: 0 });
  const heat = heatmap();
  const models = modelStats(12);
  const sources = sourceStats();
  const tools = toolStats(15);
  const recent = listSessions({ sort: "recent", page: 1, per: 10 });

  const delta = (c: number, p: number) =>
    p > 0 ? Math.round(((c - p) / p) * 100) : null;

  return (
    <div className="mx-auto max-w-[1440px]">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">ダッシュボード</h1>
        <p className="mt-0.5 text-[12px] text-mut">
          Hermes の state.db を直接集計 — 全 {fmtInt(t.sessions)} セッション /{" "}
          {fmtInt(t.messages)} メッセージ / {fmtInt(t.api_calls)} APIコール（KPI は全期間）
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="セッション"
          value={fmtInt(t.sessions)}
          delta={delta(st.cur, st.prev)}
          sub="前30日比"
          title={`直近30日 ${fmtInt(st.cur)} / その前30日 ${fmtInt(st.prev)}`}
        />
        <Kpi
          label="メッセージ"
          value={fmtInt(t.messages)}
          delta={delta(mt.cur, mt.prev)}
          sub="前30日比"
          title={`直近30日 ${fmtInt(mt.cur)} / その前30日 ${fmtInt(mt.prev)}`}
        />
        <Kpi
          label="ツール実行"
          value={fmtInt(t.tools)}
          sub={`ユーザー発話 ${fmtInt(t.users)}`}
        />
        <Kpi
          label="トークン 入 / 出"
          value={`${fmtCompact(t.in_tok)} / ${fmtCompact(t.out_tok)}`}
          sub={`キャッシュ読 ${fmtCompact(t.cache_r)}`}
          title={`入力 ${fmtInt(t.in_tok)} / 出力 ${fmtInt(t.out_tok)} / キャッシュ読 ${fmtInt(t.cache_r)}`}
        />
        <Kpi
          label="推定コスト"
          value={fmtUsd(t.cost)}
          sub="DB記録の生値"
          title="estimated_cost_usd の合計。一部プロバイダの計上異常を含む場合あり"
        />
        <Kpi
          label="稼働日数"
          value={`${fmtInt(t.active_days)}日`}
          sub={`${fmtDate(t.first_ts)} 〜`}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_420px]">
        <Panel
          title="アクティビティ（1日あたりメッセージ数）"
          action={
            <div className="flex items-center gap-0.5 rounded-lg border border-line bg-panel2/60 p-0.5">
              {RANGES.map(([k, label]) => (
                <Link
                  key={k}
                  href={`/?range=${k}`}
                  className={`rounded-md px-2.5 py-1 text-[11px] ${
                    range === k
                      ? "bg-acc/20 font-medium text-acc"
                      : "text-mut hover:text-ink"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          }
        >
          <VBars
            items={series.map((x) => ({
              d: x.d,
              v: x.v,
              title: `${fmtDateStr(x.d)}${fmtWD(x.d)}: ${fmtInt(x.v)} メッセージ / ${
                smap.get(x.d) ?? 0
              } セッション`,
            }))}
            height={170}
          />
          <div className="mt-1.5 flex justify-between text-[11px] text-dim">
            <span>合計 {fmtInt(rangeMsgs)}</span>
            <span>
              ピーク {fmtDateStr(peak.d)}・{fmtInt(peak.v)}
            </span>
          </div>
        </Panel>
        <Panel title="時間帯 × 曜日（全期間・メッセージ）">
          <HourHeatmap cells={heat} />
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="モデル別トークン（session_model_usage）">
          <BarRows
            items={models.map((m) => ({
              label: (
                <span className="font-mono text-[11px]" title={m.model}>
                  {m.model}
                </span>
              ),
              value: m.i + m.o,
              valueText: fmtCompact(m.i + m.o),
              sub: `${fmtInt(m.sessions)} sess · ${fmtUsd(m.cost)}`,
              href: `/sessions?model=${encodeURIComponent(m.model)}`,
              title: `入力 ${fmtInt(m.i)} / 出力 ${fmtInt(m.o)} / API ${fmtInt(m.api)}`,
            }))}
          />
        </Panel>
        <Panel title="ソース別セッション">
          <BarRows
            items={sources.map((s) => ({
              label: <SourceBadge source={s.source} />,
              value: s.sessions,
              valueText: fmtInt(s.sessions),
              sub: `${fmtCompact(s.messages)} msg`,
              href: `/sessions?source=${encodeURIComponent(s.source)}`,
            }))}
          />
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel
          title="ツール使用 TOP15"
          action={
            <Link href="/tools" className="text-[11px] text-acc hover:underline">
              すべて見る →
            </Link>
          }
        >
          <BarRows
            barClass="bg-warn/60"
            items={tools.map((x) => ({
              label: <span className="font-mono text-[11px]">{x.tool_name}</span>,
              value: x.calls,
              valueText: fmtInt(x.calls),
              sub: `${fmtInt(x.sessions)} sess`,
              href: `/tools?tool=${encodeURIComponent(x.tool_name)}`,
            }))}
          />
        </Panel>
        <Panel
          title="最近のセッション"
          pad={false}
          action={
            <Link href="/sessions" className="text-[11px] text-acc hover:underline">
              一覧 →
            </Link>
          }
        >
          <div className="divide-y divide-line/60">
            {recent.rows.map((r) => (
              <Link
                key={r.id}
                href={`/sessions/${r.id}`}
                className="block px-4 py-2.5 hover:bg-panel2/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{r.title || "(無題)"}</div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-dim">
                      <SourceBadge source={r.source} />
                      <span className="font-mono">{r.model ?? "—"}</span>
                      <span>{fmtDT(r.started_at)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] tabular-nums text-mut">
                    <div>
                      {fmtInt(r.messages)} msg · {fmtInt(r.tools)} tools
                    </div>
                    <div className="text-dim">
                      {fmtCompact(r.tok_in + r.tok_out)} tok
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <footer className="mt-6 pb-4 text-center text-[10px] leading-5 text-dim">
        state.db を読み取り専用で参照。トークン数・コストは DB
        の記録値そのまま（estimated_cost_usd は一部プロバイダで計上異常を含む場合があります）。
      </footer>
    </div>
  );
}
