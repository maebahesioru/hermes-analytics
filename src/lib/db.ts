import os from "node:os";
import { DatabaseSync } from "node:sqlite";

/**
 * Hermes state.db を【読み取り専用】で直接開く。
 * ここから書き込みが飛ぶことは絶対にない（readOnly 接続 + 書込は例外になる）。
 */
const DB_PATH =
  process.env.HERMES_STATE_DB ?? `${os.homedir()}/.hermes/state.db`;

let _db: DatabaseSync | null = null;

function conn(): DatabaseSync {
  if (_db === null) {
    _db = new DatabaseSync(DB_PATH, { readOnly: true });
    try {
      _db.exec("PRAGMA busy_timeout = 10000");
    } catch {
      /* 読み取り専用でも busy_timeout は設定できる。失敗しても続行 */
    }
  }
  return _db;
}

type Param = string | number | bigint | null | Uint8Array;

export function all<T>(sql: string, params: Param[] = []): T[] {
  return conn().prepare(sql).all(...params) as T[];
}

export function get<T>(sql: string, params: Param[] = []): T | undefined {
  return conn().prepare(sql).get(...params) as T | undefined;
}

export const dbInfo = { path: DB_PATH };

/** 集計クエリ用の小さな TTL メモリキャッシュ（プロセス内・最大400件） */
const memCache = new Map<string, { at: number; ttl: number; v: unknown }>();

export function cached<T>(key: string, ttlMs: number, fn: () => T): T {
  const now = Date.now();
  const hit = memCache.get(key);
  if (hit && now - hit.at < hit.ttl) return hit.v as T;
  const v = fn();
  memCache.set(key, { at: now, ttl: ttlMs, v });
  if (memCache.size > 400) {
    for (const [k, e] of memCache) {
      if (now - e.at > e.ttl) memCache.delete(k);
    }
  }
  return v;
}
