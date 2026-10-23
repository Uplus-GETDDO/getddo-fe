"""GD-328: /admin/entries·/admin/tickets 320px 가로 넘침 수정 검증 — 로컬 빌드 + 실서버 프록시.

serveLocalRealApi.mjs(5196)가 dist/를 서빙하고 /api/*를 실서버로 전달한다.
배포 env 청크에서 ADMIN 계정을 읽어 로그인한 뒤 각 화면을 320px에서 점검한다:
  1) documentElement 가로 넘침 0px
  2) 표 가로 스크롤 region 존재·키보드(Tab) 진입·ArrowRight로 내부 스크롤
  3) 페이지네이션 nav가 문서를 밀지 않고 안쪽 스크롤로 담긴다
  4) 콘솔 오류 0건

읽기 전용 — 화면 조작은 조회·탭 전환만 한다. 결과는
reports/20261023-gd328-w320.json + reports/gd328-w320/*.png

전제: VITE_ENABLE_MSW=false + 배포 VITE_VIRTUAL_USERS_JSON으로 빌드된 dist/
환경변수: GD328_BASE(기본 http://localhost:5196), L6_DEPLOY_URL(계정 추출용, 기본 https://getddo-fe.vercel.app)
"""
import json
import os
import re
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get('GD328_BASE', 'http://localhost:5196').rstrip('/')
DEPLOY = os.environ.get('L6_DEPLOY_URL', 'https://getddo-fe.vercel.app').rstrip('/')
IMAGES = Path('reports/gd328-w320')
IMAGES.mkdir(parents=True, exist_ok=True)
OUTPUT = Path('reports/20261023-gd328-w320.json')
COMMIT = subprocess.run(
    ['git', 'rev-parse', 'HEAD'],
    capture_output=True,
    text=True,
    encoding='utf-8',
    errors='replace',
).stdout.strip()
evidence = {
    'kind': 'GD-328 관리자 응모 조회·응모권 이력 320px 넘침 수정 검증 — 로컬 빌드 + 실서버 프록시',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'verifierCommit': COMMIT,
    'url': BASE,
    'checks': [],
    'errors': [],
}


def save():
    OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')


def check(name, **fields):
    evidence['checks'].append({'name': name, **fields})
    save()
    print(f"check: {name} {fields}")


def fetch(url):
    with urllib.request.urlopen(url, timeout=20) as res:
        return res.read().decode('utf-8')


# 배포 env 청크에서 ADMIN 계정을 읽는다 — dist에 구운 계정과 같은 원본이다.
html = fetch(DEPLOY + '/')
env_chunk = re.search(r'src="/assets/(env-[^"]+\.js)"|href="/assets/(env-[^"]+\.js)"', html)
assert env_chunk, 'env 청크를 찾지 못했다'
ENV_FILE = env_chunk.group(1) or env_chunk.group(2)
env_src = fetch(f'{DEPLOY}/assets/{ENV_FILE}')
m = re.search(r'virtualUsersJson:`(.*?)`', env_src, re.S)
assert m, 'virtualUsersJson을 찾지 못했다'
USERS = json.loads(m.group(1))
ADMIN = next((u for u in USERS if u['role'] == 'ADMIN'), None)
assert ADMIN, '배포 JSON에 ADMIN 계정이 없다'


def record_console(msg):
    if msg.type == 'error':
        evidence['errors'].append(f'console.error: {msg.text}')


def measure(page, path, region_name):
    page.goto(BASE + path, wait_until='networkidle')
    page.wait_for_timeout(1500)
    display_path = path.split('?')[0] + ('?view=participants' if 'participants' in path else '')
    metrics = page.evaluate("""regionLabel => {
        const de = document.documentElement;
        const region = [...document.querySelectorAll('[role="region"]')]
            .find(el => el.getAttribute('aria-label') === regionLabel) ?? null;
        const nav = document.querySelector('nav[aria-label="페이지"]');
        return {
            overflowPx: de.scrollWidth - de.clientWidth,
            regionExists: !!region,
            regionScrollable: region ? region.scrollWidth > region.clientWidth : null,
            navExists: !!nav,
            navContained: nav ? nav.getBoundingClientRect().right <= de.clientWidth + 1 : null,
            navScrollable: nav ? nav.scrollWidth > nav.clientWidth : null,
        };
    }""", region_name)
    check(f'320px 레이아웃 {display_path}', **metrics)
    assert metrics['overflowPx'] <= 0, f'{path} 넘침 {metrics["overflowPx"]}px'
    assert metrics['regionExists'], f'{path} 표 스크롤 region 없음'
    if metrics['navExists']:
        assert metrics['navContained'], f'{path} 페이지네이션이 화면 밖으로 밀렸다'

    # region 키보드 진입 + 화살표 스크롤 — Tab 순서로 도달해야 한다
    # (focus()는 tabIndex가 없어도 성공하므로 진입 가능 여부를 검증하지 못한다)
    region = page.get_by_role('region', name=region_name)
    focused = False
    for _ in range(60):
        page.keyboard.press('Tab')
        if region.evaluate('(el) => el === document.activeElement'):
            focused = True
            break
    scroll_before = region.evaluate('(el) => el.scrollLeft')
    for _ in range(10):
        page.keyboard.press('ArrowRight')
    page.wait_for_timeout(300)
    scroll_after = region.evaluate('(el) => el.scrollLeft')
    check(
        f'키보드 스크롤 {display_path}',
        focused=focused,
        scrollable=metrics['regionScrollable'],
        scrolled=scroll_after > scroll_before,
    )
    assert focused, f'{path} region에 포커스가 가지 않았다'
    if metrics['regionScrollable']:
        assert scroll_after > scroll_before, f'{path} ArrowRight로 표가 스크롤되지 않았다'
    return metrics


failures = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 320, 'height': 800})
    page = context.new_page()
    page.set_default_timeout(20000)
    page.on('pageerror', lambda e: evidence['errors'].append(str(e)))
    page.on('console', record_console)

    page.goto(BASE + '/', wait_until='networkidle')
    page.get_by_role('button', name=re.compile(re.escape(ADMIN['name']))).first.click()
    page.wait_for_url(BASE + '/', timeout=20000)
    page.wait_for_timeout(2000)

    measure(page, '/admin/entries', '응모 이력 표 가로 스크롤')
    page.screenshot(path=str(IMAGES / 'entries.png'), full_page=True)

    measure(page, '/admin/tickets', '응모권 이력 표 가로 스크롤')
    page.screenshot(path=str(IMAGES / 'tickets.png'), full_page=True)

    # 참여자 탭 — 이벤트 ID가 있어야 표가 나온다. 응모 이력 탭의 첫 행 이벤트로 진입한다
    req = urllib.request.Request(
        f'{BASE}/api/v1/admin/entries?page=1&size=1',
        headers={'X-User-ID': ADMIN['id'], 'X-User-Role': 'ADMIN'},
    )
    try:
        first = json.loads(urllib.request.urlopen(req, timeout=20).read())['data']['items'][0]
        event_id = first.get('eventId')
    except Exception:
        event_id = None
    if event_id:
        measure(page, f'/admin/entries?view=participants&eventId={event_id}', '참여자 표 가로 스크롤')
        page.screenshot(path=str(IMAGES / 'participants.png'), full_page=True)
    else:
        check(
            '참여자 탭',
            ok=False,
            reason='응모 이력 API 실패 또는 첫 행에 eventId 없음 — 검증 데이터 부족',
        )
        failures.append('참여자 탭 검증 불가: eventId를 얻지 못했다')

    browser.close()

check('콘솔 오류', count=len(evidence['errors']), errors=evidence['errors'])
assert not evidence['errors'], f"브라우저 오류 {len(evidence['errors'])}건: {evidence['errors'][:3]}"
assert not failures, '; '.join(failures)
print(f"\n증거 기록: {OUTPUT} ({len(evidence['checks'])} checks)")
