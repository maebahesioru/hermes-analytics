/**
 * Next.js instrumentation: サーバー起動時に
 *  1. 重い集計クエリを先回ししてキャッシュを温め（ウォーム）
 *  2. 全ルートを自分自身にHTTPで先読みさせてルートモジュールをメモリに載せる
 * どちらも非同期・非ブロッキング（サーバーは即受付開始）。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const port = process.env.PORT ?? "4100";

  const prefetchRoutes = async () => {
    const routes = [
      "/",
      "/timeline",
      "/sessions",
      "/tools",
      "/tools?tool=terminal",
      "/search?q=Coolify",
    ];
    for (const path of routes) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`http://127.0.0.1:${port}${path}`, {
            signal: AbortSignal.timeout(180_000),
          });
          await res.arrayBuffer(); // レスポンスを読み切ってレンダリングを完了させる
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
  };

  setTimeout(async () => {
    try {
      const { warmCaches } = await import("./lib/queries");
      await warmCaches();
      await prefetchRoutes();
    } catch {
      /* DBが開けなくても起動は継続 */
    }
  }, 50);
}
