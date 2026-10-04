import Link from "next/link";
import { Panel, VBars } from "@/components/charts";
import { fmtDateStr, fmtDT, fmtInt, fmtWD } from "@/lib/format";
import { toolDetail, toolStats } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "ツール" };

const s1 = (v: string | string[] | undefined): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tool = s1(sp.tool);

  if (tool) {
    const { weekly, recent, meta } = toolDetail(tool);
    return (
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-2 text-[11px]">
          <Link href="/tools" className="text-mut hover:text-acc">
            ← ツール一覧
          </Link>
        </div>
        <header className="mb-4">
          <h1 className="font-mono text-lg font-semibold">{tool}</h1>
          <p className="mt-0.5 text-[12px] text-mut">
            呼び出し {fmtInt(meta.calls)} 回 / {fmtInt(meta.sessions)} セッション · 初回{" "}
            {fmtDT(meta.first)} 〜 最終 {fmtDT(meta.last)}
          </p>
        </header>

        <Panel title="週別の呼び出し回数" className="mb-3">
          {weekly.length > 0 ? (
            <VBars
              items={weekly.map((w) => ({
                d: w.wk,
                v: w.c,
                title: `週 ${fmtDateStr(w.wk)}〜: ${fmtInt(w.c)} 回`,
              }))}
              height={130}
              unit="週"
            />
          ) : (
            <div className="text-xs text-dim">データなし</div>
          )}
        </Panel>

        <Panel title="最近の呼び出し（現行メッセージ・最新40件）" pad={false}>
          {recent.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-dim">
              該当する呼び出しがありません
            </div>
          ) : (
            <div className="divide-y divide-line/60">
              {recent.map((r) => (
                <div key={r.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-dim">
                    <span className="tabular-nums">{fmtDT(r.timestamp)}</span>
                    <Link
                      href={`/sessions/${r.session_id}`}
                      className="max-w-[420px] truncate text-acc hover:underline"
                    >
                      {r.title || r.session_id}
                    </Link>
                  </div>
                  <div className="mt-1 line-clamp-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-ink/70">
                    {r.snip || "(空)"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    );
  }

  const tools = toolStats(300);
  const max = Math.max(...tools.map((t) => t.calls), 1);
  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">ツール使用統計</h1>
        <p className="mt-0.5 text-[12px] text-mut">
          全 {fmtInt(tools.length)} 種。名前をクリックで週別推移と最近の呼び出し。
        </p>
      </header>

      <Panel pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] text-mut">
                <th className="px-3 py-2.5 text-right font-medium">#</th>
                <th className="px-2 py-2.5 font-medium">ツール</th>
                <th className="px-2 py-2.5 font-medium">シェア</th>
                <th className="px-2 py-2.5 text-right font-medium">呼び出し</th>
                <th className="px-2 py-2.5 text-right font-medium">セッション</th>
                <th className="px-2 py-2.5 font-medium">初回</th>
                <th className="px-3 py-2.5 font-medium">最終</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((t, i) => (
                <tr
                  key={t.tool_name}
                  className="border-b border-line/50 last:border-0 hover:bg-panel2/40"
                >
                  <td className="px-3 py-1.5 text-right text-[11px] text-dim">
                    {i + 1}
                  </td>
                  <td className="px-2 py-1.5">
                    <Link
                      href={`/tools?tool=${encodeURIComponent(t.tool_name)}`}
                      className="font-mono text-[12px] hover:text-acc"
                    >
                      {t.tool_name}
                    </Link>
                  </td>
                  <td className="w-[220px] px-2 py-1.5">
                    <div className="h-[6px] overflow-hidden rounded-full bg-panel2">
                      <div
                        className="h-full rounded-full bg-warn/60"
                        style={{ width: `${(t.calls / max) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {fmtInt(t.calls)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-mut">
                    {fmtInt(t.sessions)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-[11px] text-dim">
                    {fmtDateStr(fmtDT(t.first).slice(0, 10))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-[11px] text-dim">
                    {fmtDateStr(fmtDT(t.last).slice(0, 10))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
