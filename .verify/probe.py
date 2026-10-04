#!/usr/bin/env python3
"""幾何の実測プローブ: 1) 検索スニペットの折返し 2) カレンダーのラベル整列 3) 全ページの横溢れ"""
import json
import sys

from playwright.sync_api import sync_playwright  # type: ignore

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4100"

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900})

    # --- 1. 検索ページ: スニペットの折返し実測
    pg.goto(BASE + "/search?q=Coolify", wait_until="networkidle")
    res = pg.evaluate(
        """() => {
      const divs = [...document.querySelectorAll('div.break-words')];
      let overflow = 0; const samples = [];
      for (const d of divs) {
        if (d.scrollWidth > d.clientWidth + 1) {
          overflow++;
          if (samples.length < 3) samples.push({sw: d.scrollWidth, cw: d.clientWidth, text: d.textContent.slice(0, 60)});
        }
      }
      const s = divs[0] ? getComputedStyle(divs[0]) : null;
      return {
        snippetDivs: divs.length, overflowCount: overflow, samples,
        overflowWrap: s ? s.overflowWrap : null, wordBreak: s ? s.wordBreak : null,
        docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }"""
    )
    print("search:", json.dumps(res, ensure_ascii=False))

    # ハイライト数
    res_hl = pg.evaluate(
        """() => {
      const marks = [...document.querySelectorAll('mark')].length;
      const rows = [...document.querySelectorAll('mark')].slice(0, 5).map(m => m.textContent);
      return {marks, rows};
    }"""
    )
    print("search-highlight:", json.dumps(res_hl, ensure_ascii=False))

    # --- 2. カレンダーの整列実測
    pg.goto(BASE + "/timeline", wait_until="networkidle")
    res2 = pg.evaluate(
        """() => {
      const cal = document.querySelector('.overflow-x-auto');
      const labelRow = cal.children[0];
      const grid = cal.children[1];
      const labelEls = [...labelRow.children];
      const weekCols = [...grid.children].slice(1);  // 先頭は曜日ラベル列
      const pairs = [];
      for (let i = 0; i < labelEls.length && i < weekCols.length; i++) {
        const t = labelEls[i].textContent.trim();
        if (!t) continue;
        const lx = labelEls[i].getBoundingClientRect().left;
        const cx = weekCols[i].getBoundingClientRect().left;
        pairs.push({ label: t, weekIdx: i, dx: Math.round(lx - cx), labelW: Math.round(labelEls[i].getBoundingClientRect().width) });
      }
      // 実際に色がついている最右列のインデックス
      let lastColored = -1;
      weekCols.forEach((c, i) => {
        if ([...c.children].some(el => !el.className.includes('opacity-0') && !el.className.includes('bg-panel2'))) lastColored = i;
      });
      return { pairs, weekCount: weekCols.length, lastColored };
    }"""
    )
    print("calendar:", json.dumps(res2, ensure_ascii=False))

    # --- 3. 全ページの横溢れ
    for path in ["/", "/sessions", "/timeline", "/tools?tool=terminal", "/search?q=session"]:
        pg.goto(BASE + path, wait_until="networkidle")
        r = pg.evaluate(
            "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
        )
        print(f"overflow[{path}]: {r}px")

    b.close()
