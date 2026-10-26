"""GD-352: PLATINUM 화면 표시 실측 — 배포본 Playwright 읽기.

T1에서 가상 USER 4명 전원 PLATINUM 보유가 확인됐으므로 화면 실측이 가능하다.
  - /my-tickets: PLATINUM 등급 타일·잔량 표시
  - /time-raffle: OPEN 가중치 이벤트 상세의 플래티넘 스테퍼/필 표시
  - /admin/tickets: 관리자 응모권 이력의 플래티넘 행 렌더

쓰기 0건 — 화면 조회만. 증거에는 계정 이름·이벤트 제목 원문을 남기지 않는다.
결과: reports/20261026-gd352-platinum-screen.json + reports/gd352-platinum/*.png

환경변수: L6_DEPLOY_URL(기본 https://getddo-fe.vercel.app)
"""
import json
import os
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get('L6_DEPLOY_URL', 'https://getddo-fe.vercel.app').rstrip('/')
OUTPUT = Path('reports/20261026-gd352-platinum-screen.json')
SHOTS = Path('reports/gd352-platinum')
SHOTS.mkdir(parents=True, exist_ok=True)


def fetch(url):
    with urllib.request.urlopen(url, timeout=20) as res:
        return res.read().decode('utf-8')


html = fetch(BASE + '/')
env_chunk = re.search(r'/assets/(env-[^"]+\.js)', html)
entry_chunk = re.search(r'/assets/(index-[^"]+\.js)', html)
if not env_chunk and entry_chunk:
    index_src = fetch(f'{BASE}/assets/{entry_chunk.group(1)}')
    env_chunk = re.search(r'assets/(env-[^"\'\],]+\.js)', index_src)
assert env_chunk, 'env 청크를 찾지 못했다'
env_src = fetch(f'{BASE}/assets/{env_chunk.group(1)}')
USERS = json.loads(re.search(r'virtualUsersJson:`(.*?)`', env_src, re.S).group(1))
ADMIN = next((u for u in USERS if u['role'] == 'ADMIN'), None)
USER_ACCOUNTS = [u for u in USERS if u['role'] == 'USER']
assert ADMIN and USER_ACCOUNTS, '배포 JSON에 ADMIN·USER 계정이 없다'
TARGET = USER_ACCOUNTS[0]

evidence = {
    'kind': 'GD-352 PLATINUM 화면 표시 실측 — 배포본 읽기',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
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


def login(page, user):
    page.goto(BASE + '/', wait_until='networkidle')
    page.get_by_role('button', name=re.compile(re.escape(user['name']))).first.click()
    page.wait_for_url(BASE + '/', timeout=20000)
    page.wait_for_timeout(1500)


def shot(page, name):
    path = SHOTS / f'{name}.png'
    page.screenshot(path=str(path), full_page=True)
    return str(path)


def platinum_text_count(page):
    return page.get_by_text('플래티넘').count()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # 1) /my-tickets — 플래티넘 등급 표시
    try:
        ctx = browser.new_context(viewport={'width': 390, 'height': 844})
        page = ctx.new_page()
        page.set_default_timeout(20000)
        page.on('pageerror', lambda e: evidence['errors'].append(f'my-tickets: {e}'))
        login(page, TARGET)
        page.goto(BASE + '/my-tickets', wait_until='domcontentloaded')
        page.wait_for_selector('text=/플래티넘|보유 응모권|응모권/', timeout=30000)
        page.wait_for_timeout(1500)
        n = platinum_text_count(page)
        check(
            '/my-tickets 플래티넘 표시',
            ok=n > 0,
            platinumLabelCount=n,
            screenshot=shot(page, 'my-tickets'),
        )
        ctx.close()
    except Exception as e:
        check('/my-tickets 플래티넘 표시', ok=False, reason=f'{type(e).__name__}: {e}')

    # 2) /time-raffle — 진행 중 가중치 이벤트 상세의 플래티넘 선택 UI
    try:
        ctx = browser.new_context(viewport={'width': 390, 'height': 844})
        page = ctx.new_page()
        page.set_default_timeout(20000)
        page.on('pageerror', lambda e: evidence['errors'].append(f'time-raffle: {e}'))
        login(page, TARGET)
        page.goto(BASE + '/time-raffle', wait_until='networkidle')
        page.wait_for_timeout(1500)
        links = page.locator('a[href*="/time-raffle/"]')
        found = False
        for i in range(min(links.count(), 10)):
            href = links.nth(i).get_attribute('href') or ''
            m = re.search(r'/time-raffle/([0-9a-f-]{36})', href)
            if not m:
                continue
            page.goto(BASE + href, wait_until='networkidle')
            page.wait_for_timeout(1200)
            n = platinum_text_count(page)
            if n > 0:
                check(
                    '/time-raffle 상세 플래티넘 표시',
                    ok=True,
                    platinumLabelCount=n,
                    screenshot=shot(page, 'time-raffle-detail'),
                )
                found = True
                break
        if not found:
            check('/time-raffle 상세 플래티넘 표시', ok=False, reason='플래티넘 표시 상세를 찾지 못했다')
        ctx.close()
    except Exception as e:
        check('/time-raffle 상세 플래티넘 표시', ok=False, reason=f'{type(e).__name__}: {e}')

    # 3) /admin/tickets — 관리자 응모권 이력 플래티넘 행
    try:
        ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
        page = ctx.new_page()
        page.set_default_timeout(20000)
        page.on('pageerror', lambda e: evidence['errors'].append(f'admin-tickets: {e}'))
        login(page, ADMIN)
        page.goto(BASE + '/admin/tickets', wait_until='networkidle')
        page.wait_for_timeout(1500)
        n = platinum_text_count(page)
        check(
            '/admin/tickets 플래티넘 행',
            ok=n > 0,
            platinumLabelCount=n,
            screenshot=shot(page, 'admin-tickets'),
        )
        ctx.close()
    except Exception as e:
        check('/admin/tickets 플래티넘 행', ok=False, reason=f'{type(e).__name__}: {e}')

    browser.close()

save()
print(f"\n증거 기록: {OUTPUT} ({len(evidence['checks'])} checks, errors={len(evidence['errors'])})")
