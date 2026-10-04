import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel, RoleBadge, SourceBadge, ToolChip } from "@/components/charts";
import { fmtCompact, fmtDT, fmtDur, fmtInt, fmtUsd } from "@/lib/format";
import {
  fullMessage,
  messageRoleCount,
  sessionCounts,
  sessionMessageCount,
  sessionMessages,
  sessionMeta,
  sessionModels,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type P = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
const s1 = (v: string | string[] | undefined): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

const ROLE_TABS: [string | null, string][] = [
  [null, "すべて"],
  ["user", "ユーザー"],
  ["assistant", "アシスタント"],
  ["tool", "ツール"],
  ["session_meta", "メタ"],
];

function callNames(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr
        .map((x: { function?: { name?: string }; name?: string }) => x?.function?.name ?? x?.name)
        .filter((n): n is string => typeof n === "string");
    }
  } catch {
    /* 切り詰められた JSON は正規表現で拾う */
  }
  return [...raw.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map((x) => x[1]);
}

export async function generateMetadata({ params }: { params: P }) {
  const { id } = await params;
  const m = sessionMeta(id);
  return { title: m?.title || id };
}

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: P;
  searchParams: SP;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const meta = sessionMeta(id);
  if (!meta) notFound();

  const all = sp.all === "1";
  const roleRaw = s1(sp.role);
  const role = roleRaw && ROLE_TABS.some(([r]) => r === roleRaw) ? roleRaw : undefined;
  const page = Math.max(1, parseInt(s1(sp.page) ?? "1", 10) || 1);
  const per = 120;

  const counts = sessionCounts(id, all);
  const countsAll = all ? counts : sessionCounts(id, true);
  const roleCounts = messageRoleCount(id, all);
  const total = sessionMessageCount(id, all, role);
  const pages = Math.max(1, Math.ceil(total / per));
  const msgs = sessionMessages(id, { page, per, all, role });
  const fullId = parseInt(s1(sp.full) ?? "", 10) || null;
  const fullContent =
    fullId && msgs.some((m) => m.id === fullId) ? fullMessage(fullId) : null;
  const models = sessionModels(id);
  const dur =
    meta.ended_at && meta.ended_at > meta.started_at
      ? meta.ended_at - meta.started_at
      : null;

  const mk = (o: {
    page?: number;
    role?: string | null;
    all?: boolean;
    full?: number | null;
  }) => {
    const u = new URLSearchParams();
    const a = o.all ?? all;
    const r = o.role === undefined ? role : o.role;
    const p = o.page ?? page;
    const f = o.full === undefined ? fullId : o.full;
    if (a) u.set("all", "1");
    if (r) u.set("role", r);
    if (p > 1) u.set("page", String(p));
    if (f) u.set("full", String(f));
    const qs = u.toString();
    return `/sessions/${id}${qs ? `?${qs}` : ""}`;
  };

  const btn =
    "rounded-md border border-line bg-panel px-3 py-1.5 hover:border-acc hover:text-acc";
  const btnDis = "px-3 py-1.5 text-dim";

  const cells: [string, React.ReactNode][] = [
    ["開始", fmtDT(meta.started_at)],
    ["終了", fmtDT(meta.ended_at)],
    ["継続時間", fmtDur(dur)],
    [
      "ソース",
      <span key="src" className="flex items-center gap-2">
        <SourceBadge source={meta.source} />
        {meta.chat_type ? <span className="text-dim">{meta.chat_type}</span> : null}
      </span>,
    ],
    ["モデル", meta.model ?? "—"],
    ["APIコール", fmtInt(meta.api_call_count)],
    [
      "メッセージ",
      all
        ? `全 ${fmtInt(counts.n)} 件`
        : `${fmtInt(counts.n)} 件（全 ${fmtInt(countsAll.n)}）`,
    ],
    ["ツール実行", fmtInt(counts.tools)],
    [
      "トークン 入/出",
      `${fmtInt(meta.input_tokens)} / ${fmtInt(meta.output_tokens)}`,
    ],
    ["キャッシュ 読/書", `${fmtInt(meta.cache_read_tokens)} / ${fmtInt(meta.cache_write_tokens)}`],
    ["reasoning", fmtInt(meta.reasoning_tokens)],
    [
      "コスト",
      `${fmtUsd(meta.actual_cost_usd ?? meta.estimated_cost_usd)}${
        meta.actual_cost_usd == null ? " (est)" : ""
      }`,
    ],
    ["最終活動", fmtDT(meta.last_activity_at)],
    ["プロファイル", meta.profile_name ?? "—"],
    ["git branch", meta.git_branch ?? "—"],
  ];

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-2 text-[11px]">
        <Link href="/sessions" className="text-mut hover:text-acc">
          ← セッション一覧
        </Link>
      </div>
      <header className="mb-4">
        <h1 className="text-lg font-semibold">{meta.title || "(無題)"}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-dim">
          <span className="font-mono">{meta.id}</span>
          {meta.parent_session_id && (
            <Link
              href={`/sessions/${meta.parent_session_id}`}
              className="text-acc hover:underline"
            >
              親セッション: {meta.parent_session_id}
            </Link>
          )}
        </div>
      </header>

      <Panel title="メタ情報" className="mb-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4 xl:grid-cols-5">
          {cells.map(([label, v]) => (
            <div key={label} className="min-w-0">
              <div className="text-[10px] text-dim">{label}</div>
              <div className="mt-0.5 truncate text-[12px] tabular-nums text-ink/90">
                {v}
              </div>
            </div>
          ))}
        </div>
        {meta.cwd && (
          <div className="mt-3 border-t border-line/60 pt-2">
            <div className="text-[10px] text-dim">cwd</div>
            <div className="break-all font-mono text-[11px] text-ink/80">
              {meta.cwd}
            </div>
          </div>
        )}
        {models.length > 1 && (
          <div className="mt-3 border-t border-line/60 pt-2">
            <div className="mb-1 text-[10px] text-dim">モデル内訳</div>
            <div className="flex flex-wrap gap-2">
              {models.map((m) => (
                <span
                  key={m.model}
                  className="rounded border border-line bg-panel2 px-2 py-1 text-[10px] text-mut"
                >
                  <span className="font-mono text-warn/90">{m.model}</span>{" "}
                  {fmtCompact(m.i + m.o)} tok · API {fmtInt(m.api)} ·{" "}
                  {fmtUsd(m.cost)}
                </span>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {ROLE_TABS.map(([r, label]) => {
            const n =
              r === null ? counts.n : roleCounts.find((x) => x.role === r)?.n ?? 0;
            if (r !== null && n === 0) return null;
            const active = (r ?? undefined) === role;
            return (
              <Link
                key={label}
                href={mk({ role: r, page: 1, full: null })}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  active
                    ? "border-acc/60 bg-acc/15 text-acc"
                    : "border-line bg-panel text-mut hover:text-ink"
                }`}
              >
                {label} <span className="tabular-nums text-dim">{fmtInt(n)}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <Link
            href={mk({ all: !all, page: 1, full: null })}
            className="text-acc hover:underline"
          >
            {all
              ? "▸ 現行のみ表示に戻す"
              : `▸ 圧縮済み履歴も含む（全 ${fmtInt(countsAll.n)} 件）`}
          </Link>
          <span className="text-dim">
            {fmtInt(total)} 件中{" "}
            {fmtInt(Math.min((page - 1) * per + 1, total))}–
            {fmtInt(Math.min(total, page * per))} 件目（古い順）
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {msgs.map((m) => {
          const isFull = fullContent != null && m.id === fullId;
          const text = isFull ? fullContent! : m.preview ?? "";
          const truncated = !isFull && m.clen > 1600;
          const names = callNames(m.tool_calls);
          return (
            <div
              key={m.id}
              id={`m${m.id}`}
              className="rounded-lg border border-line bg-panel"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-line/60 px-3 py-1.5">
                <RoleBadge role={m.role} />
                {m.tool_name && <ToolChip name={m.tool_name} />}
                <span className="text-[11px] tabular-nums text-dim">
                  {fmtDT(m.timestamp)}
                </span>
                {m.token_count != null && (
                  <span className="text-[11px] tabular-nums text-dim">
                    {fmtInt(m.token_count)} tok
                  </span>
                )}
                {!m.active && (
                  <span className="rounded border border-bad/40 px-1.5 py-[1px] text-[10px] text-bad">
                    圧縮済み
                  </span>
                )}
                {names.length > 0 && (
                  <span className="font-mono text-[10px] text-warn/80">
                    → {names.slice(0, 6).join(", ")}
                    {names.length > 6 ? ` +${names.length - 6}` : ""}
                  </span>
                )}
                <span className="ml-auto">
                  {truncated && (
                    <Link
                      href={`${mk({ full: m.id })}#m${m.id}`}
                      className="text-[11px] text-acc hover:underline"
                    >
                      全文表示（{fmtInt(m.clen)}字）
                    </Link>
                  )}
                  {isFull && (
                    <Link
                      href={mk({ full: null })}
                      className="text-[11px] text-acc hover:underline"
                    >
                      折りたたむ
                    </Link>
                  )}
                </span>
              </div>
              <pre className="whitespace-pre-wrap break-words px-3 py-2 font-sans text-[12.5px] leading-relaxed text-ink/85">
                {text ? text : names.length > 0 ? "(ツール呼び出しのみ)" : "(空)"}
                {truncated ? `\n…（残り ${fmtInt(m.clen - 1600)} 文字）` : ""}
              </pre>
            </div>
          );
        })}
        {msgs.length === 0 && (
          <div className="rounded-lg border border-line bg-panel px-4 py-10 text-center text-xs text-dim">
            この条件のメッセージはありません
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs">
          {page > 1 && (
            <Link className={btn} href={mk({ page: 1, full: null })}>
              « 先頭
            </Link>
          )}
          {page > 1 ? (
            <Link className={btn} href={mk({ page: page - 1, full: null })}>
              ← 前へ
            </Link>
          ) : (
            <span className={btnDis}>← 前へ</span>
          )}
          <span className="text-mut">
            {fmtInt(page)} / {fmtInt(pages)} ページ
          </span>
          {page < pages ? (
            <Link className={btn} href={mk({ page: page + 1, full: null })}>
              次へ →
            </Link>
          ) : (
            <span className={btnDis}>次へ →</span>
          )}
          {page < pages && (
            <Link className={btn} href={mk({ page: pages, full: null })}>
              末尾 »
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
