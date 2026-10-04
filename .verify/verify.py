#!/usr/bin/env python3
"""hermes-analytics の回帰テスト。
使い方: python3 .verify/verify.py [base_url]
- HTMLのタグ/コメントを正規化してテキスト検証（minified HTMLのgrep罠を回避）
- 数値・件数は「DBの実値」と突き合わせる（ハードコードではなく動的に取得）
"""
import html
import re
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4100"
DB = Path.home() / ".hermes/state.db"

results: list[tuple[str, bool, str]] = []


def check(name: str, cond, detail: str = ""):
    results.append((name, bool(cond), str(detail)[:160]))


def fetch(path: str) -> str:
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "verify.py"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read().decode("utf-8")


def norm(h: str) -> str:
    h = re.sub(r"<script.*?</script>", " ", h, flags=re.S)
    h = re.sub(r"<style.*?</style>", " ", h, flags=re.S)
    # React SSR のコメントノードは「削除」(空白を入れるとテキストが分断される)
    h = re.sub(r"<!--.*?-->", "", h, flags=re.S)
    h = re.sub(r"<[^>]+>", " ", h)
    h = html.unescape(h)
    h = re.sub(r"\s+", " ", h)
    return h


def sql(q: str):
    db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    try:
        return db.execute(q).fetchone()
    finally:
        db.close()


# ---------------- DB 実値
(sess_total,) = sql("SELECT COUNT(*) FROM sessions")
(msg_total,) = sql("SELECT COUNT(*) FROM messages")
(tool_total,) = sql(
    "SELECT COUNT(*) FROM messages WHERE tool_name IS NOT NULL AND tool_name != ''"
)
(last_sess,) = sql("SELECT id FROM sessions ORDER BY started_at DESC LIMIT 1")
(search_hits,) = sql("SELECT COUNT(*) FROM messages WHERE content LIKE '%Coolify%'")

fm = lambda n: f"{n:,}"

# ---------------- top
t = norm(fetch("/"))


def parse_int(s: str) -> int:
    return int(s.replace(",", ""))


def close(a: int, b: int, tol: float = 0.02) -> bool:
    return abs(a - b) <= max(10, int(b * tol))


m = re.search(r"全 ([\d,]+) セッション / ([\d,]+) メッセージ / ([\d,]+) APIコール", t)
if m:
    p_sess, p_msg, _p_api = (parse_int(x) for x in m.groups())
    check("top: 総セッション数", close(p_sess, sess_total), f"page={p_sess} db={sess_total}")
    check("top: 総メッセージ数", close(p_msg, msg_total), f"page={p_msg} db={msg_total}")
else:
    check("top: ヘッダ統計行", False, "パターン不一致")
ty = re.search(r"ツール実行 ([\d,]+)", t)
check(
    "top: ツール実行数",
    ty is not None and close(parse_int(ty.group(1)), tool_total),
    f"page={ty.group(1) if ty else None} db={tool_total}",
)
check("top: セクション見出し", "アクティビティ（1日あたりメッセージ数）" in t and "時間帯 × 曜日" in t)
check("top: 最近のセッション", "最近のセッション" in t and "/sessions/2026" in fetch("/"))

raw = fetch("/")
check("top: ヒートマップのセル", raw.count("時台:") >= 160, f"cells={raw.count('時台:')}")
bar_pat = 'title="2026/'
check("top: 日別バーのツールチップ", raw.count(bar_pat) >= 80, f"bars={raw.count(bar_pat)}")

# ---------------- sessions
s = norm(fetch("/sessions"))
check("sessions: 総件数表示", f"全 {fm(sess_total)} 件中 1–50 件目" in s)
check("sessions: 行リンク", "/sessions/2026" in fetch("/sessions"))
(discord_n,) = sql("SELECT COUNT(*) FROM sessions WHERE source='discord'")
s2 = norm(fetch("/sessions?source=discord"))
check("sessions: ソース絞り込み", f"全 {fm(discord_n)} 件中" in s2, f"expect 全 {fm(discord_n)} 件中")
s3 = norm(fetch("/sessions?q=" + urllib.parse.quote("Hermes DB")))
check("sessions: タイトル検索", "件中" in s3 and "該当するセッションがありません" not in s3)

# ---------------- detail
d = norm(fetch(f"/sessions/{last_sess}"))
check("detail: メタ情報", "メタ情報" in d and "継続時間" in d)
check("detail: メッセージ一覧", ("件目（古い順）" in d) or ("この条件のメッセージはありません" in d))
d_all = fetch(f"/sessions/{last_sess}?all=1")
check("detail: 全履歴モード200", len(d_all) > 500)
d_role = fetch(f"/sessions/{last_sess}?role=user")
check("detail: ロールフィルタ200", len(d_role) > 500)

# ---------------- timeline
tl = norm(fetch("/timeline"))
check("timeline: カレンダー", "カレンダー（色の濃さ = メッセージ数）" in tl and "に開始したセッション" in tl)
raw_tl = fetch("/timeline")
check("timeline: セルtitle", raw_tl.count("セッション") > 100)
day = re.search(r"/timeline\?date=(\d{4}-\d{2}-\d{2})", raw_tl)
check("timeline: 日付リンクあり", day is not None)
if day:
    dt = day.group(1)
    tl2 = norm(fetch(f"/timeline?date={dt}"))
    check(f"timeline: 日別パネル({dt})", "に開始したセッション" in tl2 and ("セッション" in tl2))

# ---------------- tools
tt = norm(fetch("/tools"))
check("tools: 一覧", "ツール使用統計" in tt and "terminal" in tt and "呼び出し" in tt)
td = norm(fetch("/tools?tool=terminal"))
check("tools: 詳細", "週別の呼び出し回数" in td and "最近の呼び出し" in td)

# ---------------- search
se = norm(fetch("/search?q=Coolify"))
check("search: Coolify ヒット", re.search(r"「Coolify」の結果 — [0-9,]+ 件", se) is not None, f"db hits={search_hits}")
check("search: 結果行にリンク", "/sessions/2026" in fetch("/search?q=Coolify"))
se2 = norm(fetch("/search?q=" + urllib.parse.quote("セッション")))
check("search: 日本語クエリ", re.search(r"「セッション」の結果 — [0-9,]+ 件", se2) is not None)
se3 = norm(fetch("/search?q=Coolify&role=user"))
check("search: ロールフィルタ", "「Coolify」の結果" in se3)
se4 = norm(fetch("/search"))
check("search: クエリ無し200", "メッセージ検索" in se4)

# ---------------- 404
try:
    fetch("/sessions/does-not-exist-xxx")
    check("detail: 存在しないIDは404", False)
except urllib.error.HTTPError as e:
    check("detail: 存在しないIDは404", e.code == 404, f"code={e.code}")

# ---------------- 結果
ng = 0
for name, ok, detail in results:
    mark = "OK " if ok else "NG "
    if not ok:
        ng += 1
    print(f"[{mark}] {name}" + (f"  ({detail})" if detail and not ok else ""))
print(f"\n{len(results) - ng}/{len(results)} passed")
sys.exit(1 if ng else 0)
