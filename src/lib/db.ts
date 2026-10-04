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
      // 読み取り専用コネクションのローカル設定（DBファイルには書き込まない）
      _db.exec("PRAGMA cache_size = -131072"); // 128MB ページキャッシュ
      _db.exec("PRAGMA mmap_size = 1073741824"); // 1GB mmap
      _db.exec("PRAGMA temp_store = MEMORY");
    } catch {
      /* 失敗しても続行 */
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

/**
 * stale-while-revalidate 方式の TTL キャッシュ。
 * - 新鮮なうちは即返す
 * - 期限切れでも「古い値を即返し」、再集計はバックグラウンドのキューで実行
 *   （全走査クエリが 0.4〜0.6s ブロックするため、ユーザーリクエストを待たせない）
 * - キー未登録（初回）だけは同期実行
 */
const memCache = new Map<string, { at: number; ttl: number; v: unknown }>();
const inflight = new Set<string>();
const refreshQueue: { key: string; ttl: number; fn: () => unknown }[] = [];
let refreshRunning = false;

function pumpQueue(): void {
  if (refreshRunning) return;
  const task = refreshQueue.shift();
  if (!task) return;
  refreshRunning = true;
  // リクエスト処理が合間に挟まるよう、1件ずつ間隔を空けて実行
  setTimeout(() => {
    try {
      memCache.set(task.key, { at: Date.now(), ttl: task.ttl, v: task.fn() });
    } catch {
      /* 失敗したら次回リクエスト時に再試行される */
    } finally {
      inflight.delete(task.key);
      refreshRunning = false;
      pumpQueue();
    }
  }, 25);
}

export function cached<T>(key: string, ttlMs: number, fn: () => T): T {
  const now = Date.now();
  const hit = memCache.get(key);
  if (hit && now - hit.at < hit.ttl) return hit.v as T;
  if (hit) {
    if (!inflight.has(key)) {
      inflight.add(key);
      refreshQueue.push({ key, ttl: ttlMs, fn: fn as () => unknown });
      pumpQueue();
    }
    return hit.v as T;
  }
  const v = fn();
  memCache.set(key, { at: now, ttl: ttlMs, v });
  if (memCache.size > 600) {
    for (const [k, e] of memCache) {
      if (now - e.at > e.ttl * 2) memCache.delete(k);
    }
  }
  return v;
}
