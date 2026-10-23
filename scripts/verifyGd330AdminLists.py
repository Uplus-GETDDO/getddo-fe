"""GD-330: 관리자 목록 화면 320px 넘침·axe 재측정 — 배포본.

GD-328의 공용 Pagination 수정(max-w-full overflow-x-auto)이 entries·tickets 외의
관리자 목록 화면도 보호하는지 배포본에서 확인한다. 각 관리자 경로에서
  - w320: documentElement 가로 넘침 px, 표 스크롤 region, 페이지네이션 nav 포함 여부
  - w320+desktop: axe violations/incomplete (scrollable-region-focusable·color-contrast 요약)
  - 콘솔 오류 수집

측정 전 배포 에셋 해시를 기록하고 GD-328 기준선(lighthouse JSON의 해시)과 비교해
배포가 최신인지 표시한다 — 기준선과 같으면 아직 재배포가 안 된 것이므로 중단한다.

증거에는 규칙·노드 수·target 셀렉터만 남긴다 — userId·eventId·닉네임 원문 금지.
결과: reports/20261023-gd330-admin-lists.json

환경변수: L6_DEPLOY_URL(기본 https://getddo-fe.vercel.app),
          GD330_AXE_URL(axe-core CDN, 기본 jsdelivr pin)
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
    'GD330_AXE_URL', 'https://cdn.jsdelivr.net/npm/axe-core@4.10.3/axe.min.js'
)
OUTPUT = Path('reports/20261023-gd330-admin-lists.json')
IMAGES = Path('reports/gd330-admin-lists')
IMAGES.mkdir(parents=True, exist_ok=True)

# GD-328 기준선 시점의 에셋 해시 — 같으면 머지 후 재배포가 아직 안 된 것
BASELINE_ASSETS = {
    'index-bQXkTB_J.css',
    'index-CL6m5Ctq.js',
    'vendor-Y8fqTZwr.js',
}

ADMIN_PATHS = [
    '/admin',
    '/admin/users',
    '/admin/entries',
    '/admin/events',
    '/admin/draw',
    '/admin/tickets',
    '/admin/abuse-cases',
    '/admin/notifications',
    '/admin/banners',
    '/admin/attendance-policies',
    '/admin/missions',
    '/admin/virtual-users',
]


def fetch(url):
    with urllib.request.urlopen(url, timeout=20) as res:
        return res.read().decode('utf-8')


html = fetch(BASE + '/')
assets = set(re.findall(r'/assets/([A-Za-z0-9_.-]+\.(?:js|css))', html))
env_match = re.search(r'/assets/(env-[^"]+\.js)', html)
assert env_match, 'env 청크를 찾지 못했다'
env_src = fetch(f'{BASE}/assets/{env_match.group(1)}')
m = re.search(r'virtualUsersJson:`(.*?)`', env_src, re.S)
assert m, 'virtualUsersJson을 찾지 못했다'
USERS = json.loads(m.group(1))
ADMIN = next((u for u in USERS if u['role'] == 'ADMIN'), None)
assert ADMIN, '배포 JSON에 ADMIN 계정이 없다'

changed = bool(assets - BASELINE_ASSETS)
print('deploy assets:', sorted(assets))
print('changedSinceBaseline:', changed)

evidence = {
    'kind': 'GD-330 관리자 목록 화면 320px 넘침·axe 재측정 — 배포본 (GD-328 머지 후)',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'url': BASE,
    'axeSource': AXE_URL,
    'deployAssets': sorted(assets),
    'changedSinceBaseline': changed,
    'checks': [],
    'axe': {},
    'errors': [],
}


def save():
    OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')


def check(name, **fields):
    evidence['checks'].append({'name': name, **fields})
    save()
    print(f"check: {name} {fields}")


def sanitize(violations):
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
    # add_script_tag는 네비게이션마다 초기화되므로 매번 주입한다
    page.add_script_tag(url=AXE_URL)
    result = page.evaluate('axe.run(document, { resultTypes: ["violations", "incomplete"] })')
    entry = {
        'violations': sanitize(result['violations']),
        'incomplete': sanitize(result['incomplete']),
        'counts': {
            'violations': len(result['violations']),
            'incomplete': len(result['incomplete']),
        },
    }
    for vid in ('scrollable-region-focusable', 'color-contrast', 'link-in-text-block'):
        hit = next((v for v in result['violations'] if v['id'] == vid), None)
        entry[f'{vid}-nodes'] = len(hit['nodes']) if hit else 0
    evidence['axe'][key] = entry
    save()
    print(f"axe {key}: violations={entry['counts']['violations']} incomplete={entry['counts']['incomplete']}")


def measure_layout(page, display_path):
    metrics = page.evaluate("""() => {
        const de = document.documentElement;
        const regions = [...document.querySelectorAll('[role="region"]')].map(el => ({
            label: el.getAttribute('aria-label'),
            tabbable: el.tabIndex >= 0,
            scrollable: el.scrollWidth > el.clientWidth + 1,
        }));
        const nav = document.querySelector('nav[aria-label="페이지"]');
        return {
            overflowPx: de.scrollWidth - de.clientWidth,
            regions,
            navExists: !!nav,
            navContained: nav ? nav.getBoundingClientRect().right <= de.clientWidth + 1 : null,
        };
    }""")
    check(f'320px 레이아웃 {display_path}', **metrics)
    if metrics['overflowPx'] > 0:
        page.screenshot(path=str(IMAGES / f"{display_path.replace('/', '_').replace('?', '_')}.png"), full_page=True)
    return metrics


def record_console(msg):
    if msg.type == 'error':
        evidence['errors'].append(f'console.error: {msg.text}')


failures = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_context(viewport={'width': 320, 'height': 800}).new_page()
    page.set_default_timeout(30000)
    page.on('pageerror', lambda e: evidence['errors'].append(str(e)))
    page.on('console', record_console)
    page.goto(BASE + '/', wait_until='networkidle')
    page.get_by_role('button', name=re.compile(re.escape(ADMIN['name']))).first.click()
    page.wait_for_url(BASE + '/', timeout=20000)
    page.wait_for_timeout(2000)

    paths = list(ADMIN_PATHS)
    # 참여자 탭 — 첫 행 eventId로 진입 (실패 시 사유만 기록)
    try:
        req = urllib.request.Request(
            f'{BASE}/api/v1/admin/entries?page=1&size=1',
            headers={'X-User-ID': ADMIN['id'], 'X-User-Role': 'ADMIN'},
        )
        event_id = json.loads(urllib.request.urlopen(req, timeout=20).read())['data']['items'][0].get('eventId')
        if event_id:
            paths.insert(3, '/admin/entries?view=participants')
        else:
            event_id = None
    except Exception as e:
        event_id = None
        check('참여자 탭 준비', ok=False, reason=f'eventId 조회 실패: {type(e).__name__}')

    for path in paths:
        url = BASE + path + (f'&eventId={event_id}' if 'participants' in path and event_id else '')
        page.goto(url, wait_until='networkidle')
        page.wait_for_timeout(1500)
        m = measure_layout(page, path)
        run_axe(page, f'{path}:w320')
        if m['overflowPx'] > 0:
            failures.append(f'{path} 넘침 {m["overflowPx"]}px')
        if m['navExists'] and not m['navContained']:
            failures.append(f'{path} 페이지네이션 화면 밖')
        for r in m['regions']:
            if r['scrollable'] and not r['tabbable']:
                failures.append(f"{path} 스크롤 region '{r['label']}' tabIndex 없음")

    # 데스크톱 axe — 1280
    page = browser.new_context(viewport={'width': 1280, 'height': 900}).new_page()
    page.set_default_timeout(30000)
    page.on('pageerror', lambda e: evidence['errors'].append(str(e)))
    page.on('console', record_console)
    page.goto(BASE + '/', wait_until='networkidle')
    page.get_by_role('button', name=re.compile(re.escape(ADMIN['name']))).first.click()
    page.wait_for_url(BASE + '/', timeout=20000)
    page.wait_for_timeout(2000)
    for path in paths:
        url = BASE + path + (f'&eventId={event_id}' if 'participants' in path and event_id else '')
        page.goto(url, wait_until='networkidle')
        page.wait_for_timeout(1500)
        run_axe(page, f'{path}:desktop')

    browser.close()

check('콘솔 오류', count=len(evidence['errors']), errors=evidence['errors'][:5])
assert changed, '배포 에셋 해시가 GD-328 기준선과 동일 — 머지 후 재배포 확인 필요'
assert not evidence['errors'], f"브라우저 오류 {len(evidence['errors'])}건: {evidence['errors'][:3]}"
assert not failures, '; '.join(failures)
print(f"\n증거 기록: {OUTPUT} ({len(evidence['checks'])} checks, {len(evidence['axe'])} axe runs)")
