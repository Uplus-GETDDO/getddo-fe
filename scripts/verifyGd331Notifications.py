"""GD-331 알림 통합 관측 — 배포본 대상 읽기 관측 + N02 읽음 1건(승인분).

관측 범위 (spec 05-api/notification.md N01~N03, FE entities/notification):
  1) N01 API 읽기 — 커서 페이징(nextCursor 추적)·isRead 필터·totalElements·정렬
  2) 드로어 UI — 미읽음 배지·"읽지 않음 N개" 문구·목록 렌더
  3) N02 쓰기 1건 — linkUrl 있는 미읽음 알림 클릭 → PUT read 200 → 내부 경로 이동
     → 미읽음 배지 감소 (사용자 승인 범위: 정확히 1건)
  4) /my-notifications — 번호 페이징(2쪽 커서 추적)·"읽지 않음" 필터 전환
  5) 빈 목록 — 알림 0건인 ADMIN 계정의 사용자 화면 접근(UserGuard는 로그인만 본다)

재개 안전: 증거 파일이 이미 있으면 기록된 부분을 건너뛰고 남은 관측만 이어서 한다 —
N02 쓰기는 증거에 PUT이 기록돼 있으면 다시 보내지 않는다(승인 1건 초과 방지).

트리거 연동(발표→알림 도착)은 서버 이벤트가 필요해 관측하지 않는다.
증거에는 알림 id·eventId·제목 원문을 남기지 않고 개수·불린·경로 패턴만 기록한다.

환경변수: L6_DEPLOY_URL(기본 https://getddo-fe.vercel.app)
"""
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get('L6_DEPLOY_URL', 'https://getddo-fe.vercel.app').rstrip('/')
OUTPUT = Path('reports/20261024-gd331-notifications.json')
IMAGES = Path('reports/gd331-notifications')
IMAGES.mkdir(parents=True, exist_ok=True)
COMMIT = subprocess.run(
    ['git', 'rev-parse', 'HEAD'],
    capture_output=True,
    text=True,
    encoding='utf-8',
    errors='replace',
).stdout.strip()
UUID = re.compile(r'[0-9a-f]{8}-[0-9a-f-]{27}', re.I)

evidence = {
    'kind': 'GD-331 알림 통합 관측 — 배포본 읽기 + N02 1건',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'verifierCommit': COMMIT,
    'url': BASE,
    'apiChecks': [],
    'requests': [],
    'puts': [],
    'checks': [],
    'errors': [],
}
# 재개 — 기존 증거가 있으면 이어 쓴다. 다시 기록하는 하위 체크는 제거해 중복을 막는다
if OUTPUT.exists():
    evidence.update(json.loads(OUTPUT.read_text(encoding='utf-8')))
    RERUN = {
        '알림 페이지 1쪽 렌더',
        '알림 페이지 2쪽 — 커서 추적',
        '알림 페이지 2쪽 커서 추적',
        '읽지 않음 필터 전환',
        'ADMIN 빈 목록 상태',
        '콘솔 오류',
    }
    evidence['checks'] = [c for c in evidence['checks'] if c['name'] not in RERUN]


def save():
    OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')


def check(name, **fields):
    evidence['checks'].append({'name': name, **fields})
    save()
    print(f"check: {name} {fields}")


def api_check(name, **fields):
    evidence['apiChecks'].append({'name': name, **fields})
    save()
    print(f"api: {name} {fields}")


def fetch(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8')


html = fetch(BASE + '/')
env_chunk = re.search(r'/assets/(env-[^"]+\.js)', html)
assert env_chunk, 'env 청크를 찾지 못했다'
entry_chunk = re.search(r'/assets/(index-[^"]+\.js)', html)
evidence['entryChunk'] = entry_chunk.group(1) if entry_chunk else None
env_src = fetch(f'{BASE}/assets/{env_chunk.group(1)}')
USERS = json.loads(re.search(r'virtualUsersJson:`(.*?)`', env_src, re.S).group(1))
ADMIN = next((u for u in USERS if u['role'] == 'ADMIN'), None)
USER1 = next(u for u in USERS if u['role'] == 'USER')
assert ADMIN and USER1


def api_get(path, u):
    return json.loads(
        fetch(f'{BASE}/api{path}', {'X-User-ID': u['id'], 'X-User-Role': u['role']})
    )


def mask_path(url):
    return UUID.sub('{id}', url.split('/api', 1)[1])


# ---------- A. N01 API 읽기 관측 (GET만, 미실행 시에만) ----------
api_done = any(c['name'] == 'N01 isRead 필터' for c in evidence['apiChecks'])
if api_done:
    baseline_unread = next(
        c for c in evidence['apiChecks'] if c['name'] == 'N01 isRead 필터'
    )['unread']
else:
    # 커서 추적 — size=5로 여러 쪽을 걸어 nextCursor 계약을 본다
    walked = []
    all_items = []
    cursor = None
    total = None
    first_env = None
    for page_no in range(1, 11):
        q = f'&cursor={cursor}' if cursor else ''
        payload = api_get(f'/v1/notifications/me?size=5{q}', USER1)
        if first_env is None:
            first_env = payload
        data = payload['data']
        walked.append(
            {
                'page': page_no,
                'items': len(data['items']),
                'hasNext': bool(data.get('nextCursor')),
            }
        )
        all_items.extend(data['items'])
        total = data['totalElements']
        cursor = data.get('nextCursor')
        if not cursor:
            break
    ordered = all(
        all_items[i]['createdAt'] >= all_items[i + 1]['createdAt']
        for i in range(len(all_items) - 1)
    )
    api_check(
        'N01 커서 페이징 추적 (size=5)',
        pages=walked,
        totalItems=len(all_items),
        totalElements=total,
        orderingDesc=ordered,
        idsUnique=len({n['id'] for n in all_items}) == len(all_items),
        envelope={
            'success': first_env.get('success'),
            'code': first_env.get('code'),
            'message': first_env.get('message'),
        },
    )

    unread = api_get('/v1/notifications/me?size=1&isRead=false', USER1)['data']
    read = api_get('/v1/notifications/me?size=1&isRead=true', USER1)['data']
    api_check(
        'N01 isRead 필터',
        total=total,
        unread=unread['totalElements'],
        read=read['totalElements'],
        sumMatches=unread['totalElements'] + read['totalElements'] == total,
        unreadItemsAllUnread=all(
            not n['isRead']
            for n in api_get('/v1/notifications/me?size=20&isRead=false', USER1)['data'][
                'items'
            ]
        ),
    )
    baseline_unread = unread['totalElements']

    admin_notifs = api_get('/v1/notifications/me?size=1', ADMIN)['data']
    api_check(
        'N01 ADMIN 빈 목록',
        total=admin_notifs['totalElements'],
        nextCursorNull=not admin_notifs.get('nextCursor'),
    )


# ---------- B~D. 브라우저 관측 ----------
def record_response(response):
    request = response.request
    if '/api/' not in request.url:
        return
    path = mask_path(request.url)
    if '/v1/notifications' not in path:
        return
    if request.method == 'PUT':
        body = None
        try:
            body = response.json()
        except Exception:
            pass
        evidence['puts'].append(
            {
                'method': 'PUT',
                'path': path.split('?')[0],
                'status': response.status,
                'envelope': {
                    'success': (body or {}).get('success'),
                    'code': (body or {}).get('code'),
                },
                'dataIsRead': ((body or {}).get('data') or {}).get('isRead'),
            }
        )
    else:
        raw_query = urllib.parse.urlparse(request.url).query
        query = {
            k: ('<cursor>' if k == 'cursor' else v)
            for k, v in urllib.parse.parse_qsl(raw_query)
        }
        evidence['requests'].append(
            {
                'method': request.method,
                'path': path.split('?')[0],
                'query': query,
                'status': response.status,
            }
        )
    save()


def login(page, user):
    page.goto(BASE + '/', wait_until='networkidle')
    page.get_by_role('button', name=re.compile(re.escape(user['name']))).first.click()
    page.wait_for_url(BASE + '/', timeout=20000)
    page.wait_for_timeout(1500)


def attach_observers(page):
    page.set_default_timeout(20000)
    page.on('pageerror', lambda e: evidence['errors'].append(str(e)))
    page.on(
        'console',
        lambda m: evidence['errors'].append(f'console.error: {m.text}')
        if m.type == 'error'
        else None,
    )
    page.on('response', record_response)


n02_done = bool(evidence['puts'])
# N02 클릭 후 미읽음 기대값 — 쓰기를 이미 소비한 재개라면 기록된 기준선에서 1 뺀다
expected_unread_after = baseline_unread - 1 if n02_done else baseline_unread

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = ctx.new_page()
    attach_observers(page)
    login(page, USER1)

    # --- B. 드로어 + N02 클릭 (승인 1건 — 이미 기록됐으면 건너뛴다) ---
    if not n02_done:
        bell = page.get_by_role('button', name=re.compile('^알림'))
        check(
            '드로어 벨 미읽음 배지',
            ariaLabel=bell.get_attribute('aria-label'),
            expectedUnread=baseline_unread,
        )
        bell.click()
        page.wait_for_timeout(1500)
        drawer = page.locator('[role="dialog"]').first
        drawer_text = drawer.inner_text()
        check(
            '드로어 열림·미읽음 문구',
            unreadText=f'읽지 않음 {baseline_unread}개' in drawer_text,
            hasMarkAll='모두 읽음' in drawer_text,
        )
        list_gets = [
            r
            for r in evidence['requests']
            if r['path'] == '/v1/notifications/me' and r['method'] == 'GET'
        ]
        check(
            '드로어 N01 호출',
            calls=[{'query': r['query'], 'status': r['status']} for r in list_gets],
            all200=all(r['status'] == 200 for r in list_gets),
        )
        page.screenshot(path=str(IMAGES / 'drawer.png'), full_page=True)

        # N02 — 첫 미읽음 알림(linkUrl 보유) 클릭: 읽음 PUT + linkUrl 이동을 함께 본다
        drawer.locator('div.group button').first.click()
        page.wait_for_timeout(2000)
        check(
            'N02 읽음 PUT 응답',
            puts=evidence['puts'],
            count=len(evidence['puts']),
            ok=len(evidence['puts']) == 1
            and evidence['puts'][0]['status'] == 200
            and evidence['puts'][0]['dataIsRead'] is True,
        )
        landed = page.url.replace(BASE, '')
        check(
            'linkUrl 내부 이동',
            landedPattern=UUID.sub('{id}', landed),
            navigated=landed != '/',
        )
        page.screenshot(path=str(IMAGES / 'after-click.png'), full_page=True)

        # 무효화 후 미읽음 배지가 1 감소하는지 — 벨 라벨로 확인
        page.wait_for_timeout(2000)
        bell2 = page.get_by_role('button', name=re.compile('^알림'))
        check(
            '읽음 후 미읽음 델타',
            ariaLabel=bell2.get_attribute('aria-label'),
            expectedUnread=baseline_unread - 1,
        )

    # --- C. /my-notifications 페이징·필터 (읽기만) ---
    page.goto(BASE + '/my-notifications', wait_until='networkidle')
    page.wait_for_timeout(1500)
    body = page.locator('section[aria-label="알림 목록"]')
    page_items = body.locator('div.group').count()
    has_p2 = body.get_by_role('button', name='2페이지').count() > 0
    check('알림 페이지 1쪽 렌더', items=page_items, hasPagination=has_p2)
    page.screenshot(path=str(IMAGES / 'my-notifications-p1.png'), full_page=True)

    if has_p2:
        body.get_by_role('button', name='2페이지').click()
        page.wait_for_timeout(1500)
        p2_items = body.locator('div.group').count()
        cursor_gets = [
            r
            for r in evidence['requests']
            if 'cursor' in r['query'] and r['path'] == '/v1/notifications/me'
        ]
        check(
            '알림 페이지 2쪽 커서 추적',
            items=p2_items,
            cursorRequests=[{'status': r['status']} for r in cursor_gets],
            cursorUsed=len(cursor_gets) > 0,
        )
        page.screenshot(path=str(IMAGES / 'my-notifications-p2.png'), full_page=True)

    body.get_by_role('button', name='읽지 않음', exact=True).click()
    page.wait_for_timeout(1500)
    filtered = [
        r
        for r in evidence['requests']
        if r['path'] == '/v1/notifications/me' and r['query'].get('isRead') == 'false'
    ]
    check(
        '읽지 않음 필터 전환',
        isReadFalseCalls=len(filtered),
        shownItems=body.locator('div.group').count(),
        expectedUnread=expected_unread_after,
    )
    page.screenshot(path=str(IMAGES / 'my-notifications-unread.png'), full_page=True)
    ctx.close()

    # --- D. ADMIN 계정 빈 목록 ---
    ctx2 = browser.new_context(viewport={'width': 1280, 'height': 900})
    page2 = ctx2.new_page()
    attach_observers(page2)
    login(page2, ADMIN)
    page2.goto(BASE + '/my-notifications', wait_until='networkidle')
    page2.wait_for_timeout(1500)
    page_text = page2.locator('section[aria-label="알림 목록"]').inner_text()
    check(
        'ADMIN 빈 목록 상태',
        emptyText='새 알림이 없어요' in page_text,
        allReadText='모두 읽었어요' in page_text,
    )
    page2.screenshot(path=str(IMAGES / 'admin-empty.png'), full_page=True)
    ctx2.close()

    browser.close()

check('콘솔 오류', count=len(evidence['errors']), errors=evidence['errors'])
print(
    f"\n증거 기록: {OUTPUT} ({len(evidence['checks'])} checks, "
    f"{len(evidence['apiChecks'])} api, {len(evidence['puts'])} puts)"
)
