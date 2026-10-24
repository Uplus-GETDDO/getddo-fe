"""GD-328: 배포본 axe 접근성 기준선 — PPT '전' 수치용.

배포 사이트에 가상 사용자로 로그인해 주요 화면에 axe-core를 주입·실행한다.
증거에는 violations의 규칙·impact·노드 수·target 셀렉터만 남긴다 —
노드 html 스니펫에는 닉네임·userId 원문이 섞일 수 있어 기록하지 않는다.

결과: reports/20261023-gd328-baseline-axe.json

환경변수: L6_DEPLOY_URL(기본 https://getddo-fe.vercel.app),
          GD328_AXE_URL(axe-core CDN, 기본 jsdelivr pin)
"""
import json
import os
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get('L6_DEPLOY_URL', 'https://getddo-fe.vercel.app').rstrip('/')
AXE_URL = os.environ.get(
    'GD328_AXE_URL', 'https://cdn.jsdelivr.net/npm/axe-core@4.10.3/axe.min.js'
)
OUTPUT = Path('reports/20261023-gd328-baseline-axe.json')


def fetch(url):
    with urllib.request.urlopen(url, timeout=20) as res:
        return res.read().decode('utf-8')


html = fetch(BASE + '/')
env_chunk = re.search(r'src="/assets/(env-[^"]+\.js)"|href="/assets/(env-[^"]+\.js)"', html)
assert env_chunk, 'env 청크를 찾지 못했다'
env_src = fetch(f'{BASE}/assets/{env_chunk.group(1) or env_chunk.group(2)}')
USERS = json.loads(re.search(r'virtualUsersJson:`(.*?)`', env_src, re.S).group(1))
ADMIN = next((u for u in USERS if u['role'] == 'ADMIN'))
USER = next((u for u in USERS if u['role'] == 'USER'))

evidence = {
    'kind': 'GD-328 axe 접근성 기준선 — 배포본 (수정 전 상태)',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'url': BASE,
    'axeSource': AXE_URL,
    'pages': {},
}


def sanitize(violations):
    """violations에서 규칙 메타와 노드 위치만 남기고 html 원문은 버린다."""
    return [
        {
            'id': v['id'],
            'impact': v['impact'],
            'nodes': len(v['nodes']),
            'targets': [n['target'] for n in v['nodes'][:10]],
        }
        for v in violations
    ]


def run_axe(page, key):
    page.add_script_tag(url=AXE_URL)
    result = page.evaluate(
        'axe.run(document, { resultTypes: ["violations", "incomplete"] })'
    )
    evidence['pages'][key] = {
        'violations': sanitize(result['violations']),
        'incomplete': sanitize(result['incomplete']),
        'counts': {
            'violations': len(result['violations']),
            'incomplete': len(result['incomplete']),
        },
    }
    v = evidence['pages'][key]['counts']
    print(f"{key}: violations={v['violations']} incomplete={v['incomplete']}")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # 공개 화면 — 로그인 전
    for width, tag in ((1280, 'desktop'), (320, 'w320')):
        page = browser.new_context(viewport={'width': width, 'height': 900}).new_page()
        page.set_default_timeout(30000)
        page.goto(BASE + '/login', wait_until='networkidle')
        page.wait_for_timeout(1500)
        run_axe(page, f'/login:{tag}')
        page.context.close()

    # 사용자 홈 — USER 로그인
    page = browser.new_context(viewport={'width': 1280, 'height': 900}).new_page()
    page.goto(BASE + '/login', wait_until='networkidle')
    page.get_by_role('button', name=re.compile(re.escape(USER['name']))).first.click()
    page.wait_for_url(BASE + '/', timeout=20000)
    page.wait_for_timeout(2500)
    run_axe(page, '/:desktop:user')
    page.context.close()

    # 관리자 화면 — ADMIN 로그인
    for width, tag in ((1280, 'desktop'), (320, 'w320')):
        context = browser.new_context(viewport={'width': width, 'height': 900})
        page = context.new_page()
        page.set_default_timeout(30000)
        page.goto(BASE + '/', wait_until='networkidle')
        page.get_by_role('button', name=re.compile(re.escape(ADMIN['name']))).first.click()
        page.wait_for_url(BASE + '/', timeout=20000)
        page.wait_for_timeout(2000)
        for path in ('/admin/entries', '/admin/tickets'):
            page.goto(BASE + path, wait_until='networkidle')
            page.wait_for_timeout(1500)
            run_axe(page, f'{path}:{tag}')
        context.close()

    browser.close()

OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')
total = sum(pg['counts']['violations'] for pg in evidence['pages'].values())
print(f"\n증거 기록: {OUTPUT} - violations 합계 {total}")
