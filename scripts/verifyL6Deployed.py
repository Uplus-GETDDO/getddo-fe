"""L6 배포 후 검증 — 실제 배포(https://getddo-fe.vercel.app) 대상.

verifyL6Browser.py와 달리 빌드·프록시를 만들지 않고 배포를 그대로 관측한다:
  1) 신규 세션 Service Worker 0건
  2) 기존 설치 재현 — mockServiceWorker.js만 자동 해제, 다른 Worker는 유지
  3) 로그인 계정 목록 = 배포 번들에 구워진 VITE_VIRTUAL_USERS_JSON
  4) 계정 선택→홈→이벤트 상세의 실제 Network 응답·업무 ID, /virtual-users 0건
  5) A→B 전환 헤더 격리, 새로고침 세션 유지, 가상 시계 비노출, 320/390px
  6) 200% 확대 — CSS 뷰포트 640px + DPR 2 (1280 창의 실제 200% 확대와 레이아웃 동등.
     body.zoom 근사 측정이 아닌 뷰포트 조건 자체를 바꿔 측정한다)
  7) 오프라인→재연결 복구, 키보드 탭 순회

환경변수: L6_DEPLOY_URL(기본 https://getddo-fe.vercel.app)
결과는 reports/20261021-L6-deploy-evidence.json + reports/L6-deploy-evidence/*.png
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
IMAGES = Path('reports/L6-deploy-evidence')
IMAGES.mkdir(parents=True, exist_ok=True)
OUTPUT = Path('reports/20261021-L6-deploy-evidence.json')
COMMIT = subprocess.run(
    ['git', 'rev-parse', 'HEAD'],
    capture_output=True,
    text=True,
    encoding='utf-8',
    errors='replace',
).stdout.strip()
evidence = {
    'kind': 'Vercel 배포(getddo-fe.vercel.app) 실측 — 빌드·프록시 없음',
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
assert len(USERS) >= 2
USER_A = next(u for u in USERS if u['role'] == 'USER')
USER_B = next(u for u in USERS if u['role'] == 'USER' and u['id'] != USER_A['id'])
ADMIN = next((u for u in USERS if u['role'] == 'ADMIN'), None)
evidence['bakedUsers'] = USERS
check('배포 번들 env의 계정 JSON', users=len(USERS), roles=[u['role'] for u in USERS])

def record_response(response):
    request = response.request
    if '/api/' not in request.url:
        return
    path = request.url.split('/api', 1)[1].split('?')[0]
    entry = {
        'method': request.method,
        'path': path,
        'status': response.status,
        'x-user-id': request.headers.get('x-user-id'),
        'x-user-role': request.headers.get('x-user-role'),
    }
    if request.method == 'GET' and path.startswith('/v1/events') and response.status == 200:
        try:
            body = response.json()
            items = body.get('data', {}).get('items')
            if items:
                entry['firstEventId'] = items[0]['id']
            elif body.get('data', {}).get('id'):
                entry['eventId'] = body['data']['id']
        except (ValueError, AttributeError):
            pass
    evidence['requests'].append(entry)
    save()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = context.new_page()
    page.set_default_timeout(20000)
    page.on('pageerror', lambda e: evidence['errors'].append(str(e)))
    page.on('response', record_response)

    # 1) 신규 세션 — Worker 0건
    page.goto(BASE + '/', wait_until='networkidle')
    regs = page.evaluate('navigator.serviceWorker.getRegistrations().then(r=>r.map(w=>w.scope))')
    check('신규 세션 Worker 0건', registrations=regs)
    assert regs == [], f'Worker 잔존: {regs}'

    # 2) 로그인 계정 목록 = 번들 JSON, /virtual-users 미호출
    for user in USERS:
        page.get_by_text(user['name'], exact=False).first.wait_for()
    check('로그인 계정 목록 = 배포 JSON', users=len(USERS), listed=True)
    # 기록 경로는 /api 이후 접미사(/v1/...) — 제거 대상 /v1/virtual-users와 정확히 일치해야
    # /v1/admin/virtual-users 같은 관리자 엔드포인트를 오탐하지 않는다
    assert not any(r['path'] == '/v1/virtual-users' for r in evidence['requests'])
    page.screenshot(path=str(IMAGES / 'L6-deploy-login.png'), full_page=True)

    # 3) 기존 설치 재현 — 실제 /mockServiceWorker.js(구 목업 설치) + 다른 앱 Worker를 함께 등록한다.
    # "다른 앱 Worker"는 순수 데이터 청크(env-*.js)를 module 타입 Worker로 등록해 재현한다 —
    # 도메인에 JS MIME의 고전 스크립트가 mockServiceWorker.js뿐이라 module Worker가 유일한 대안이다.
    other_worker_url = f'/assets/{ENV_FILE}'
    page.evaluate("navigator.serviceWorker.register('/mockServiceWorker.js')")
    page.evaluate(
        f"navigator.serviceWorker.register('{other_worker_url}', {{type: 'module'}})")
    page.wait_for_timeout(1200)
    regs = page.evaluate(
        'navigator.serviceWorker.getRegistrations().then(r=>r.map(w=>w.active&&w.active.scriptURL))')
    assert len(regs) == 2, f'재현용 Worker 등록 실패: {regs}'
    page.goto(BASE + '/', wait_until='networkidle')
    page.wait_for_timeout(500)
    regs = page.evaluate(
        'navigator.serviceWorker.getRegistrations().then(r=>r.map(w=>w.active&&w.active.scriptURL))')
    check('mockServiceWorker.js만 자동 해제', after=regs)
    assert not any(u and 'mockServiceWorker' in u for u in regs), f'목업 Worker 잔존: {regs}'
    assert any(u and ENV_FILE in u for u in regs), f'다른 앱 Worker가 해제됐다: {regs}'
    page.evaluate(
        "navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()))")

    # 4) 계정 선택 → 홈 → 이벤트 상세 실서버 응답
    page.get_by_role('button', name=re.compile(re.escape(USER_A['name']))).first.click()
    page.wait_for_url(BASE + '/')
    page.wait_for_timeout(2000)
    a_requests = [r for r in evidence['requests'] if r['x-user-id'] == USER_A['id']]
    check('A 선택 후 실제 API + X-User-ID', requests=len(a_requests), sample=a_requests[:5])
    assert a_requests and all(r['status'] == 200 for r in a_requests), a_requests
    page.screenshot(path=str(IMAGES / 'L6-deploy-home.png'), full_page=True)

    event_link = page.locator('a[href*="/events/"]').first
    event_link.wait_for()
    href = event_link.get_attribute('href')
    before = len(evidence['requests'])
    event_link.click()
    page.wait_for_timeout(2000)
    detail = [r for r in evidence['requests'][before:] if r['x-user-id'] == USER_A['id']]
    check('이벤트 상세 실서버 응답', href=href, responses=detail)
    assert any(r['status'] == 200 for r in detail), detail
    page.screenshot(path=str(IMAGES / 'L6-deploy-event.png'), full_page=True)

    # 5) A→B 전환 — B 헤더 재조회, A 누수 0
    page.goto(BASE + '/', wait_until='networkidle')
    before = len(evidence['requests'])
    page.locator('header button').last.click()
    page.get_by_role('button', name=re.compile(re.escape(USER_B['name']))).first.click()
    page.wait_for_timeout(2000)
    b_requests = [r for r in evidence['requests'][before:] if r['x-user-id'] == USER_B['id']]
    leaked = [r for r in evidence['requests'][before:] if r['x-user-id'] == USER_A['id']]
    check('A→B 전환 캐시 리셋·재조회', bRequests=len(b_requests), leakedARequests=leaked)
    assert b_requests and not leaked
    page.get_by_text(USER_B['name'], exact=False).first.wait_for()

    page.reload(wait_until='networkidle')
    page.get_by_text(USER_B['name'], exact=False).first.wait_for()
    check('새로고침 후 세션 유지', user=USER_B['name'], kept=True)

    # 사용자 읽기 페이지 — 응모권·알림·이벤트 목록의 실서버 GET만 기록한다
    for route in ['/my-tickets', '/my-entries', '/my-notifications', '/events', '/missions', '/time-raffle']:
        before = len(evidence['requests'])
        page.goto(BASE + route, wait_until='networkidle')
        page.wait_for_timeout(1200)
        page_gets = [
            {'method': r['method'], 'path': r['path'], 'status': r['status']}
            for r in evidence['requests'][before:]
            if r['x-user-id'] == USER_B['id']]
        check(f'사용자 페이지 {route}', responses=page_gets[:10])

    # 6) 가상 시계 비노출 + admin 라우트·메뉴
    ticker = page.locator('header [title="가상 시계"], header :text("가상 시계")').count()
    check('헤더 가상 시계 비노출', count=ticker)
    assert ticker == 0

    if ADMIN:
        page.evaluate(
            'localStorage.setItem("getddo-session",'
            + json.dumps(json.dumps({'state': {'user': ADMIN}, 'version': 0}, ensure_ascii=False))
            + ');')
        page.goto(BASE + '/admin/virtual-clock', wait_until='networkidle')
        page.get_by_text('찾을 수 없', exact=False).first.wait_for()
        nav_clock = page.get_by_role('link', name='가상 시계', exact=True).count()
        check('admin 가상 시계 라우트·메뉴 비노출', navItems=nav_clock)
        assert nav_clock == 0
        # 관리자 읽기 전용 — 각 페이지의 실서버 GET 응답만 기록한다 (쓰기는 실행하지 않는다)
        before = len(evidence['requests'])
        page.goto(BASE + '/admin', wait_until='networkidle')
        page.wait_for_timeout(1500)
        admin_gets = [
            r for r in evidence['requests'][before:]
            if r['x-user-id'] == ADMIN['id'] and r['method'] == 'GET']
        check('관리자 대시보드 실서버 GET', responses=admin_gets[:8])
        page.screenshot(path=str(IMAGES / 'L6-deploy-admin.png'), full_page=True)

        for route in [
            '/admin/events', '/admin/draw', '/admin/abuse-cases', '/admin/users',
            '/admin/entries', '/admin/tickets', '/admin/notifications',
            '/admin/banners', '/admin/attendance-policies', '/admin/missions',
            '/admin/virtual-users',
        ]:
            before = len(evidence['requests'])
            page.goto(BASE + route, wait_until='networkidle')
            page.wait_for_timeout(1200)
            page_gets = [
                {'method': r['method'], 'path': r['path'], 'status': r['status']}
                for r in evidence['requests'][before:]
                if r['x-user-id'] == ADMIN['id']]
            check(f'관리자 페이지 {route}', responses=page_gets[:10])

    # 7) 반응형 320/390px
    page.evaluate('localStorage.removeItem("getddo-session")')
    page.evaluate(
        'localStorage.setItem("getddo-session",'
        + json.dumps(json.dumps({'state': {'user': USER_A}, 'version': 0}, ensure_ascii=False))
        + ');')
    for width in [320, 390]:
        page.set_viewport_size({'width': width, 'height': 900})
        page.goto(BASE + '/', wait_until='networkidle')
        overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
        check(f'반응형 {width}px', horizontalOverflow=overflow)
        assert not overflow
        page.screenshot(path=str(IMAGES / f'L6-deploy-home-{width}.png'), full_page=True)

    # 8) 키보드 탭 순회
    page.set_viewport_size({'width': 1280, 'height': 900})
    page.goto(BASE + '/', wait_until='networkidle')
    focus_tags = []
    for _ in range(12):
        page.keyboard.press('Tab')
        focus_tags.append(page.locator(':focus').evaluate('(el)=>el.tagName'))
    check('키보드 탭 순회', focusTrail=focus_tags)

    # 9) 오프라인→재연결 — 읽기 화면의 실패 표시와 복구를 관측한다(강제 통과 조건 아님)
    context.set_offline(True)
    offline_nav_error = None
    try:
        page.reload(wait_until='domcontentloaded')
    except Exception as error:  # 오프라인 내비게이션 실패 자체가 관측 대상이다
        offline_nav_error = str(error).split('Call log')[0].strip()
    page.wait_for_timeout(2000)
    offline_body = page.locator('body').inner_text()[:300]
    context.set_offline(False)
    page.reload(wait_until='networkidle')
    page.wait_for_timeout(1000)
    # 복구 판정은 렌더된 앱 내용으로 한다 — offline 오류 페이지도 scrollWidth>0이므로 무의미하다
    try:
        page.get_by_text(USER_A['name'], exact=False).first.wait_for(timeout=5000)
        recovered = True
    except Exception:
        recovered = False
    check('오프라인→재연결', offlineNavError=offline_nav_error,
          offlinePreview=offline_body, recoveredAfterOnline=recovered)
    page.screenshot(path=str(IMAGES / 'L6-deploy-online-recovered.png'), full_page=True)

    browser.close()

    # 10) 200% 확대 — 뷰포트 640 CSS px + DPR 2 = 1280 창의 실제 200% 확대와 동등한 레이아웃 조건
    browser = p.chromium.launch(headless=True)
    zcontext = browser.new_context(viewport={'width': 640, 'height': 450}, device_scale_factor=2)
    zpage = zcontext.new_page()
    zpage.set_default_timeout(20000)
    zpage.evaluate('void 0')
    zpage.goto(BASE + '/', wait_until='networkidle')
    for user in USERS:
        zpage.get_by_text(user['name'], exact=False).first.wait_for(timeout=5000)
    zpage.get_by_role('button', name=re.compile(re.escape(USER_A['name']))).first.click()
    zpage.wait_for_url(BASE + '/')
    zpage.wait_for_timeout(2000)
    metrics = zpage.evaluate(
        '({innerWidth, dpr: devicePixelRatio, overflow: document.documentElement.scrollWidth > innerWidth,'
        ' scrollWidth: document.documentElement.scrollWidth})')
    check('200% 확대 실측(640 CSS px·DPR 2)', **metrics)
    zpage.screenshot(path=str(IMAGES / 'L6-deploy-zoom200.png'), full_page=True)
    browser.close()

# 전체 방문이 끝난 뒤 /v1/virtual-users 호출이 한 번도 없었는지 최종 확인한다
# (응답 기록은 page.on('response') 바인딩 구간 — zpage는 기록 대상이 아니다)
assert not any(r['path'] == '/v1/virtual-users' for r in evidence['requests'])
check('/virtual-users 미호출(기록된 전 요청)', ok=True)

save()
print(json.dumps({'checks': len(evidence['checks']), 'requests': len(evidence['requests']), 'errors': evidence['errors']}, ensure_ascii=False))
