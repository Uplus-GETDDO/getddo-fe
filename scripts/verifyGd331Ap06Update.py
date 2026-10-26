"""GD-331 AP06 예약 연속 출석 정책 수정 200 실측 — 배포본 UI 경유.

미래 effectiveMonth(2026-11)로 예약된 연속 출석 정책 묶음을 관리자 수정
다이얼로그로 두 번 고친다:
  1) 사전 GET으로 예약 묶음을 읽어 승인된 원본(28일 보상=7)인지 확인한다 —
     원본이 바뀌어 있으면 다른 변경을 덮어쓰지 않도록 쓰기를 중단한다.
  2) 28일 마일스톤 보상을 원본+1로 변경 (변경 PUT → 200·봉투·필드 대조)
  3) 원본값으로 원복 (원복 PUT → 200 확인)
각 단계에서 PUT 응답을 Network에서 캡처해 상태·봉투·StreakPolicySet 필드를
대조하고, 화면의 '예약된 변경' 카드가 새 값을 반영하는지 확인한다.
마일스톤 id·createdBy·effectiveMonth는 저장된 베이스라인과 대조한다 —
id 원문이 아니라 일치 불린만 증거에 남긴다.
마지막에 GET으로 원본과 동일한지 대조한다 — 원복이 완료돼야 성공이다.
원복은 변경 PUT이 시도된 뒤라면 예외 발생과 무관하게 다시 시도한다(finally) —
복구 PUT조차 실패하면 증거에 복구 실패를 남기고 중단한다.

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


def get_streak_list():
    return json.loads(
        fetch(
            f'{BASE}/api/v1/admin/policies/attendance/streak?page=1&size=100',
            {'X-User-ID': ADMIN['id'], 'X-User-Role': 'ADMIN'},
        )
    )['data']


# 사전 GET — 승인된 원본과 같은지 확인하고 원복·대조 기준을 저장한다.
# 예약 값이 이미 바뀌어 있으면 다른 변경을 덮어쓸 수 있으므로 쓰기를 중단한다.
targets = [
    it for it in get_streak_list()['items'] if it['effectiveMonth'] == '2026-11'
]
assert len(targets) == 1, f'2026-11 예약 묶음이 {len(targets)}건이다'
baseline = targets[0]
BASELINE_MS = sorted(
    (m['milestoneDays'], m['rewardTicketCount']) for m in baseline['milestones']
)
assert BASELINE_MS == [(7, 1), (14, 3), (28, 7)], (
    f'승인된 원본(7→1/14→3/28→7)과 다르다 — 쓰기를 중단한다: {BASELINE_MS}'
)
BASE_MS_IDS = {m['milestoneDays']: m.get('id') for m in baseline['milestones']}
ORIG_28 = next(
    m['rewardTicketCount'] for m in baseline['milestones'] if m['milestoneDays'] == 28
)
NEW_28 = ORIG_28 + 1


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
    resp_ms = data.get('milestones') or []
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
                    for m in resp_ms
                ],
                'hasId': bool(data.get('id')),
                'hasCreatedBy': bool(data.get('createdBy')),
                'hasCreatedByName': bool(data.get('createdByName')),
                'hasCreatedAt': bool(data.get('createdAt')),
                'hasMilestoneIds': bool(resp_ms) and all(m.get('id') for m in resp_ms),
                'effectiveMonthMatchesBaseline': data.get('effectiveMonth')
                == baseline['effectiveMonth'],
                'milestoneIdsMatchBaseline': bool(resp_ms)
                and all(
                    BASE_MS_IDS.get(m.get('milestoneDays')) == m.get('id')
                    for m in resp_ms
                ),
                'createdByMatchesBaseline': data.get('createdBy')
                == baseline.get('createdBy'),
            },
        }
    )
    save()


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
        has28xOrig=f'28일 연속: 브론즈 {ORIG_28}장' in card_text,
    )
    assert '2026-11' in card_text, '예약 카드에 2026-11 묶음이 보이지 않는다'

    restored = False
    try:
        # 1) 변경: 28일 보상을 원본+1로
        edit_scheduled_streak(page, NEW_28)
        page.wait_for_timeout(1500)
        put1 = evidence['puts'][-1] if evidence['puts'] else None
        check(
            'AP06 변경 PUT 응답',
            status=put1 and put1['status'],
            envelope=put1 and put1['envelope'],
            data=put1 and put1['data'],
        )
        assert put1 and put1['status'] == 200, f'변경 PUT이 200이 아니다: {put1}'
        assert put1['envelope']['success'] is True and put1['envelope']['code'] == 'SUCCESS', (
            f'변경 PUT 봉투가 계약과 다르다: {put1["envelope"]}'
        )
        d1 = put1['data']
        assert (
            d1['effectiveMonthMatchesBaseline']
            and d1['milestoneIdsMatchBaseline']
            and d1['createdByMatchesBaseline']
        ), f'변경 PUT 응답이 베이스라인과 어긋난다: {d1}'
        card_text = streak_section.locator('article', has_text='예약된 변경').inner_text()
        check('예약 카드 변경 반영', has28xNew=f'28일 연속: 브론즈 {NEW_28}장' in card_text)
        page.screenshot(path=str(IMAGES / 'after-update.png'), full_page=True)

        # 2) 원복: 원본값으로
        edit_scheduled_streak(page, ORIG_28)
        restored = True
        page.wait_for_timeout(1500)
        put2 = evidence['puts'][-1] if evidence['puts'] else None
        check(
            'AP06 원복 PUT 응답',
            status=put2 and put2['status'],
            envelope=put2 and put2['envelope'],
            data=put2 and put2['data'],
        )
        assert put2 and put2['status'] == 200, f'원복 PUT이 200이 아니다: {put2}'
        assert put2['envelope']['success'] is True and put2['envelope']['code'] == 'SUCCESS', (
            f'원복 PUT 봉투가 계약과 다르다: {put2["envelope"]}'
        )
        d2 = put2['data']
        assert (
            d2['effectiveMonthMatchesBaseline']
            and d2['milestoneIdsMatchBaseline']
            and d2['createdByMatchesBaseline']
        ), f'원복 PUT 응답이 베이스라인과 어긋난다: {d2}'
        card_text = streak_section.locator('article', has_text='예약된 변경').inner_text()
        check(
            '예약 카드 원복 반영',
            has28xOrig=f'28일 연속: 브론즈 {ORIG_28}장' in card_text,
        )
        page.screenshot(path=str(IMAGES / 'after-restore.png'), full_page=True)
    finally:
        if not restored:
            # 변경 PUT이 서버에 도달했는지 확정할 수 없어도 원복을 다시 시도한다 —
            # 같은 값 PUT은 내용상 no-op이라 실패 경로에서도 안전하다
            try:
                edit_scheduled_streak(page, ORIG_28)
                check('원복 복구(예외 경로)', recovered=True)
            except Exception as exc:
                evidence['errors'].append(f'원복 복구 실패: {exc}')
                check('원복 복구(예외 경로)', recovered=False, error=str(exc))
                raise

    browser.close()

# 최종 무결성 — GET 재조회로 저장된 베이스라인과 동일한지 대조한다
restored_items = [
    it for it in get_streak_list()['items'] if it['effectiveMonth'] == '2026-11'
]
assert len(restored_items) == 1, f'2026-11 묶음이 {len(restored_items)}건이다'
final = restored_items[0]
final_ms = sorted(
    (m['milestoneDays'], m['rewardTicketCount']) for m in final['milestones']
)
final_ids_match = all(
    BASE_MS_IDS.get(m['milestoneDays']) == m.get('id') for m in final['milestones']
)
check(
    '원복 최종 GET 대조',
    milestones=final_ms,
    valuesRestored=final_ms == BASELINE_MS,
    milestoneIdsMatchBaseline=final_ids_match,
    samePolicyId=final['id'] == baseline['id'],
    sameCreatedBy=final.get('createdBy') == baseline.get('createdBy'),
    sameEffectiveMonth=final['effectiveMonth'] == baseline['effectiveMonth'],
)
assert (
    final_ms == BASELINE_MS
    and final_ids_match
    and final['id'] == baseline['id']
    and final.get('createdBy') == baseline.get('createdBy')
), '원복 실패 — 저장된 베이스라인과 다르다'

check('콘솔 오류', count=len(evidence['errors']), errors=evidence['errors'])
print(f"\n증거 기록: {OUTPUT} ({len(evidence['checks'])} checks, {len(evidence['puts'])} puts)")
