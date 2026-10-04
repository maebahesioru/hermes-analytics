// 重いクエリの実測ベンチ（読み取り専用）
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(os.homedir() + "/.hermes/state.db", { readOnly: true });
db.exec("PRAGMA busy_timeout = 10000");

const TZ = "+9 hours";
const Q = {
  totals_sessions: `SELECT COUNT(*) s, SUM(input_tokens) i, SUM(output_tokens) o FROM sessions`,
  totals_messages: `SELECT COUNT(*) c, SUM(CASE WHEN tool_name IS NOT NULL AND tool_name != '' THEN 1 ELSE 0 END) t, SUM(CASE WHEN role='user' THEN 1 ELSE 0 END) u FROM messages`,
  trend_msg: `SELECT SUM(CASE WHEN timestamp >= (strftime('%s','now')-2592000) THEN 1 ELSE 0 END) a, SUM(CASE WHEN timestamp >= (strftime('%s','now')-5184000) AND timestamp < (strftime('%s','now')-2592000) THEN 1 ELSE 0 END) b FROM messages`,
  daily_msg_all: `SELECT date(timestamp,'unixepoch','${TZ}') d, COUNT(*) c FROM messages GROUP BY d`,
  daily_sess_all: `SELECT date(started_at,'unixepoch','${TZ}') d, COUNT(*) c, SUM(input_tokens+output_tokens) t FROM sessions GROUP BY d`,
  heatmap: `SELECT CAST(strftime('%w', timestamp,'unixepoch','${TZ}') AS INTEGER) wd, CAST(strftime('%H', timestamp,'unixepoch','${TZ}') AS INTEGER) hr, COUNT(*) c FROM messages GROUP BY wd, hr`,
  models: `SELECT COALESCE(NULLIF(model,''),'(unknown)') m, SUM(api_call_count) a, SUM(input_tokens) i FROM session_model_usage GROUP BY m LIMIT 14`,
  sources: `SELECT s.source, COUNT(*) c FROM sessions s GROUP BY s.source`,
  tools_all: `SELECT tool_name, COUNT(*) c FROM messages WHERE tool_name IS NOT NULL AND tool_name != '' GROUP BY tool_name ORDER BY c DESC LIMIT 200`,
  tool_weekly: `SELECT date(timestamp,'unixepoch','${TZ}','weekday 0','-6 days') w, COUNT(*) c FROM messages WHERE tool_name = 'terminal' GROUP BY w`,
  recent_sess: `SELECT s.id, (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) n FROM sessions s ORDER BY s.started_at DESC LIMIT 10`,
  sessions_list: `SELECT s.id, (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) n, (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id AND m.tool_name IS NOT NULL) t FROM sessions s ORDER BY s.started_at DESC LIMIT 50`,
};

const bench = (name, sql, rounds) => {
  let best = Infinity;
  let last = 0;
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    db.prepare(sql).all();
    const dt = performance.now() - t0;
    last = dt;
    if (dt < best) best = dt;
  }
  console.log(name.padEnd(16), "best:", (best / 1000).toFixed(3) + "s", " last:", (last / 1000).toFixed(3) + "s");
};

for (const [name, sql] of Object.entries(Q)) bench(name, sql, 3);
process.exit(0);
