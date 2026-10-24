"""320px 넘침 진단 — MSW dev 서버(5199)에서 넘치는 요소를 열거한다. 진단용 일회성 스크립트.

환경변수 GD328_BASE로 대상을 바꿀 수 있다 (기본 http://localhost:5199).
"""
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get('GD328_BASE', 'http://localhost:5199').rstrip('/')
OUT = Path('reports/gd328-w320-diagnose.json')

# 화면 밖으로 삐져나온 요소(overDoc)와, overflow가 visible인 채 내용이 넓은 요소(innerLeak)를 잡는다.
SCAN = """() => {
    const de = document.documentElement;
    const vw = de.clientWidth;
    const bad = [];
    const chainOf = (el) => {
        const c = [];
        for (let p = el.parentElement; p && c.length < 5; p = p.parentElement) {
            const cls = typeof p.className === 'string'
                ? '.' + p.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
            c.push(p.tagName.toLowerCase() + (p.id ? '#' + p.id : '') + cls);
        }
        return c;
    };
    for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        // 스크롤 컨테이너 안쪽에 클립된 콘텐츠는 문서 넘침이 아니므로 걸러 낸다
        let clipped = false;
        for (let p = el.parentElement; p; p = p.parentElement) {
            const pc = getComputedStyle(p);
            if (/(auto|scroll|hidden|clip)/.test(pc.overflowX)) { clipped = true; break; }
        }
        const overDoc = (r.right > vw + 1 || r.left < -1) && !clipped;
        const innerLeak = el.scrollWidth > el.clientWidth + 1 && cs.overflowX === 'visible';
        if (overDoc || innerLeak) {
            bad.push({
                tag: el.tagName.toLowerCase(),
                cls: (typeof el.className === 'string' ? el.className : '').slice(0, 140),
                aria: el.getAttribute('aria-label'),
                rect: [Math.round(r.left), Math.round(r.right)],
                sw: el.scrollWidth, cw: el.clientWidth,
                ox: cs.overflowX,
                kind: overDoc ? 'overDoc' : 'innerLeak',
                text: (el.innerText || '').trim().slice(0, 50),
                parents: chainOf(el),
            });
        }
    }
    return { vw, scrollW: de.scrollWidth, overflowPx: de.scrollWidth - vw, bad };
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 320, 'height': 800})
    page = context.new_page()
    page.set_default_timeout(20000)

    page.goto(f'{BASE}/login', wait_until='networkidle')
    page.locator('button', has_text='관리자').first.click()
    page.wait_for_url(f'{BASE}/')
    page.wait_for_timeout(1500)

    result = {}
    for path in ('/admin/entries', '/admin/tickets'):
        page.goto(f'{BASE}{path}', wait_until='networkidle')
        page.wait_for_timeout(1500)
        result[path] = page.evaluate(SCAN)
        page.screenshot(path=f'reports/gd328-w320-{path.split("/")[-1]}.png', full_page=True)

    # entries의 참여자 탭도 본다
    page.goto(f'{BASE}/admin/entries?view=participants', wait_until='networkidle')
    page.wait_for_timeout(1500)
    result['/admin/entries?view=participants'] = page.evaluate(SCAN)

    browser.close()

OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
for path, r in result.items():
    print(f"\n=== {path}: overflowPx={r['overflowPx']} scrollW={r['scrollW']} vw={r['vw']}")
    for b in r['bad'][:15]:
        print(f"  [{b['kind']}] <{b['tag']}> aria={b['aria']} rect={b['rect']} sw={b['sw']} cw={b['cw']} ox={b['ox']}")
        print(f"      cls={b['cls'][:100]}")
        print(f"      text={b['text'][:50]!r} parents={' < '.join(b['parents'])}")
