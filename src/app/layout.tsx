import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { totals } from "@/lib/queries";

export const metadata: Metadata = {
  title: { default: "Hermes Analytics", template: "%s | Hermes Analytics" },
  description:
    "Hermes Agent の state.db を読み取り専用でライブ集計するアナリティクス／作業履歴ダッシュボード",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  let firstTs = 0;
  let lastTs = 0;
  try {
    const t = totals();
    firstTs = t.first_ts;
    lastTs = t.last_ts;
  } catch {
    /* DB が開けなくても枠は表示する */
  }
  return (
    <html lang="ja">
      <body>
        <Sidebar firstTs={firstTs} lastTs={lastTs} />
        <main className="ml-52 min-h-screen px-5 py-4">{children}</main>
      </body>
    </html>
  );
}
