// 改善案の実測: PRAGMA効果とJSバケット化の比較
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

const open = (pragmas) => {
  const db = new DatabaseSync(os.homedir() + "/.hermes/state.db", { readOnly: true });
  db.exec("PRAGMA busy_timeout = 10000");
  for (const p of pragmas) db.exec(p);
  return db;
};

const bench = (db, name, sql, rounds = 3) => {
  let best = Infinity;
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    db.prepare(sql).all();
    const dt = performance.now() - t0;
    if (dt < best) best = dt;
  }
  console.log(name.padEnd(34), (best / 1000).toFixed(3) + "s");
};

const TZ = "+9 hours";

console.log("=== A) 素の接続 ===");
{
  const db = open([]);
  bench(db, "tool_weekly(SQL strftime)", `SELECT date(timestamp,'unixepoch','${TZ}','weekday 0','-6 days') w, COUNT(*) c FROM messages WHERE tool_name = 'terminal' GROUP BY w`);
  bench(db, "tool_ts(JSCount用・生ts)", `SELECT timestamp FROM messages WHERE tool_name = 'terminal'`);
  bench(db, "tools_all(SQL group)", `SELECT tool_name, COUNT(*) c FROM messages WHERE tool_name IS NOT NULL AND tool_name != '' GROUP BY tool_name`);
  bench(db, "tools_names(JSCount用)", `SELECT tool_name FROM messages WHERE tool_name IS NOT NULL AND tool_name != ''`);
  bench(db, "heatmap(SQL strftime)", `SELECT CAST(strftime('%w', timestamp,'unixepoch','${TZ}') AS INTEGER) wd, CAST(strftime('%H', timestamp,'unixepoch','${TZ}') AS INTEGER) hr, COUNT(*) c FROM messages GROUP BY wd, hr`);
  bench(db, "all_ts(JSCount用)", `SELECT timestamp FROM messages`);
  bench(db, "totals_messages", `SELECT COUNT(*) c, SUM(CASE WHEN tool_name IS NOT NULL AND tool_name != '' THEN 1 ELSE 0 END) t FROM messages`);
  bench(db, "count_star", `SELECT COUNT(*) c FROM messages`);
  bench(db, "group_by_role", `SELECT role, COUNT(*) c FROM messages GROUP BY role`);
  db.close();
}

console.log("=== B) PRAGMA cache_size + mmap ===");
{
  const db = open(["PRAGMA cache_size=-131072", "PRAGMA mmap_size=1073741824"]);
  bench(db, "tool_weekly(SQL strftime)", `SELECT date(timestamp,'unixepoch','${TZ}','weekday 0','-6 days') w, COUNT(*) c FROM messages WHERE tool_name = 'terminal' GROUP BY w`);
  bench(db, "heatmap(SQL strftime)", `SELECT CAST(strftime('%w', timestamp,'unixepoch','${TZ}') AS INTEGER) wd, CAST(strftime('%H', timestamp,'unixepoch','${TZ}') AS INTEGER) hr, COUNT(*) c FROM messages GROUP BY wd, hr`);
  bench(db, "totals_messages", `SELECT COUNT(*) c, SUM(CASE WHEN tool_name IS NOT NULL AND tool_name != '' THEN 1 ELSE 0 END) t FROM messages`);
  db.close();
}

// JS側の処理コスト見積もり
console.log("=== C) JSバケット化の処理時間 ===");
{
  const db = open([]);
  const rows = db.prepare("SELECT timestamp FROM messages").all();
  let t0 = performance.now();
  const map = new Map();
  for (const r of rows) {
    const wd = new Date((r.timestamp + 9 * 3600) * 1000).getUTCDay();
    const hr = new Date((r.timestamp + 9 * 3600) * 1000).getUTCHours();
    const k = wd * 24 + hr;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  console.log("JS wd/hr bucket over", rows.length, "rows:", ((performance.now() - t0) / 1000).toFixed(3) + "s");

  const names = db.prepare("SELECT tool_name FROM messages WHERE tool_name IS NOT NULL AND tool_name != ''").all();
  t0 = performance.now();
  const cmap = new Map();
  for (const r of names) cmap.set(r.tool_name, (cmap.get(r.tool_name) ?? 0) + 1);
  console.log("JS tool count over", names.length, "rows:", ((performance.now() - t0) / 1000).toFixed(3) + "s");
  db.close();
}
process.exit(0);
