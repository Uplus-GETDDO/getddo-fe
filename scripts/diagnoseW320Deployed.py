"""320px 넘침 배포본 진단 — verifyGd317AbusePage.py의 로그인을 재사용해 넘치는 요소를 열거한다."""
import json
import os
import re
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get('L6_DEPLOY_URL', 'https://getddo-fe.vercel.app').rstrip('/')
OUT = Path('reports/gd328-w320-diagnose-deployed.json')

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


def fetch(url):
    with urllib.request.urlopen(url, timeout=20) as res:
        return res.read().decode('utf-8')


html = fetch(BASE + '/')
env_chunk = re.search(r'src="/assets/(env-[^"]+\.js)"|href="/assets/(env-[^"]+\.js)"', html)
assert env_chunk, 'env 청크를 찾지 못했다'
ENV_FILE = env_chunk.group(1) or env_chunk.group(2)
env_src = fetch(f'{BASE}/assets/{ENV_FILE}')
m = re.search(r'virtualUsersJson:`(.*?)`', env_src, re.S)
USERS = json.loads(m.group(1))
ADMIN = next((u for u in USERS if u['role'] == 'ADMIN'), None)
assert ADMIN, '배포 JSON에 ADMIN 계정이 없다'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 320, 'height': 800})
    page = context.new_page()
    page.set_default_timeout(20000)

    page.goto(BASE + '/', wait_until='networkidle')
    page.get_by_role('button', name=re.compile(re.escape(ADMIN['name']))).first.click()
    page.wait_for_url(BASE + '/', timeout=20000)
    page.wait_for_timeout(2000)

    result = {}
    for path in ('/admin/entries', '/admin/tickets', '/admin/entries?view=participants'):
        page.goto(BASE + path, wait_until='networkidle')
        page.wait_for_timeout(1500)
        result[path] = page.evaluate(SCAN)
        safe = path.replace('/', '_').replace('?', '_').replace('=', '_')
        page.screenshot(path=f'reports/gd328-w320{safe}.png', full_page=True)

    browser.close()

OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
for path, r in result.items():
    print(f"\n=== {path}: overflowPx={r['overflowPx']}")
    for b in r['bad'][:12]:
        print(f"  [{b['kind']}] <{b['tag']}> aria={b['aria']} rect={b['rect']} sw={b['sw']} cw={b['cw']}")
        print(f"      cls={b['cls'][:100]}")
        print(f"      parents={' < '.join(b['parents'])}")
