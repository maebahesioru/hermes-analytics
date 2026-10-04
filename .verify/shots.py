#!/usr/bin/env python3
"""ページのスクリーンショットを撮る（Playwright・Brave とは別プロファイル）"""
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright  # type: ignore

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4100"
OUT = Path(__file__).parent / "shots"
OUT.mkdir(exist_ok=True)

# 詳細ページ用: メッセージ数が中ぐらいのセッションを1つ選ぶ
detail_id = subprocess.run(
    [
        "sqlite3",
        str(Path.home() / ".hermes/state.db"),
        "SELECT id FROM sessions WHERE message_count BETWEEN 150 AND 400 ORDER BY started_at DESC LIMIT 1;",
    ],
    capture_output=True,
    text=True,
).stdout.strip()

pages = [
    ("top", "/"),
    ("sessions", "/sessions"),
    ("timeline", "/timeline"),
    ("detail", f"/sessions/{detail_id}"),
    ("tools", "/tools?tool=terminal"),
    ("search", "/search?q=Coolify"),
]

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    errors: list[str] = []
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    for name, path in pages:
        pg.goto(BASE + path, wait_until="networkidle", timeout=180_000)
        pg.wait_for_timeout(300)
        f = OUT / f"{name}.png"
        pg.screenshot(path=str(f), full_page=True)
        print(f"{name}: {f} ({f.stat().st_size // 1024}KB)")
    b.close()
    if errors:
        print("console errors:")
        for e in errors[:10]:
            print(" -", e[:200])
    else:
        print("console errors: none")
