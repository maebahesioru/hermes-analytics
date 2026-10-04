# hermes-analytics

Hermes Agent の **state.db（SQLite）を読み取り専用でライブ集計**するローカルダッシュボード。
セッション・メッセージ・トークン・コスト・ツール実行を、DB から直接そのまま可視化する。

## クイックスタート

```bash
cd ~/デスクトップ/hermes-analytics
bun run build     # 初回・更新時
bun run start     # → http://localhost:4100
```

- DB は `~/.hermes/state.db` を開く（`HERMES_STATE_DB` 環境変数で上書き可）。
- **読み取り専用接続**なので DB を壊すことはない。Hermes の稼働中でも安全に読める（WAL）。
- 集計はプロセス内メモリキャッシュ（30〜180秒）なので、直近の記録が反映されるまで
  少し遅れることがある。ページ再読込で最新化。

## ページ

| パス | 内容 |
|---|---|
| `/` | KPI（全期間）・日別アクティビティ（7/30/90日/全期間）・時間帯×曜日ヒートマップ・モデル/ソース/ツール/最近のセッション |
| `/timeline` | GitHub風カレンダー（色=メッセージ数）。セルクリックでその日に開始したセッション一覧 |
| `/sessions` | 全セッション一覧。タイトル検索 / ソース / モデル / 並び替え / ページング |
| `/sessions/[id]` | セッション詳細。メタ情報・モデル内訳・ロール別メッセージ・全文表示・圧縮済み履歴トグル |
| `/tools` | ツール使用統計（呼び出し数・週別推移・最近の呼び出し） |
| `/search` | メッセージ本文の横断検索（部分一致・全ロール・初回1〜2秒 / 同一クエリはキャッシュ即時） |

## 仕組み

- **DB アクセス**: Node 組み込みの `node:sqlite`（`DatabaseSync`）で `readOnly: true` 接続。
  書き込み系 SQL は接続レベルで拒否される。
- **集計クエリ**: `sessions`（トークン・コスト・タイトル）と `messages`（全履歴・648k行超）を
  直接 GROUP BY。日付境界は JST（`+9 hours`）固定。
- **全文検索**: state.db の FTS（trigram）はツール出力・cron/subagent を除外するビュー由来で
  穴があるため使わず、`LIKE` の id 降順スキャン（早期打ち切り・5分キャッシュ）で全件を対象にする。
- **体感速度**: 重い集計は stale-while-revalidate（期限切れでも古い値を即返し、再集計は
  バックグラウンドのキューで1件ずつ実行）。起動時は instrumentation が集計をウォームし、
  全ルートを先読みする。実測: 全ページ初回 0.03〜0.25s（それ以前は冷えた状態で 6〜7s）。
- **表示の線引き**: `messages` テーブルは圧縮で畳まれた履歴も含む「全記録」。セッション詳細の
  デフォルトは `active=1`（現行）で、「圧縮済み履歴も含む」で全件表示に切り替え。
- コスト（`estimated_cost_usd`）は DB 記録値そのまま。一部プロバイダで計上異常を含む
  （合計が現実離れして見える場合はそれ）。

## 検証

サーバー起動中に:

```bash
python3 .verify/verify.py                                  # 27項目の回帰テスト（DB実値と突き合わせ）
~/.hermes/hermes-agent/venv/bin/python .verify/probe.py    # 幾何プローブ（折返し・整列・横溢れ）
~/.hermes/hermes-agent/venv/bin/python .verify/shots.py    # 全ページのスクショ
```

## トラブル対応

- **ポート 4100 が使用中**: `ss -tlnp | grep :4100` で PID を特定して `kill <PID>`。
- **数値が古い**: 集計キャッシュ（最大180秒）の仕様。リロードか少し待つ。
- **検索が重い**: 初回の LIKE 走査は約1〜2秒。同一クエリは5分キャッシュ。
- **DB を開けない**: `HERMES_STATE_DB` の指す先と読み取り権限を確認。

## 開発メモ

- Next.js 16 + TS + Tailwind 4。`src/lib/db.ts`（接続） / `src/lib/queries.ts`（全クエリ） /
  `src/components/charts.tsx`（SVG/CSSチャート・全部サーバーレンダリング）。
- クライアント JS はサイドバーのアクティブ表示のみ。他はすべて RSC + `<title>` ツールチップ。
- モデルは `session_model_usage`（billing 行はモデル単位で合算）を参照。
