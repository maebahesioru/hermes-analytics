"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fmtDT } from "@/lib/format";

const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const NAV = [
  {
    href: "/",
    label: "ダッシュボード",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/timeline",
    label: "タイムライン",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="4.5" width="18" height="17" rx="2" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
        <path d="M7.5 13.5h3M13.5 13.5h3M7.5 17h3M13.5 17h3" />
      </svg>
    ),
  },
  {
    href: "/sessions",
    label: "セッション",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="2" cy="6" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/tools",
    label: "ツール",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
        <path d="M1 14h6M9 8h6M17 16h6" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "検索",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
];

export function Sidebar({ firstTs, lastTs }: { firstTs: number; lastTs: number }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-52 flex-col border-r border-line bg-panel px-3 py-4">
      <div className="px-2.5 pb-4">
        <div className="text-[15px] font-bold tracking-wide">
          Hermes <span className="text-acc">Analytics</span>
        </div>
        <div className="mt-0.5 text-[10px] text-dim">state.db live dashboard</div>
      </div>
      <nav className="flex-1 space-y-1">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                active
                  ? "bg-acc/10 font-medium text-acc"
                  : "text-mut hover:bg-panel2 hover:text-ink"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line px-2.5 pt-3 text-[10px] leading-4 text-dim">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
          読み取り専用でライブ接続
        </div>
        <div className="mt-1">
          {fmtDT(firstTs)} 〜
          <br />
          {fmtDT(lastTs)} まで
        </div>
      </div>
    </aside>
  );
}
