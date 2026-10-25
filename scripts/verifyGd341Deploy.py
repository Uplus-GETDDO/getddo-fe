"""GD-341 배포본 재검증 — GD-295 미션 모달 + 미션 제출 플로우 + 모바일 미검증 화면.

관측 범위 (배포본 https://getddo-fe.vercel.app):
  1) 관리자 /admin/missions — MissionDetailDialog(GD-295) 오픈/닫기·aria·ESC·포커스 복귀
  2) 사용자 /missions/{id} 퀴즈 — 503 COMMON-007 모킹 시 안내 문구 표시·멱등키 유지,
     이후 실제 제출 1건(승인분 — 정확히 1회)
  3) 모바일 375px — 미실측 사용자 화면 가로 넘침·터치 대상·콘솔 오류·스크린샷

쓰기: POST /v1/missions/{id}/submissions 정확히 1회 (나머지 제출은 503 모킹으로 흡수).
증거에는 제목·답변 원문을 남기지 않고 개수·불린·경로 패턴만 기록한다.

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
OUTPUT = Path('reports/20261024-gd341-deploy-verification.json')
IMAGES = Path('reports/gd341')
IMAGES.mkdir(parents=True, exist_ok=True)
COMMIT = subprocess.run(
    ['git', 'rev-parse', 'HEAD'], capture_output=True, text=True, encoding='utf-8', errors='replace'
).stdout.strip()

evidence = {
    'kind': 'GD-341 배포본 재검증 — 미션 모달·제출 플로우·모바일 사용자 화면',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'verifierCommit': COMMIT,
    'url': BASE,
    'posts': [],
    'checks': [],
    'errors': [],
}
if OUTPUT.exists():
    evidence.update(json.loads(OUTPUT.read_text(encoding='utf-8')))


def save():
    OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')


def check(name, **fields):
    evidence['checks'].append({'name': name, **fields})
    print(f"check: {name} {fields}")
    save()


def fetch(url, headers=None):
    return (
        urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=30)
        .read()
        .decode('utf-8')
    )


html = fetch(BASE + '/')
env_chunk = re.search(r'/assets/(env-[^"]+\.js)', html)
entry_chunk = re.search(r'/assets/(index-[^"]+\.js)', html)
evidence['entryChunk'] = entry_chunk.group(1) if entry_chunk else None
env_src = fetch(f'{BASE}/assets/{env_chunk.group(1)}')
USERS = json.loads(re.search(r'virtualUsersJson:`(.*?)`', env_src, re.S).group(1))
ADMIN = next(u for u in USERS if u['role'] == 'ADMIN')
USER1 = next(u for u in USERS if u['name'] == '테스트사용자1')


def api_get(path, u):
    return json.loads(
        fetch(
            f'{BASE}/api{path}',
            {
                'X-User-ID': u['id'],
                'X-User-Role': u['role'],
                'X-User-Membership': u.get('membership', 'excellent'),
            },
        )
    )


# --- 표본 선택 ---
missions = api_get('/v1/missions?size=50', USER1)['data']['items']
quiz = next(
    (m for m in missions if m['missionType'] == 'QUIZ' and not m.get('completed')), None
)
assert quiz, '제출 가능한 QUIZ 미션 표본이 없다'
QUIZ_ID = quiz['id']
events = api_get('/v1/events?size=5', USER1)['data']['items']
EVENT_ID = events[0]['id'] if events else None
games = api_get('/v1/games', USER1)['data']
GAME_ID = games[0]['id'] if isinstance(games, list) and games else None
evidence['samples'] = {
    'quizMission': bool(quiz),
    'event': bool(EVENT_ID),
    'game': bool(GAME_ID),
    'missionsCount': len(missions),
}
save()


def login(page, user):
    page.goto(BASE + '/', wait_until='networkidle')
    page.get_by_role('button', name=re.compile(re.escape(user['name']))).first.click()
    page.wait_for_url(BASE + '/', timeout=20000)
    page.wait_for_timeout(1500)


def attach_observers(page, tag):
    page.set_default_timeout(20000)
    page.on('pageerror', lambda e: evidence['errors'].append(f'{tag}: {e}'))
    page.on(
        'console',
        lambda m: evidence['errors'].append(f'{tag} console.error: {m.text}')
        if m.type == 'error'
        else None,
    )


submission_status = []


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ============ A. 사용자 미션 제출 — 503 문구 + 멱등키 유지 + 실제 제출 1건 ============
    if not evidence['posts']:
        ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
        page = ctx.new_page()
        attach_observers(page, 'mission-submit')
        login(page, USER1)
        page.goto(f'{BASE}/missions/{QUIZ_ID}', wait_until='networkidle')
        page.wait_for_timeout(1000)

        keys = []
        mocking = {'on': True}

        def handle_submissions(route, req):
            keys.append(req.headers.get('idempotency-key'))
            if mocking['on']:
                route.fulfill(
                    status=503,
                    content_type='application/json',
                    body=json.dumps(
                        {
                            'success': False,
                            'code': 'COMMON-007',
                            'message': '일시적으로 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.',
                            'data': None,
                        }
                    ),
                )
            else:
                route.continue_()

        def record_response(resp):
            if '/submissions' in resp.url and resp.request.method == 'POST':
                submission_status.append(resp.status)
                evidence['posts'].append(
                    {'path': '/v1/missions/{id}/submissions', 'status': resp.status}
                )
                save()

        page.on('response', record_response)
        page.route('**/v1/missions/*/submissions', handle_submissions)

        # ① 503 모킹 제출 — 안내 문구 + 멱등키 k1 기록
        # OX 선택지는 라디오를 숨긴 label 타일 — 라벨을 클릭해 라디오를 토글한다
        page.locator('label', has=page.get_by_text('O', exact=True)).first.click()
        page.get_by_role('button', name=re.compile('제출')).last.click()
        page.wait_for_timeout(2500)
        toast_text = ''
        toast = page.locator('[data-sonner-toast]').last
        if toast.count():
            toast_text = toast.inner_text()
        alert_text = ''
        alert = page.locator('[role="alert"]').last
        if alert.count():
            alert_text = alert.inner_text()
        expected_msg = '일시적으로 요청을 처리할 수 없습니다'
        retry_shown = (
            page.get_by_role('button', name=re.compile('다시 확인')).count() > 0
        )
        check(
            '503 안내 문구 표시',
            toastHasMsg=expected_msg in toast_text,
            alertHasMsg=expected_msg in alert_text,
            retryButtonShown=retry_shown,
            k1Recorded=len(keys) == 1,
        )
        page.screenshot(path=str(IMAGES / 'mission-503.png'))

        # ② 모킹 해제 후 재시도 — 멱등키 k2 == k1 (5xx 키 유지, GD-335 기준)
        mocking['on'] = False
        if retry_shown:
            page.get_by_role('button', name=re.compile('다시 확인')).first.click()
        else:
            page.get_by_role('button', name=re.compile('제출')).last.click()
        page.wait_for_timeout(3500)
        real_posts = [s for s in submission_status]
        check(
            '실제 제출 1건',
            realPostStatuses=real_posts,
            totalAttempts=len(keys),
            sameKeyAcross503Retry=len(keys) >= 2 and keys[0] == keys[1],
        )
        page.screenshot(path=str(IMAGES / 'mission-submitted.png'))
        body_text = page.locator('body').inner_text()
        check(
            '제출 후 완료·보상 신호',
            completedSignal=('완료' in body_text) or ('응모권' in body_text),
            wrongAnswer='오답' in body_text,
        )
        ctx.close()
        save()
    else:
        check('실제 제출 1건', skipped='이미 증거에 기록됨 — 재실행 방지')

    # ============ B. 관리자 미션 모달 (GD-295) ============
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = ctx.new_page()
    attach_observers(page, 'admin-mission-dialog')
    login(page, ADMIN)
    page.goto(f'{BASE}/admin/missions', wait_until='networkidle')
    page.wait_for_timeout(1500)
    trigger = page.get_by_role('button', name=re.compile('상세$')).first
    trigger.click()
    page.wait_for_timeout(1200)
    dialog = page.locator('[role="dialog"]')
    has_dialog = dialog.count() > 0
    labelledby = dialog.first.get_attribute('aria-labelledby') if has_dialog else None
    describedby = dialog.first.get_attribute('aria-describedby') if has_dialog else None
    dtext = dialog.first.inner_text() if has_dialog else ''
    check(
        '미션 상세 모달 오픈',
        dialogPresent=has_dialog,
        ariaLabelledby=bool(labelledby),
        ariaDescribedby=bool(describedby),
        koreanStatus=any(s in dtext for s in ('진행 중', '예정', '종료')),
        titleShown='미션 상세' in dtext,
    )
    page.screenshot(path=str(IMAGES / 'admin-mission-dialog.png'))
    if has_dialog:
        page.keyboard.press('Escape')
        page.wait_for_timeout(800)
        esc_closed = page.locator('[role="dialog"]').count() == 0
        focused = page.evaluate(
            "document.activeElement && (document.activeElement.getAttribute('aria-label')||document.activeElement.textContent||'').slice(0,40)"
        )
        check('ESC 닫힘 + 포커스 복귀', escClosed=esc_closed, focusedAfter=focused)
        page.get_by_role('button', name=re.compile('상세$')).first.click()
        page.wait_for_timeout(800)
        dialog2 = page.locator('[role="dialog"]')
        close_btn = dialog2.locator('button').last
        if dialog2.count() and close_btn.count():
            close_btn.click()
            page.wait_for_timeout(600)
        check(
            '닫기 버튼으로 닫힘',
            reopened=dialog2.count() > 0,
            closed=page.locator('[role="dialog"]').count() == 0,
        )
    ctx.close()
    save()

    # ============ C. 모바일 375px 사용자 화면 ============
    mobile_pages = [
        ('/', 'home'),
        ('/events', 'events'),
        (f'/events/{EVENT_ID}', 'event-detail'),
        (f'/events/{EVENT_ID}/results', 'event-results'),
        ('/time-raffle', 'time-raffle'),
        (f'/time-raffle/{EVENT_ID}', 'time-raffle-detail'),
        ('/missions', 'missions'),
        (f'/missions/{QUIZ_ID}', 'mission-detail'),
        (f'/missions/games/{GAME_ID}', 'game-detail'),
        ('/my-tickets', 'my-tickets'),
        ('/my-entries', 'my-entries'),
        ('/my-notifications', 'my-notifications'),
        ('/mypage', 'mypage'),
    ]
    ctx = browser.new_context(
        viewport={'width': 375, 'height': 812}, has_touch=True, is_mobile=True
    )
    page = ctx.new_page()
    attach_observers(page, 'mobile-375')
    login(page, USER1)
    tap_check_done = any(c['name'] == '터치 탭 이동' for c in evidence['checks'])
    done_checks = {c['name'] for c in evidence['checks']}
    for path, slug in mobile_pages:
        if not path or 'None' in path:
            continue
        if any(n.startswith(f'mobile {slug}') for n in done_checks):
            continue
        try:
            page.goto(BASE + path, wait_until='networkidle', timeout=30000)
        except Exception as e:
            check(f'mobile {slug}', navError=str(e)[:120])
            continue
        page.wait_for_timeout(1200)
        m = page.evaluate(
            """() => {
                const el = document.scrollingElement;
                const overflow = el.scrollWidth - el.clientWidth;
                const sel = 'button, a[href], [role="button"], input, select, textarea, [role="tab"]';
                let small = 0;
                for (const n of document.querySelectorAll(sel)) {
                    const r = n.getBoundingClientRect();
                    if (r.width === 0 || r.height === 0) continue;
                    if (r.bottom < 0 || r.top > innerHeight) continue;
                    if (Math.min(r.width, r.height) < 24) small++;
                }
                return { overflow, smallCount: small, path: location.pathname };
            }"""
        )
        check(
            f'mobile {slug} ({path})',
            horizontalOverflowPx=m['overflow'],
            smallTapTargetsUnder24px=m['smallCount'],
        )
        page.screenshot(path=str(IMAGES / f'mobile-{slug}.png'), full_page=False)
        if not tap_check_done:
            nav_link = page.locator('nav a:visible, [role="navigation"] a:visible').first
            if nav_link.count():
                href = nav_link.get_attribute('href')
                nav_link.tap()
                page.wait_for_timeout(1500)
                check('터치 탭 이동', tappedHref=href, landed=page.url)
                tap_check_done = True
    ctx.close()
    browser.close()

save()
print('DONE checks=%d errors=%d posts=%d' % (
    len(evidence['checks']), len(evidence['errors']), len(evidence['posts'])))
