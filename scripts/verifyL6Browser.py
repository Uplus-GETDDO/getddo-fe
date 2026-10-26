"""L6 브라우저 검증 — VITE_ENABLE_MSW=false 프로덕션 빌드 + 실제 API 프록시.

사전 조건:
  L6_USERS_JSON — Vercel에 넣을 것과 같은 실제 등록 계정 JSON 배열(2명 이상, ADMIN 포함 권장)
  L6_API        — 기본 https://dzc8oneey9mmx.cloudfront.net/api
  L6_IMAGE_DIR  — 기본 docs/superpowers/plans/L6-evidence

두 번 빌드한다:
  1) 계정 JSON 설정 빌드 — 로그인 계정 목록, /virtual-users 미호출, Worker 해제, 사용자 전환 캐시 격리
  2) 계정 JSON 미설정 빌드 — 로그인 화면의 설정 안내 표시

결과는 docs/superpowers/plans/L6-browser-evidence.json에 남긴다. MSW·주입 응답은 쓰지 않는다 —
/virtual-users는 빌드에서 완전히 제거됐으므로 프록시도 필요 없다.
"""
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:5186'
BASE2 = 'http://127.0.0.1:5187'
API = os.environ.get('L6_API', 'https://dzc8oneey9mmx.cloudfront.net/api')
USERS = json.loads(os.environ['L6_USERS_JSON'])
assert len(USERS) >= 2, '사용자 전환 검증에 2명 이상 필요'
USER_A, USER_B = USERS[0], USERS[1]
IMAGES = Path(os.environ.get('L6_IMAGE_DIR', 'docs/superpowers/plans/L6-evidence'))
IMAGES.mkdir(parents=True, exist_ok=True)
OUTPUT = Path('docs/superpowers/plans/L6-browser-evidence.json')
COMMIT = subprocess.run(
    ['git', 'rev-parse', 'HEAD'],
    capture_output=True,
    text=True,
    encoding='utf-8',
    errors='replace',
).stdout.strip()
evidence = {
    'kind': 'VITE_ENABLE_MSW=false 프로덕션 빌드, 로컬 preview + 실제 API 프록시',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'commit': COMMIT,
    'api': API,
    'requests': [],
    'checks': [],
    'errors': [],
}

# shell=True 없이 실행 파일을 직접 해석한다 — POSIX는 인수가 소실되고 Windows는 자식이 잔존한다.
NPM = shutil.which('npm') or 'npm'
NPX = shutil.which('npx') or 'npx'


def save():
    OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')


def run_build(users_json):
    env = os.environ.copy()
    env['VITE_API_BASE_URL'] = '/api'
    env['VITE_ENABLE_MSW'] = 'false'
    if users_json is None:
        env.pop('VITE_VIRTUAL_USERS_JSON', None)
    else:
        env['VITE_VIRTUAL_USERS_JSON'] = users_json
    result = subprocess.run(
        [NPM, 'run', 'build'],
        env=env,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
    )
    if result.returncode != 0:
        print(result.stdout[-3000:], result.stderr[-3000:])
        sys.exit(1)


def wait_port(port, timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            socket.create_connection(('127.0.0.1', port), timeout=1).close()
            return
        except OSError:
            time.sleep(0.3)
    raise RuntimeError(f'preview port {port} not ready')


def start_preview(port):
    proc = subprocess.Popen(
        [NPX, 'vite', 'preview', '--port', str(port), '--strictPort', '--host', '127.0.0.1'],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    wait_port(port)
    return proc


def stop_preview(proc):
    # Windows는 부모만 죽이면 vite preview 자식이 남아 다음 실행의 strictPort를 점유한다.
    if os.name == 'nt':
        subprocess.run(
            ['taskkill', '/PID', str(proc.pid), '/T', '/F'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    else:
        proc.terminate()


API_CTX = None  # route.fetch 대신 APIRequestContext로 실서버를 호출한다 (일부 경로의 내부 오류 우회)


def proxy(route):
    request = route.request
    try:
        path = request.url.split('/api', 1)[1]
        headers = dict(request.headers)
        for name in ['origin', 'host', 'referer']:
            headers.pop(name, None)
        response = API_CTX.fetch(
            API + path,
            method=request.method,
            headers=headers,
            data=request.post_data_buffer if request.method != 'GET' else None,
            timeout=20000,
        )
        entry = {
            'method': request.method,
            'path': path,
            'status': response.status,
            'x-user-id': headers.get('x-user-id'),
            'x-user-role': headers.get('x-user-role'),
        }
        evidence['requests'].append(entry)
        if request.method == 'GET' and path.startswith('/v1/events') and response.status == 200:
            try:
                items = response.json()['data']['items']
                if items:
                    entry['firstEventId'] = items[0]['id']
            except (KeyError, IndexError, TypeError, ValueError):
                pass
        route.fulfill(status=response.status, body=response.body())
    except Exception as error:
        evidence['errors'].append(f'proxy {request.method} {request.url}: {error}')
        try:
            route.abort()
        except Exception:
            pass
    save()


SW_SOURCE = "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(clients.claim()));"

# ── 빌드 1: 실제 계정 JSON 설정 ──
print('build 1: configured')
run_build(json.dumps(USERS, ensure_ascii=False))
proc = start_preview(5186)
try:
    with sync_playwright() as p:
        API_CTX = p.request.new_context()
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 900})
        page = context.new_page()
        page.set_default_timeout(15000)
        page.on('pageerror', lambda e: evidence['errors'].append(str(e)))
        page.route(BASE + '/api/**', proxy)

        # 로그인 화면 — 설정된 계정만 표시, /virtual-users 요청이 없어야 한다
        page.goto(BASE + '/', wait_until='networkidle')
        for user in USERS:
            page.get_by_text(user['name'], exact=False).first.wait_for()
        evidence['checks'].append({'name': '로그인 계정 목록 = 설정 JSON', 'users': len(USERS), 'listed': True})
        assert not any(r['path'] == '/virtual-users' for r in evidence['requests']), '/virtual-users 호출 잔존'
        evidence['checks'].append({'name': '/virtual-users 미호출', 'ok': True})

        # 사용자 A 선택 → 실제 API
        page.get_by_role('button', name=re.compile(re.escape(USER_A['name']))).first.click()
        page.wait_for_url(BASE + '/')
        page.wait_for_timeout(1500)
        a_requests = [r for r in evidence['requests'] if r['x-user-id'] == USER_A['id']]
        evidence['checks'].append({'name': 'A 선택 후 실제 API + X-User-ID', 'requests': len(a_requests), 'sample': a_requests[:3]})
        assert a_requests, 'A의 실서버 요청이 없다'

        # 신규 세션 Worker 0 — 이 빌드는 mockServiceWorker를 등록하지 않는다
        regs = page.evaluate('navigator.serviceWorker.getRegistrations().then(r=>r.map(w=>w.scope))')
        evidence['checks'].append({'name': '신규 세션 Worker 없음', 'registrations': regs})
        assert regs == []

        # 기존 설치 브라우저 재현 — 가짜 mockServiceWorker.js를 등록한 뒤 재진입하면 앱이 해제한다
        page.route(BASE + '/mockServiceWorker.js', lambda r: r.fulfill(
            content_type='application/javascript', body=SW_SOURCE))
        page.evaluate("navigator.serviceWorker.register('/mockServiceWorker.js')")
        page.wait_for_timeout(500)
        regs = page.evaluate('navigator.serviceWorker.getRegistrations().then(r=>r.length)')
        assert regs == 1, '재현용 Worker 등록 실패'
        page.unroute(BASE + '/mockServiceWorker.js')
        page.goto(BASE + '/', wait_until='networkidle')
        regs = page.evaluate('navigator.serviceWorker.getRegistrations().then(r=>r.map(w=>w.active&&w.active.scriptURL))')
        evidence['checks'].append({'name': '기존 설치 Worker 자동 해제', 'after': regs})
        assert regs == [], f'Worker 잔존: {regs}'

        # 사용자 전환 — B의 헤더로 새 요청이 나가고 이전 사용자 캐시가 섞이지 않는다
        before = len(evidence['requests'])
        page.locator('header button').last.click()
        page.get_by_role('button', name=re.compile(re.escape(USER_B['name']))).first.click()
        page.wait_for_timeout(2000)
        b_requests = [r for r in evidence['requests'][before:] if r['x-user-id'] == USER_B['id']]
        leaked = [r for r in evidence['requests'][before:] if r['x-user-id'] == USER_A['id']]
        evidence['checks'].append({'name': 'A→B 전환 시 캐시 리셋·재조회', 'bRequests': len(b_requests), 'leakedARequests': leaked})
        assert b_requests, 'B의 재조회 요청이 없다'
        assert not leaked, '전환 후 A 헤더 요청 잔존'
        page.get_by_text(USER_B['name'], exact=False).first.wait_for()

        # 새로고침 — persist 세션으로 B 유지
        page.reload(wait_until='networkidle')
        page.get_by_text(USER_B['name'], exact=False).first.wait_for()
        evidence['checks'].append({'name': '새로고침 후 세션 유지', 'user': USER_B['name'], 'kept': True})

        # 가상 시계 비노출
        ticker = page.locator('header [title="가상 시계"], header :text("가상 시계")').count()
        evidence['checks'].append({'name': '헤더 가상 시계 비노출', 'count': ticker})
        assert ticker == 0

        # 관리자 계정이면 /admin/virtual-clock 404 확인
        admin = next((u for u in USERS if u['role'] == 'ADMIN'), None)
        if admin:
            page.evaluate(
                'localStorage.setItem("getddo-session",'
                + json.dumps(json.dumps({'state': {'user': admin}, 'version': 0}, ensure_ascii=False))
                + ');'
            )
            page.goto(BASE + '/admin/virtual-clock', wait_until='networkidle')
            page.get_by_text('찾을 수 없', exact=False).first.wait_for()
            nav_clock = page.get_by_role('link', name='가상 시계', exact=True).count()
            evidence['checks'].append({'name': 'admin 가상 시계 라우트·메뉴 비노출', 'navItems': nav_clock})
            assert nav_clock == 0
            page.goto(BASE + '/admin', wait_until='networkidle')
        else:
            evidence['checks'].append({'name': 'admin 가상 시계 라우트·메뉴 비노출', 'skipped': 'ADMIN 계정 없음'})

        # 반응형·확대 — 홈 기준 가로 스크롤 없음
        for width in [320, 390]:
            page.set_viewport_size({'width': width, 'height': 900})
            page.goto(BASE + '/', wait_until='networkidle')
            overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
            evidence['checks'].append({'name': f'반응형 {width}px', 'horizontalOverflow': overflow})
            assert not overflow
            page.screenshot(path=str(IMAGES / f'L6-home-{width}.png'), full_page=True)
        page.set_viewport_size({'width': 640, 'height': 900})
        page.evaluate('document.body.style.zoom = "200%"')
        overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
        evidence['checks'].append({'name': '200% 확대(640px)', 'horizontalOverflow': overflow})
        page.evaluate('document.body.style.zoom = "100%"')
        page.screenshot(path=str(IMAGES / 'L6-home-zoom200.png'), full_page=True)

        # 키보드 — 탭으로 헤더 사용자 전환 버튼까지 도달 가능한지
        page.set_viewport_size({'width': 1280, 'height': 900})
        page.goto(BASE + '/', wait_until='networkidle')
        focus_tags = []
        for _ in range(12):
            page.keyboard.press('Tab')
            focus_tags.append(page.locator(':focus').evaluate('(el)=>el.tagName'))
        evidence['checks'].append({'name': '키보드 탭 순회', 'focusTrail': focus_tags})
        save()
        browser.close()
finally:
    stop_preview(proc)

# ── 빌드 2: 계정 JSON 미설정 → 설정 안내 ──
print('build 2: missing config')
run_build(None)
proc = start_preview(5187)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(15000)
        page.goto(BASE2 + '/', wait_until='networkidle')
        page.get_by_text('VITE_VIRTUAL_USERS_JSON', exact=False).first.wait_for()
        evidence['checks'].append({'name': '미설정 시 명시 안내', 'shown': True})
        page.screenshot(path=str(IMAGES / 'L6-login-missing-config.png'), full_page=True)
        browser.close()
finally:
    stop_preview(proc)

save()
print(json.dumps({'checks': len(evidence['checks']), 'requests': len(evidence['requests']), 'errors': evidence['errors']}, ensure_ascii=False))
