import Link from "next/link";
import { Panel, SourceBadge } from "@/components/charts";
import { fmtCompact, fmtDT, fmtDur, fmtInt, fmtUsd } from "@/lib/format";
import { facets, listSessions } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "セッション" };

const SORTS: [string, string][] = [
  ["recent", "新しい順"],
  ["messages", "メッセージ数"],
  ["tools", "ツール数"],
  ["tokens", "トークン"],
  ["cost", "コスト"],
  ["duration", "継続時間"],
];

type SP = Promise<Record<string, string | string[] | undefined>>;
const s1 = (v: string | string[] | undefined): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

export default async function SessionsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = s1(sp.q);
  const source = s1(sp.source);
  const model = s1(sp.model);
  const sort = SORTS.some(([k]) => k === sp.sort) ? (sp.sort as string) : "recent";
  const page = Math.max(1, parseInt(s1(sp.page) ?? "1", 10) || 1);
  const per = 50;
  const { rows, total } = listSessions({ q, source, model, sort, page, per });
  const { sources, models } = facets();
  const pages = Math.max(1, Math.ceil(total / per));
  const from = total === 0 ? 0 : (page - 1) * per + 1;
  const to = Math.min(total, page * per);

  const mkHref = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (source) u.set("source", source);
    if (model) u.set("model", model);
    if (sort !== "recent") u.set("sort", sort);
    if (p > 1) u.set("page", String(p));
    const qs = u.toString();
    return `/sessions${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-[1440px]">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">セッション</h1>
        <p className="mt-0.5 text-[12px] text-mut">
          全 {fmtInt(total)} 件中 {fmtInt(from)}–{fmtInt(to)} 件目を表示。タイトルをクリックで
          メッセージ全文へ。
        </p>
      </header>

      <form
        method="GET"
        action="/sessions"
        className="mb-3 flex flex-wrap items-center gap-2"
      >
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="タイトル検索"
          className="h-8 w-60 rounded-md border border-line bg-panel px-3 text-xs outline-none placeholder:text-dim focus:border-acc"
        />
        <select
          name="source"
          defaultValue={source ?? ""}
          className="h-8 rounded-md border border-line bg-panel px-2 text-xs outline-none focus:border-acc"
        >
          <option value="">ソース: すべて</option>
          {sources.map((s) => (
            <option key={s.v} value={s.v}>
              {s.v} ({fmtInt(s.n)})
            </option>
          ))}
        </select>
        <select
          name="model"
          defaultValue={model ?? ""}
          className="h-8 max-w-[280px] rounded-md border border-line bg-panel px-2 text-xs outline-none focus:border-acc"
        >
          <option value="">モデル: すべて</option>
          {models.map((m) => (
            <option key={m.v} value={m.v}>
              {m.v} ({fmtInt(m.n)})
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="h-8 rounded-md border border-line bg-panel px-2 text-xs outline-none focus:border-acc"
        >
          {SORTS.map(([k, label]) => (
            <option key={k} value={k}>
              並び: {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-8 rounded-md bg-acc px-4 text-xs font-medium text-white hover:bg-acc/85"
        >
          絞り込み
        </button>
        {(q || source || model) && (
          <Link href="/sessions" className="text-[11px] text-dim hover:text-ink">
            リセット
          </Link>
        )}
      </form>

      <Panel pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] text-mut">
                <th className="px-4 py-2.5 font-medium">セッション</th>
                <th className="px-2 py-2.5 font-medium">ソース</th>
                <th className="px-2 py-2.5 font-medium">モデル</th>
                <th className="px-2 py-2.5 font-medium">開始</th>
                <th className="px-2 py-2.5 text-right font-medium">時間</th>
                <th className="px-2 py-2.5 text-right font-medium">MSG</th>
                <th className="px-2 py-2.5 text-right font-medium">ツール</th>
                <th className="px-2 py-2.5 text-right font-medium">トークン 入/出</th>
                <th className="px-4 py-2.5 text-right font-medium">コスト</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-line/50 last:border-0 hover:bg-panel2/40"
                >
                  <td className="max-w-[430px] px-4 py-2">
                    <Link
                      href={`/sessions/${r.id}`}
                      className="block truncate hover:text-acc"
                    >
                      {r.title || "(無題)"}
                    </Link>
                    <div className="font-mono text-[10px] text-dim">{r.id}</div>
                  </td>
                  <td className="px-2 py-2">
                    <SourceBadge source={r.source} />
                  </td>
                  <td className="max-w-[160px] truncate px-2 py-2 font-mono text-[11px] text-mut">
                    {r.model ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-mut">
                    {fmtDT(r.started_at)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right text-xs tabular-nums">
                    {fmtDur(r.dur)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {fmtInt(r.messages)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {fmtInt(r.tools)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right text-xs tabular-nums text-mut">
                    {fmtCompact(r.tok_in)} / {fmtCompact(r.tok_out)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right text-xs tabular-nums">
                    {fmtUsd(r.cost)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-xs text-dim">
                    該当するセッションがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3 text-xs">
          {page > 1 ? (
            <Link
              href={mkHref(page - 1)}
              className="rounded-md border border-line bg-panel px-3 py-1.5 hover:border-acc hover:text-acc"
            >
              ← 前へ
            </Link>
          ) : (
            <span className="px-3 py-1.5 text-dim">← 前へ</span>
          )}
          <span className="text-mut">
            {fmtInt(page)} / {fmtInt(pages)} ページ
          </span>
          {page < pages ? (
            <Link
              href={mkHref(page + 1)}
              className="rounded-md border border-line bg-panel px-3 py-1.5 hover:border-acc hover:text-acc"
            >
              次へ →
            </Link>
          ) : (
            <span className="px-3 py-1.5 text-dim">次へ →</span>
          )}
        </div>
      )}
    </div>
  );
}
