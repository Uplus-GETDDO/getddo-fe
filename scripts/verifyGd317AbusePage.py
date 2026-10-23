"""GD-317 AR01/AR02 배포 화면 검증 — 실제 배포(getddo-fe.vercel.app) 대상.

verifyL6Deployed.py와 같은 방식으로 번들 env의 ADMIN 계정으로 로그인해
관리자 '어뷰징 차단 내역' 화면(/admin/abuse-cases)이 실서버 데이터를
그리는지 확인한다:
  1) 목록 200·실제 차단 행 렌더(닉네임·구분·사유·차단 시각)
  2) 행 클릭 → AR02 상세 드로어 — evidence(규칙 버전·기준 범위·집계 구간·한도·거절/기준 횟수) 표시
  3) userId 필터 적용 → 결과 좁힘, 초기화 복귀
  4) 320px 가로 넘침 없음
  5) 콘솔 오류 0건

읽기 전용 — 화면 조작은 조회·필터만 한다. 결과는
reports/20261023-gd317-abuse-page.json + reports/gd317-abuse-page/*.png

환경변수: L6_DEPLOY_URL(기본 https://getddo-fe.vercel.app)
"""
import json
import os
import re
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get('L6_DEPLOY_URL', 'https://getddo-fe.vercel.app').rstrip('/')
IMAGES = Path('reports/gd317-abuse-page')
IMAGES.mkdir(parents=True, exist_ok=True)
OUTPUT = Path('reports/20261023-gd317-abuse-page.json')
COMMIT = subprocess.run(
    ['git', 'rev-parse', 'HEAD'],
    capture_output=True,
    text=True,
    encoding='utf-8',
    errors='replace',
).stdout.strip()
evidence = {
    'kind': 'GD-317 AR01/AR02 배포 화면 검증 — 실제 배포 관측',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'verifierCommit': COMMIT,
    'url': BASE,
    'requests': [],
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


# 배포 번들의 env 청크에서 실제로 구워진 계정 JSON을 읽는다 — 대시보드 값이 아니라 번들이 기준이다.
html = fetch(BASE + '/')
env_chunk = re.search(r'src="/assets/(env-[^"]+\.js)"|href="/assets/(env-[^"]+\.js)"', html)
assert env_chunk, 'env 청크를 찾지 못했다'
ENV_FILE = env_chunk.group(1) or env_chunk.group(2)
env_src = fetch(f'{BASE}/assets/{ENV_FILE}')
m = re.search(r'virtualUsersJson:`(.*?)`', env_src, re.S)
assert m, 'virtualUsersJson을 찾지 못했다 — env 미설정 빌드일 수 있다'
USERS = json.loads(m.group(1))
ADMIN = next((u for u in USERS if u['role'] == 'ADMIN'), None)
assert ADMIN, '배포 JSON에 ADMIN 계정이 없다'


def record_console(msg):
    # pageerror는 미처리 예외만 잡는다 — throw 없이 찍히는 console.error도 함께 기록한다
    if msg.type == 'error':
        evidence['errors'].append(f'console.error: {msg.text}')


def record_response(response):
    request = response.request
    if '/api/' not in request.url:
        return
    path = request.url.split('/api', 1)[1].split('?')[0]
    evidence['requests'].append(
        {
            'method': request.method,
            'path': path,
            'status': response.status,
            'x-user-role': request.headers.get('x-user-role'),
        }
    )
    save()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = context.new_page()
    page.set_default_timeout(20000)
    page.on('pageerror', lambda e: evidence['errors'].append(str(e)))
    page.on('console', record_console)
    page.on('response', record_response)

    # 로그인 — 번들 계정 목록에서 ADMIN을 선택한다
    page.goto(BASE + '/', wait_until='networkidle')
    page.get_by_role('button', name=re.compile(re.escape(ADMIN['name']))).first.click()
    page.wait_for_url(BASE + '/', timeout=20000)
    page.wait_for_timeout(2000)

    # 관리자 어뷰징 차단 내역 화면
    page.goto(BASE + '/admin/abuse-cases', wait_until='networkidle')
    page.wait_for_timeout(1500)
    abuse_requests = [
        r for r in evidence['requests'] if r['path'].startswith('/v1/admin/abuse-cases')
    ]
    check(
        'AR01 목록 API 실측',
        requests=abuse_requests,
        all200=all(r['status'] == 200 for r in abuse_requests),
    )
    page.screenshot(path=str(IMAGES / 'list.png'), full_page=True)

    rows = page.locator('table tbody tr')
    row_count = rows.count()
    check('실데이터 행 렌더', rows=row_count, hasRows=row_count > 0)
    assert row_count > 0, '차단 이력 행이 없다 — 실측 대상 화면이 아님'

    first_text = rows.first.inner_text()
    check(
        '첫 행 표시 필드',
        # 행 텍스트에 닉네임·UUID·사유가 섞여 있어 원문은 커밋되는 증거에 남기지 않는다
        text='첫 행 표시됨',
        hasReason='응모 요청 한도 초과' in first_text,
    )

    # 행 상세 버튼 → AR02 드로어 — evidence 필드가 실데이터로 그려지는지
    detail_button = page.get_by_role('button', name=re.compile('차단 상세')).first
    detail_button.click()
    page.wait_for_timeout(2000)
    drawer = page.locator('[role="dialog"]').first
    drawer.wait_for()
    drawer_text = drawer.inner_text()
    evidence_fields = {
        '규칙 버전': '규칙 버전' in drawer_text,
        '기준 범위': '기준' in drawer_text,
        '집계 구간': '집계 구간' in drawer_text,
        '요청 허용 한도': '요청 허용 한도' in drawer_text,
        '관측 거절 횟수': '관측 거절 횟수' in drawer_text,
        '차단 기준 횟수': '차단 기준 횟수' in drawer_text,
    }
    check('AR02 드로어 evidence 필드', fields=evidence_fields)
    detail_requests = [
        r for r in evidence['requests'] if re.fullmatch(r'/v1/admin/abuse-cases/[^/?]+', r['path'])
    ]
    check('AR02 상세 API 실측', requests=detail_requests)
    page.screenshot(path=str(IMAGES / 'drawer.png'), full_page=True)
    page.keyboard.press('Escape')
    page.wait_for_timeout(500)

    # userId 필터 — 첫 행의 차단 사용자를 고르기 위해 목록 응답을 API로 한 번 더 본다
    # (화면 필터 입력은 UUID를 요구한다 — 표시 닉네임이 아니라 userId)
    import urllib.parse

    req = urllib.request.Request(
        f'{BASE}/api/v1/admin/abuse-cases?page=1&size=1',
        headers={'X-User-ID': ADMIN['id'], 'X-User-Role': 'ADMIN'},
    )
    first_user = json.loads(urllib.request.urlopen(req, timeout=20).read())['data']['items'][0][
        'userId'
    ]
    before_rows = row_count
    page.get_by_placeholder('사용자 ID 검색').fill(first_user)
    page.get_by_role('button', name='검색', exact=True).click()
    page.wait_for_timeout(1500)
    filtered_rows = page.locator('table tbody tr').count()
    # 행 수만 보면 다른 사용자 행도 성공으로 기록될 수 있다 — 필터된 API 결과의
    # userId를 메모리에서 대조하고, 화면 행 수가 API 결과 수와 같은지도 함께 본다.
    # UUID 자체는 증거에 남기지 않고 일치 여부만 기록한다.
    filtered_res = json.loads(
        urllib.request.urlopen(
            urllib.request.Request(
                f'{BASE}/api/v1/admin/abuse-cases?page=1&size=50&userId={first_user}',
                headers={'X-User-ID': ADMIN['id'], 'X-User-Role': 'ADMIN'},
            ),
            timeout=20,
        ).read()
    )
    filtered_items = filtered_res['data']['items']
    user_ids_match = bool(filtered_items) and all(
        i['userId'] == first_user for i in filtered_items
    )
    check(
        'userId 필터 적용',
        before=before_rows,
        after=filtered_rows,
        narrowed=0 < filtered_rows <= before_rows,
        user_ids_match=user_ids_match,
        row_count_match=filtered_rows == len(filtered_items),
    )
    assert user_ids_match and filtered_rows == len(
        filtered_items
    ), 'userId 필터 결과가 다른 사용자를 포함하거나 화면 행 수와 다르다'
    page.screenshot(path=str(IMAGES / 'filtered.png'), full_page=True)
    page.get_by_role('button', name='초기화').click()
    page.wait_for_timeout(1200)
    check('필터 초기화 복귀', rows=page.locator('table tbody tr').count())

    # 320px 가로 넘침 검사 — DateRangeFilter를 쓰는 다른 관리자 화면도 함께 본다
    page.set_viewport_size({'width': 320, 'height': 800})
    for path in ('/admin/events', '/admin/abuse-cases'):
        page.goto(BASE + path, wait_until='networkidle')
        page.wait_for_timeout(1200)
        overflow = page.evaluate(
            'document.documentElement.scrollWidth - document.documentElement.clientWidth'
        )
        check(f'320px 가로 넘침 {path}', overflowPx=overflow, ok=overflow <= 0)
    page.screenshot(path=str(IMAGES / 'w320.png'), full_page=True)

    browser.close()

check('콘솔 오류', count=len(evidence['errors']), errors=evidence['errors'])
print(f"\n증거 기록: {OUTPUT} ({len(evidence['checks'])} checks, {len(evidence['requests'])} requests)")
