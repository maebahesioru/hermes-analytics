import Link from "next/link";
import { Panel, RoleBadge, ToolChip } from "@/components/charts";
import { fmtDT, fmtInt } from "@/lib/format";
import { searchMessages, totals } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "検索" };

const s1 = (v: string | string[] | undefined): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

const ROLE_TABS: [string | null, string][] = [
  [null, "すべて"],
  ["user", "ユーザー"],
  ["assistant", "アシスタント"],
  ["tool", "ツール"],
  ["session_meta", "メタ"],
];

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const decodeEsc = (s: string) => s.replaceAll("\\n", "\n").replaceAll("\\t", "  ");

/** 全出現をハイライト（大文字小文字無視） */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escRe(q)})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-[2px] bg-acc/30 px-[1px] text-ink">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (s1(sp.q) ?? "").trim();
  const roleRaw = s1(sp.role);
  const role =
    roleRaw && ROLE_TABS.some(([r]) => r === roleRaw) ? roleRaw : null;
  const res = q ? searchMessages(q, role, 60) : null;
  const t = totals();

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-[11px] ${
      active
        ? "border-acc/60 bg-acc/15 text-acc"
        : "border-line bg-panel text-mut hover:text-ink"
    }`;

  return (
    <div className="mx-auto max-w-[1000px]">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">メッセージ検索</h1>
        <p className="mt-0.5 text-[12px] text-mut">
          全 {fmtInt(t.messages)} 件のメッセージ本文を部分一致で走査（初回およそ1〜2秒・同一クエリはキャッシュで即時）。ツール出力やサブエージェントのログも対象。
        </p>
      </header>

      <form method="GET" action="/search" className="mb-3 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="例: Coolify / エラー / セッション など"
          className="h-10 flex-1 rounded-lg border border-line bg-panel px-4 text-sm outline-none placeholder:text-dim focus:border-acc"
        />
        {role && <input type="hidden" name="role" value={role} />}
        <button
          type="submit"
          className="h-10 rounded-lg bg-acc px-5 text-sm font-medium text-white hover:bg-acc/85"
        >
          検索
        </button>
      </form>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {ROLE_TABS.map(([r, label]) => (
          <Link
            key={label}
            href={`/search?q=${encodeURIComponent(q)}${
              r ? `&role=${r}` : ""
            }`}
            className={chip((r ?? null) === role)}
          >
            {label}
          </Link>
        ))}
      </div>

      {res && (
        <Panel
          title={
            <span>
              「{q}」の結果 — {fmtInt(res.rows.length)} 件
              {res.truncated && (
                <span className="ml-2 text-[10px] font-normal text-dim">
                  以降省略
                </span>
              )}
            </span>
          }
          pad={false}
        >
          {res.rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-xs text-dim">
              一致するメッセージがありません
            </div>
          ) : (
            <div className="divide-y divide-line/60">
              {res.rows.map((r) => {
                // スニペットは一致位置の前後を切り出した窓。前後が切れている場合は「…」を付ける
                const snip = decodeEsc(r.snip ?? "");
                const start = Math.max(1, (r.pos ?? 0) - 100);
                const prefix = (r.pos ?? 0) > 101 ? "… " : "";
                const suffix = start + 400 - 1 < (r.clen ?? 0) ? " …" : "";
                return (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-dim">
                      <span className="tabular-nums">{fmtDT(r.timestamp)}</span>
                      <RoleBadge role={r.role} />
                      {r.tool_name && <ToolChip name={r.tool_name} />}
                      <Link
                        href={`/sessions/${r.session_id}`}
                        className="max-w-[460px] truncate text-acc hover:underline"
                      >
                        {r.title || r.session_id}
                      </Link>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-6 text-ink/85">
                      {prefix && <span className="text-dim">{prefix}</span>}
                      <Highlight text={snip} q={q} />
                      {suffix && <span className="text-dim">{suffix}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
