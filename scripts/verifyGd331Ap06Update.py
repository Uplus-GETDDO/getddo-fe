"""GD-331 AP06 예약 연속 출석 정책 수정 200 실측 — 배포본 UI 경유.

미래 effectiveMonth(2026-11)로 예약된 연속 출석 정책 묶음을 관리자 수정
다이얼로그로 두 번 고친다:
  1) 28일 마일스톤 보상 7 → 8 (변경 PUT → 200·봉투·필드 대조)
  2) 8 → 7 (원복 PUT → 200 확인)
각 단계에서 PUT 응답을 Network에서 캡처해 상태·봉투·StreakPolicySet 필드를
대조하고, 화면의 '예약된 변경' 카드가 새 값을 반영하는지 확인한다.
마지막에 GET으로 원본과 동일한지 대조한다 — 원복이 완료돼야 성공이다.

실행 전 원본값은 GET으로 기록한다(.gd331-baseline.tmp.json 참조).
증거에는 정책 id·작성자 이름을 남기지 않고 마일스톤 값·불린만 기록한다.

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
OUTPUT = Path('reports/20261024-gd331-ap06-streak-update.json')
IMAGES = Path('reports/gd331-ap06')
IMAGES.mkdir(parents=True, exist_ok=True)
COMMIT = subprocess.run(
    ['git', 'rev-parse', 'HEAD'],
    capture_output=True,
    text=True,
    encoding='utf-8',
    errors='replace',
).stdout.strip()

evidence = {
    'kind': 'GD-331 AP06 예약 연속 출석 정책 수정 200 실측 — 배포본 UI 경유',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'verifierCommit': COMMIT,
    'url': BASE,
    'puts': [],
    'checks': [],
    'errors': [],
}


def save():
    OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')


def check(name, **fields):
    evidence['checks'].append({'name': name, **fields})
    save()
    print(f"check: {name} {fields}")


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
assert ADMIN, '배포 JSON에 ADMIN 계정이 없다'

STREAK_PUT = re.compile(r'/api/v1/admin/policies/attendance/streak/[^/?]+$')


def record_response(response):
    request = response.request
    if request.method != 'PUT' or not STREAK_PUT.search(request.url):
        return
    body = None
    try:
        body = response.json()
    except Exception:
        pass
    data = (body or {}).get('data') or {}
    evidence['puts'].append(
        {
            'status': response.status,
            'envelope': {
                'success': (body or {}).get('success'),
                'code': (body or {}).get('code'),
                'message': (body or {}).get('message'),
            },
            'data': {
                'effectiveMonth': data.get('effectiveMonth'),
                'milestones': [
                    {'milestoneDays': m.get('milestoneDays'), 'rewardTicketCount': m.get('rewardTicketCount')}
                    for m in data.get('milestones', [])
                ],
                'hasId': bool(data.get('id')),
                'hasCreatedByName': bool(data.get('createdByName')),
                'hasCreatedAt': bool(data.get('createdAt')),
            },
        }
    )
    save()


def get_streak_list():
    return json.loads(
        fetch(
            f'{BASE}/api/v1/admin/policies/attendance/streak?page=1&size=100',
            {'X-User-ID': ADMIN['id'], 'X-User-Role': 'ADMIN'},
        )
    )['data']


def edit_scheduled_streak(page, step3_reward: int):
    """예약된 연속 정책의 수정 다이얼로그를 열어 3단계 보상을 바꾸고 저장한다."""
    streak_section = page.locator('section[aria-labelledby="streak-title"]')
    streak_section.get_by_role('button', name='연속 예약 정책 수정').click()
    dialog = page.locator('[role="dialog"]').first
    dialog.wait_for()
    dialog.get_by_label('3단계 보상 장수').fill(str(step3_reward))
    dialog.get_by_role('button', name='정책 수정').click()
    # 성공 시 다이얼로그가 닫힌다 — 닫히지 않으면 오류 안내가 떴을 수 있다
    dialog.wait_for(state='hidden', timeout=20000)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = context.new_page()
    page.set_default_timeout(20000)
    page.on('pageerror', lambda e: evidence['errors'].append(str(e)))
    page.on(
        'console',
        lambda m: evidence['errors'].append(f'console.error: {m.text}')
        if m.type == 'error'
        else None,
    )
    page.on('response', record_response)

    page.goto(BASE + '/', wait_until='networkidle')
    page.get_by_role('button', name=re.compile(re.escape(ADMIN['name']))).first.click()
    page.wait_for_url(BASE + '/', timeout=20000)
    page.wait_for_timeout(1500)

    page.goto(BASE + '/admin/attendance-policies', wait_until='networkidle')
    page.wait_for_timeout(1500)
    streak_section = page.locator('section[aria-labelledby="streak-title"]')
    card_text = streak_section.locator('article', has_text='예약된 변경').inner_text()
    check(
        '예약 카드 사전 확인',
        has202611='2026-11' in card_text,
        has28x7='28일 연속: 브론즈 7장' in card_text,
    )
    assert '2026-11' in card_text, '예약 카드에 2026-11 묶음이 보이지 않는다'

    # 1) 변경: 28일 보상 7 → 8
    edit_scheduled_streak(page, 8)
    page.wait_for_timeout(1500)
    put1 = evidence['puts'][-1] if evidence['puts'] else None
    check(
        'AP06 변경 PUT 응답',
        status=put1 and put1['status'],
        envelope=put1 and put1['envelope'],
        data=put1 and put1['data'],
    )
    assert put1 and put1['status'] == 200, f'변경 PUT이 200이 아니다: {put1}'
    card_text = streak_section.locator('article', has_text='예약된 변경').inner_text()
    check('예약 카드 변경 반영', has28x8='28일 연속: 브론즈 8장' in card_text)
    page.screenshot(path=str(IMAGES / 'after-update.png'), full_page=True)

    # 2) 원복: 8 → 7
    edit_scheduled_streak(page, 7)
    page.wait_for_timeout(1500)
    put2 = evidence['puts'][-1] if evidence['puts'] else None
    check(
        'AP06 원복 PUT 응답',
        status=put2 and put2['status'],
        envelope=put2 and put2['envelope'],
        data=put2 and put2['data'],
    )
    assert put2 and put2['status'] == 200, f'원복 PUT이 200이 아니다: {put2}'
    card_text = streak_section.locator('article', has_text='예약된 변경').inner_text()
    check('예약 카드 원복 반영', has28x7='28일 연속: 브론즈 7장' in card_text)
    page.screenshot(path=str(IMAGES / 'after-restore.png'), full_page=True)

    browser.close()

# 최종 무결성 — GET 재조회로 원본(7→1/14→3/28→7, 2026-11)과 동일한지 대조한다
restored = [
    it
    for it in get_streak_list()['items']
    if it['effectiveMonth'] == '2026-11'
]
assert len(restored) == 1, f'2026-11 묶음이 {len(restored)}건이다'
final_ms = [(m['milestoneDays'], m['rewardTicketCount']) for m in restored[0]['milestones']]
check(
    '원복 최종 GET 대조',
    milestones=final_ms,
    restored=final_ms == [(7, 1), (14, 3), (28, 7)],
)
assert final_ms == [(7, 1), (14, 3), (28, 7)], '원복 실패 — 원본과 다르다'

check('콘솔 오류', count=len(evidence['errors']), errors=evidence['errors'])
print(f"\n증거 기록: {OUTPUT} ({len(evidence['checks'])} checks, {len(evidence['puts'])} puts)")
