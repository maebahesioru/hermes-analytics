import Link from "next/link";
import { CalGrid, Panel, SourceBadge } from "@/components/charts";
import { fmtCompact, fmtDT, fmtDateStr, fmtDur, fmtInt, fmtWD } from "@/lib/format";
import { dailyMessages, dailySessions, daySessions } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "タイムライン" };

function shift(d: string, n: number): string {
  const dt = new Date(`${d}T00:00:00+09:00`);
  dt.setTime(dt.getTime() + n * 86400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const dmsg = dailyMessages(null);
  const dsess = dailySessions(null);
  const smap = new Map(dsess.map((r) => [r.d, r]));
  const days = dmsg.map((r) => ({ d: r.d, c: r.c, s: smap.get(r.d)?.s ?? 0 }));
  const last = days[days.length - 1]?.d ?? "";
  const first = days[0]?.d ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : last;
  const sess = date ? daySessions(date) : [];
  // パネル内で数字が全部足し算で合うように、一覧セッションの合計値を使う
  const dayMsgs = sess.reduce((a, b) => a + b.messages, 0);
  const dayTok = sess.reduce((a, b) => a + b.tok_in + b.tok_out, 0);
  const dayTools = sess.reduce((a, b) => a + b.tools, 0);
  const prev = shift(date, -1);
  const next = shift(date, +1);
  const prevOk = prev >= first;
  const nextOk = next <= last;
  const btn =
    "rounded-md border border-line bg-panel px-3 py-1.5 text-[11px] hover:border-acc hover:text-acc";
  const btnOff = "px-3 py-1.5 text-[11px] text-dim";

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">タイムライン</h1>
        <p className="mt-0.5 text-[12px] text-mut">
          日ごとの作業量（全 {fmtInt(days.length)} 稼働日 / {fmtDateStr(first)} 〜{" "}
          {fmtDateStr(last)}）。セルをクリックでその日のセッション一覧。
        </p>
      </header>

      <Panel title="カレンダー（色の濃さ = メッセージ数）" className="mb-3">
        <CalGrid days={days} />
      </Panel>

      <Panel
        title={
          <span>
            {fmtDateStr(date)} {fmtWD(date)} に開始したセッション
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            {prevOk ? (
              <Link href={`/timeline?date=${prev}`} className={btn}>
                ← 前日
              </Link>
            ) : (
              <span className={btnOff}>← 前日</span>
            )}
            {nextOk ? (
              <Link href={`/timeline?date=${next}`} className={btn}>
                翌日 →
              </Link>
            ) : (
              <span className={btnOff}>翌日 →</span>
            )}
          </div>
        }
        pad={false}
      >
        <div className="flex flex-wrap items-center gap-4 border-b border-line/60 px-4 py-2.5 text-[11px] text-mut">
          <span>
            セッション <b className="tabular-nums text-ink">{fmtInt(sess.length)}</b>
          </span>
          <span>
            メッセージ <b className="tabular-nums text-ink">{fmtInt(dayMsgs)}</b>
          </span>
          <span>
            ツール実行 <b className="tabular-nums text-ink">{fmtInt(dayTools)}</b>
          </span>
          <span>
            トークン <b className="tabular-nums text-ink">{fmtCompact(dayTok)}</b>
          </span>
        </div>
        {sess.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-dim">
            この日のセッションはありません
          </div>
        ) : (
          <div className="divide-y divide-line/60">
            {sess.map((r) => (
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
                      <span>{fmtDur(r.dur)}</span>
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
        )}
      </Panel>
    </div>
  );
}
