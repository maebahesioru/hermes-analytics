import { all, cached, get } from "./db";

/** SQLite の 'localtime' は使わず、JST固定 +9h で日付境界を切る */
const TZ = "+9 hours";

// ---------------------------------------------------------------- Totals

export interface Totals {
  sessions: number;
  messages: number;
  tools: number;
  users: number;
  in_tok: number;
  out_tok: number;
  cache_r: number;
  reasoning: number;
  cost: number;
  api_calls: number;
  active_days: number;
  first_ts: number;
  last_ts: number;
}

export function totals(): Totals {
  return cached("totals", 60_000, () => {
    const s = get<{
      sessions: number;
      in_tok: number;
      out_tok: number;
      cache_r: number;
      reasoning: number;
      cost: number;
      api_calls: number;
      active_days: number;
      first_ts: number;
      last_ts: number;
    }>(
      `SELECT COUNT(*) AS sessions,
              COALESCE(SUM(input_tokens),0) AS in_tok,
              COALESCE(SUM(output_tokens),0) AS out_tok,
              COALESCE(SUM(cache_read_tokens),0) AS cache_r,
              COALESCE(SUM(reasoning_tokens),0) AS reasoning,
              COALESCE(SUM(COALESCE(actual_cost_usd, estimated_cost_usd)),0) AS cost,
              COALESCE(SUM(api_call_count),0) AS api_calls,
              COUNT(DISTINCT date(started_at,'unixepoch','${TZ}')) AS active_days,
              COALESCE(MIN(started_at),0) AS first_ts,
              COALESCE(MAX(COALESCE(last_activity_at, started_at, ended_at)),0) AS last_ts
       FROM sessions`,
    )!;
    const m = get<{
      messages: number;
      tools: number;
      users: number;
    }>(
      `SELECT COUNT(*) AS messages,
              COALESCE(SUM(CASE WHEN tool_name IS NOT NULL AND tool_name != '' THEN 1 ELSE 0 END),0) AS tools,
              COALESCE(SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END),0) AS users
       FROM messages`,
    )!;
    return { ...s, ...m };
  });
}

export interface Trend {
  cur: number;
  prev: number;
}

export function messageTrend(): Trend {
  return cached("trend:msg", 60_000, () => {
    const now = Math.floor(Date.now() / 1000);
    return get<Trend>(
      `SELECT COALESCE(SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END),0) AS cur,
              COALESCE(SUM(CASE WHEN timestamp >= ? AND timestamp < ? THEN 1 ELSE 0 END),0) AS prev
       FROM messages`,
      [now - 30 * 86400, now - 60 * 86400, now - 30 * 86400],
    )!;
  });
}

export function sessionTrend(): Trend {
  return cached("trend:sess", 60_000, () => {
    const now = Math.floor(Date.now() / 1000);
    return get<Trend>(
      `SELECT COALESCE(SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END),0) AS cur,
              COALESCE(SUM(CASE WHEN started_at >= ? AND started_at < ? THEN 1 ELSE 0 END),0) AS prev
       FROM sessions`,
      [now - 30 * 86400, now - 60 * 86400, now - 30 * 86400],
    )!;
  });
}

// ---------------------------------------------------------------- Daily series

export interface DayMsg {
  d: string; // YYYY-MM-DD (JST)
  c: number;
}

export function dailyMessages(days: number | null): DayMsg[] {
  return cached(`dailyMsg:${days ?? "all"}`, 30_000, () => {
    const cond = days
      ? `WHERE timestamp >= ${Math.floor(Date.now() / 1000) - days * 86400}`
      : "";
    return all<DayMsg>(
      `SELECT date(timestamp,'unixepoch','${TZ}') AS d, COUNT(*) AS c
       FROM messages ${cond} GROUP BY d ORDER BY d`,
    );
  });
}

export interface DaySess {
  d: string;
  s: number; // sessions
  tok: number;
  cost: number;
  tool: number;
}

export function dailySessions(days: number | null): DaySess[] {
  return cached(`dailySess:${days ?? "all"}`, 30_000, () => {
    const cond = days
      ? `WHERE started_at >= ${Math.floor(Date.now() / 1000) - days * 86400}`
      : "";
    return all<DaySess>(
      `SELECT date(started_at,'unixepoch','${TZ}') AS d,
              COUNT(*) AS s,
              COALESCE(SUM(input_tokens + output_tokens),0) AS tok,
              COALESCE(SUM(estimated_cost_usd),0) AS cost,
              COALESCE(SUM(tool_call_count),0) AS tool
       FROM sessions ${cond} GROUP BY d ORDER BY d`,
    );
  });
}

/** 日付を連続に埋める（欠損日を0で補完）。d: YYYY-MM-DD */
export function fillDays(
  rows: Map<string, number>,
  days: number | null,
  firstDate: string,
  lastDate: string,
): { d: string; v: number }[] {
  const out: { d: string; v: number }[] = [];
  if (!firstDate || !lastDate) return out;
  let start = firstDate;
  if (days) {
    const t = new Date(Date.now() - (days - 1) * 86400_000);
    start = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(t);
    if (start < firstDate) start = firstDate;
  }
  // start → lastDate まで1日ずつ（JST、DSTなし）
  const cursor = new Date(`${start}T00:00:00+09:00`);
  for (let i = 0; i < 400; i++) {
    const d = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(cursor);
    out.push({ d, v: rows.get(d) ?? 0 });
    if (d >= lastDate) break;
    cursor.setTime(cursor.getTime() + 86400_000);
  }
  return out;
}

// ---------------------------------------------------------------- Heatmap

export interface HeatCell {
  wd: number; // 0=日 .. 6=土
  hr: number; // 0-23
  c: number;
}

export function heatmap(): HeatCell[] {
  return cached("heatmap", 180_000, () =>
    all<HeatCell>(
      `SELECT CAST(strftime('%w', timestamp,'unixepoch','${TZ}') AS INTEGER) AS wd,
              CAST(strftime('%H', timestamp,'unixepoch','${TZ}') AS INTEGER) AS hr,
              COUNT(*) AS c
       FROM messages GROUP BY wd, hr`,
    ),
  );
}

// ---------------------------------------------------------------- Models / Sources / Tools

export interface ModelStat {
  model: string;
  api: number;
  i: number;
  o: number;
  sessions: number;
  cost: number;
}

export function modelStats(limit = 100): ModelStat[] {
  return cached(`models:${limit}`, 60_000, () =>
    all<ModelStat>(
      `SELECT COALESCE(NULLIF(model,''),'(unknown)') AS model,
              COALESCE(SUM(api_call_count),0) AS api,
              COALESCE(SUM(input_tokens),0) AS i,
              COALESCE(SUM(output_tokens),0) AS o,
              COUNT(DISTINCT session_id) AS sessions,
              COALESCE(SUM(estimated_cost_usd),0) AS cost
       FROM session_model_usage GROUP BY model ORDER BY (i+o) DESC LIMIT ?`,
      [limit],
    ),
  );
}

export interface SourceStat {
  source: string;
  sessions: number;
  messages: number;
}

export function sourceStats(): SourceStat[] {
  return cached("sources", 60_000, () =>
    all<SourceStat>(
      `SELECT s.source AS source,
              COUNT(*) AS sessions,
              COALESCE(SUM((SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id)),0) AS messages
       FROM sessions s GROUP BY s.source ORDER BY sessions DESC`,
    ),
  );
}

export interface ToolStat {
  tool_name: string;
  calls: number;
  sessions: number;
  first: number;
  last: number;
}

export function toolStats(limit = 200): ToolStat[] {
  return cached(`tools:${limit}`, 60_000, () =>
    all<ToolStat>(
      `SELECT tool_name,
              COUNT(*) AS calls,
              COUNT(DISTINCT session_id) AS sessions,
              MIN(timestamp) AS first,
              MAX(timestamp) AS last
       FROM messages WHERE tool_name IS NOT NULL AND tool_name != ''
       GROUP BY tool_name ORDER BY calls DESC LIMIT ?`,
      [limit],
    ),
  );
}

/** 指定日（JST・YYYY-MM-DD）に開始したセッション */
export function daySessions(date: string): SessionRow[] {
  return all<SessionRow>(
    `SELECT s.id, s.title, s.source, s.model, s.started_at, s.ended_at,
            (CASE WHEN s.ended_at IS NOT NULL AND s.ended_at > s.started_at THEN s.ended_at - s.started_at END) AS dur,
            s.last_activity_at,
            (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS messages,
            (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id AND m.tool_name IS NOT NULL AND m.tool_name != '') AS tools,
            s.input_tokens AS tok_in, s.output_tokens AS tok_out,
            COALESCE(s.actual_cost_usd, s.estimated_cost_usd) AS cost
     FROM sessions s
     WHERE date(s.started_at,'unixepoch','${TZ}') = ?
     ORDER BY s.started_at ASC`,
    [date],
  );
}

/** セッション内のモデル内訳（billing行はモデル単位で合算） */
export function sessionModels(id: string): {
  model: string;
  api: number;
  i: number;
  o: number;
  cost: number;
}[] {
  return all(
    `SELECT COALESCE(NULLIF(model,''),'(unknown)') AS model,
            SUM(api_call_count) AS api, SUM(input_tokens) AS i,
            SUM(output_tokens) AS o, SUM(estimated_cost_usd) AS cost
     FROM session_model_usage WHERE session_id = ?
     GROUP BY model
     ORDER BY (SUM(input_tokens) + SUM(output_tokens)) DESC`,
    [id],
  );
}

// ---------------------------------------------------------------- Sessions list

export interface SessionRow {
  id: string;
  title: string | null;
  source: string;
  model: string | null;
  started_at: number;
  ended_at: number | null;
  dur: number | null;
  last_activity_at: number | null;
  messages: number;
  tools: number;
  tok_in: number;
  tok_out: number;
  cost: number;
}

const SORT_MAP: Record<string, string> = {
  recent: "s.started_at DESC",
  messages: "messages DESC",
  tools: "tools DESC",
  tokens: "(s.input_tokens + s.output_tokens) DESC",
  cost: "s.estimated_cost_usd DESC",
  duration: "dur DESC",
};

export function listSessions(o: {
  q?: string;
  source?: string;
  model?: string;
  sort: string;
  page: number;
  per: number;
}): { rows: SessionRow[]; total: number } {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (o.source) {
    where.push("s.source = ?");
    params.push(o.source);
  }
  if (o.model) {
    where.push("COALESCE(NULLIF(s.model,''),'(unknown)') = ?");
    params.push(o.model);
  }
  if (o.q) {
    where.push("instr(lower(COALESCE(s.title,'')), lower(?)) > 0");
    params.push(o.q);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderBy = SORT_MAP[o.sort] ?? SORT_MAP.recent;
  const rows = all<SessionRow>(
    `SELECT s.id, s.title, s.source, s.model, s.started_at, s.ended_at,
            (CASE WHEN s.ended_at IS NOT NULL AND s.ended_at > s.started_at THEN s.ended_at - s.started_at END) AS dur,
            s.last_activity_at,
            (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS messages,
            (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id AND m.tool_name IS NOT NULL AND m.tool_name != '') AS tools,
            s.input_tokens AS tok_in, s.output_tokens AS tok_out,
            COALESCE(s.actual_cost_usd, s.estimated_cost_usd) AS cost
     FROM sessions s ${w} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, o.per, (o.page - 1) * o.per],
  );
  const total = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sessions s ${w}`,
    params,
  )!.n;
  return { rows, total };
}

export function facets(): {
  sources: { v: string; n: number }[];
  models: { v: string; n: number }[];
} {
  return cached("facets", 120_000, () => ({
    sources: all<{ v: string; n: number }>(
      `SELECT source AS v, COUNT(*) AS n FROM sessions GROUP BY source ORDER BY n DESC`,
    ),
    models: all<{ v: string; n: number }>(
      `SELECT COALESCE(NULLIF(model,''),'(unknown)') AS v, COUNT(*) AS n
       FROM sessions GROUP BY v ORDER BY n DESC LIMIT 50`,
    ),
  }));
}

// ---------------------------------------------------------------- Session detail

export interface SessionMeta {
  id: string;
  source: string;
  user_id: string | null;
  model: string | null;
  parent_session_id: string | null;
  started_at: number;
  ended_at: number | null;
  end_reason: string | null;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  api_call_count: number;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  title: string | null;
  cwd: string | null;
  git_branch: string | null;
  git_repo_root: string | null;
  profile_name: string | null;
  chat_type: string | null;
  display_name: string | null;
  last_activity_at: number | null;
  tool_names: string | null;
  handoff_platform: string | null;
}

export function sessionMeta(id: string): SessionMeta | undefined {
  return get<SessionMeta>(`SELECT * FROM sessions WHERE id = ?`, [id]);
}

export interface SessionCounts {
  n: number;
  tools: number;
  users: number;
  assistants: number;
  metas: number;
}

export function sessionCounts(id: string, includeAll: boolean): SessionCounts {
  const act = includeAll ? "" : "AND active = 1";
  return get<SessionCounts>(
    `SELECT COUNT(*) AS n,
            COALESCE(SUM(CASE WHEN tool_name IS NOT NULL AND tool_name != '' THEN 1 ELSE 0 END),0) AS tools,
            COALESCE(SUM(CASE WHEN role='user' THEN 1 ELSE 0 END),0) AS users,
            COALESCE(SUM(CASE WHEN role='assistant' THEN 1 ELSE 0 END),0) AS assistants,
            COALESCE(SUM(CASE WHEN role='session_meta' THEN 1 ELSE 0 END),0) AS metas
     FROM messages WHERE session_id = ? ${act}`,
    [id],
  )!;
}

export interface MessageRow {
  id: number;
  role: string;
  tool_name: string | null;
  timestamp: number;
  token_count: number | null;
  active: number;
  clen: number;
  preview: string | null;
  tool_calls: string | null;
}

export function sessionMessages(
  id: string,
  opts: { page: number; per: number; all: boolean; role?: string },
): MessageRow[] {
  const act = opts.all ? "" : "AND active = 1";
  const roleCond = opts.role ? "AND role = ?" : "";
  return all<MessageRow>(
    `SELECT id, role, tool_name, timestamp, token_count, active,
            LENGTH(COALESCE(content,'')) AS clen,
            substr(COALESCE(content,''), 1, 1600) AS preview,
            substr(COALESCE(tool_calls,''), 1, 4000) AS tool_calls
     FROM messages
     WHERE session_id = ? ${act} ${roleCond}
     ORDER BY timestamp ASC, id ASC LIMIT ? OFFSET ?`,
    [
      ...(opts.role
        ? [id, opts.role, opts.per, (opts.page - 1) * opts.per]
        : [id, opts.per, (opts.page - 1) * opts.per]),
    ],
  );
}

export function sessionMessageCount(
  id: string,
  all: boolean,
  role?: string,
): number {
  const act = all ? "" : "AND active = 1";
  const roleCond = role ? "AND role = ?" : "";
  return get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM messages WHERE session_id = ? ${act} ${roleCond}`,
    role ? [id, role] : [id],
  )!.n;
}

export function fullMessage(msgId: number): string | null {
  const row = get<{ content: string | null }>(
    `SELECT content FROM messages WHERE id = ?`,
    [msgId],
  );
  return row?.content ?? null;
}

export function messageRoleCount(id: string, includeAll: boolean): { role: string; n: number }[] {
  const act = includeAll ? "" : "AND active = 1";
  return all<{ role: string; n: number }>(
    `SELECT role, COUNT(*) AS n FROM messages WHERE session_id = ? ${act} GROUP BY role ORDER BY n DESC`,
    [id],
  );
}

// ---------------------------------------------------------------- Tool detail

export function toolDetail(name: string): {
  weekly: { wk: string; c: number }[];
  recent: {
    id: number;
    session_id: string;
    timestamp: number;
    snip: string;
    title: string | null;
  }[];
  meta: { calls: number; sessions: number; first: number; last: number };
} {
  const weekly = all<{ wk: string; c: number }>(
    `SELECT date(timestamp,'unixepoch','${TZ}','weekday 0','-6 days') AS wk, COUNT(*) AS c
     FROM messages WHERE tool_name = ? GROUP BY wk ORDER BY wk`,
    [name],
  );
  const recent = all<{
    id: number;
    session_id: string;
    timestamp: number;
    snip: string;
    title: string | null;
  }>(
    `SELECT m.id, m.session_id, m.timestamp, substr(COALESCE(m.content,''),1,180) AS snip, s.title
     FROM messages m JOIN sessions s ON s.id = m.session_id
     WHERE m.tool_name = ? AND m.active = 1
     ORDER BY m.timestamp DESC LIMIT 40`,
    [name],
  );
  const meta = get<{ calls: number; sessions: number; first: number; last: number }>(
    `SELECT COUNT(*) AS calls, COUNT(DISTINCT session_id) AS sessions,
            MIN(timestamp) AS first, MAX(timestamp) AS last
     FROM messages WHERE tool_name = ?`,
    [name],
  )!;
  return { weekly, recent, meta };
}

// ---------------------------------------------------------------- Search

export interface SearchRow {
  id: number;
  session_id: string;
  role: string;
  tool_name: string | null;
  timestamp: number;
  title: string | null;
  snip: string;
  pos: number;
  clen: number;
}

/**
 * メッセージ本文の横断検索。
 * FTS(trigram) はツール出力・cron/subagent を除外するビュー由来で穴があるため使わず、
 * 全メッセージを LIKE で走査する（id降順スキャンで早期打ち切り・結果は5分キャッシュ）。
 */
export function searchMessages(
  qRaw: string,
  role: string | null,
  limit: number,
): { rows: SearchRow[]; truncated: boolean } {
  const q = qRaw.trim();
  if (!q) return { rows: [], truncated: false };

  return cached(`search:v2:${role ?? "*"}:${limit}:${q}`, 300_000, () => {
    const esc = q
      .replaceAll("\\", "\\\\")
      .replaceAll("%", "\\%")
      .replaceAll("_", "\\_");
    const params: (string | number)[] = [esc];
    if (role) params.push(role);
    params.push(limit);
    const rows = all<SearchRow>(
      `SELECT id, session_id, role, tool_name, timestamp, title,
              substr(content, MAX(1, instr(lower(content), lower(?)) - 100), 400) AS snip,
              instr(lower(content), lower(?)) AS pos,
              LENGTH(content) AS clen
       FROM (
         SELECT m.id, m.session_id, m.role, m.tool_name, m.timestamp, s.title, m.content
         FROM messages m JOIN sessions s ON s.id = m.session_id
         WHERE m.content LIKE '%' || ? || '%' ESCAPE '\\'
           ${role ? "AND m.role = ?" : ""}
         ORDER BY m.id DESC LIMIT ?
       )`,
      [q, q, ...params],
    );
    return { rows, truncated: rows.length >= limit };
  });
}
