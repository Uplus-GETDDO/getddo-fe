"""GD-330: spec 대비 미실측 표본 존재 여부 — 배포본 읽기 전용 수집.

docs/backend-integration-status.md의 미실측 잔여를 배포 API로 재확인한다:
  - abuse-cases: AR02 상세로 triggerScope=EVENT 표본 존재 여부 (GD-317 시점 전부 USER)
  - admin users: INACTIVE 계정 표본 (GD-261 시점 DB 0건)
  - events→draws: FAILED 실행 표본 (실패 재개 미검증)
  - attendance daily/streak: 예약(미래 적용) 정책 표본 (AP05/AP06 200·자정 경계 관측 대상)
  - ticket-histories: GOLD/PLATINUM 실물 표본 (플래티넘 0장이던 시점 이후)
  - notifications: 알림 목록 표본 수 (통합 검증은 별도)

전부 GET만 — 쓰기 요청은 보내지 않는다. 증거에는 ID·이름·사유 원문을 남기지 않고
분포·개수만 기록한다. 결과: reports/20261023-gd330-spec-samples.json

환경변수: L6_DEPLOY_URL(기본 https://getddo-fe.vercel.app)
"""
import json
import os
import re
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

BASE = os.environ.get('L6_DEPLOY_URL', 'https://getddo-fe.vercel.app').rstrip('/')
OUTPUT = Path('reports/20261023-gd330-spec-samples.json')


def fetch(url):
    with urllib.request.urlopen(url, timeout=20) as res:
        return res.read().decode('utf-8')


html = fetch(BASE + '/')
env_chunk = re.search(r'/assets/(env-[^"]+\.js)', html)
assert env_chunk, 'env 청크를 찾지 못했다'
env_src = fetch(f'{BASE}/assets/{env_chunk.group(1)}')
USERS = json.loads(re.search(r'virtualUsersJson:`(.*?)`', env_src, re.S).group(1))
ADMIN = next((u for u in USERS if u['role'] == 'ADMIN'), None)
USER = next((u for u in USERS if u['role'] == 'USER'), None)
assert ADMIN and USER, '배포 JSON에 ADMIN·USER 계정이 없다'

evidence = {
    'kind': 'GD-330 spec 미실측 표본 존재 여부 — 배포본 읽기 전용',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'url': BASE,
    'checks': [],
}


def save():
    OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')


def reason(e):
    if isinstance(e, urllib.error.HTTPError):
        return f'HTTPError {e.code}'
    return f'{type(e).__name__}: {e}'


def check(name, **fields):
    evidence['checks'].append({'name': name, **fields})
    save()
    print(f"check: {name} {fields}")


def api_get(path, user):
    req = urllib.request.Request(
        f'{BASE}/api{path}',
        headers={'X-User-ID': user['id'], 'X-User-Role': user['role']},
    )
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


def items(payload):
    data = payload.get('data', payload)
    return data.get('items', data if isinstance(data, list) else []), data


def walk_pages(path, user, max_pages=20):
    all_items = []
    page = 1
    while page <= max_pages:
        sep = '&' if '?' in path else '?'
        payload = api_get(f'{path}{sep}page={page}&size=100', user)
        page_items, data = items(payload)
        all_items.extend(page_items)
        if page >= (data.get('totalPages') or 1):
            break
        page += 1
    return all_items


# 1) triggerScope=EVENT 표본 — 목록에 필드가 없으므로 상세(AR02)로 확인
try:
    rows = walk_pages('/v1/admin/abuse-cases', ADMIN)
    ids = [r.get('id') or r.get('caseId') for r in rows]
    ids = [i for i in ids if i]
    dist = Counter()
    for cid in ids:
        detail = api_get(f'/v1/admin/abuse-cases/{cid}', ADMIN)
        data = detail.get('data', detail)
        dist[(data.get('evidence') or {}).get('triggerScope')] += 1
    check(
        'abuse triggerScope 분포 (AR02 상세)',
        total=len(ids),
        byScope={str(k): v for k, v in dist.items()},
        eventSpecimen=dist.get('EVENT', 0) > 0,
    )
except Exception as e:
    check('abuse triggerScope 분포', ok=False, reason=reason(e))

# 2) INACTIVE 계정 표본
try:
    rows = walk_pages('/v1/admin/users', ADMIN)
    dist = Counter(r.get('status') for r in rows)
    check(
        'admin users 상태 분포',
        total=len(rows),
        byStatus={str(k): v for k, v in dist.items()},
        inactiveSpecimen=dist.get('INACTIVE', 0) > 0,
    )
except Exception as e:
    check('admin users 상태 분포', ok=False, reason=reason(e))

# 3) 추첨 실패 실행 표본 — 이벤트별 draws를 순회
try:
    events = walk_pages('/v1/admin/events', ADMIN)
    event_ids = [e.get('id') for e in events if e.get('id')]
    statuses = Counter()
    scanned = 0
    for eid in event_ids:
        try:
            payload = api_get(f'/v1/admin/events/{eid}/draws', ADMIN)
            rows, _ = items(payload)
            scanned += 1
            for r in rows:
                ex = r.get('execution') or {}
                statuses[ex.get('status') or r.get('status') or 'UNKNOWN'] += 1
        except Exception:
            statuses['(event draw 조회 실패)'] += 1
    check(
        'draws 실행 상태 분포',
        events=len(event_ids),
        eventsScanned=scanned,
        executions=sum(statuses.values()),
        byStatus={str(k): v for k, v in statuses.items()},
        failedSpecimen=statuses.get('FAILED', 0) > 0,
    )
except Exception as e:
    check('draws 실행 상태 분포', ok=False, reason=reason(e))

# 4) 출석 정책 예약 표본 — daily는 effectiveFrom>now, streak은 effectiveMonth>현재월
try:
    now = datetime.now(timezone.utc)
    daily_rows = walk_pages('/v1/admin/policies/attendance/daily', ADMIN)
    future_daily = sum(1 for r in daily_rows if (r.get('effectiveFrom') or '') > now.isoformat())
    streak_rows = walk_pages('/v1/admin/policies/attendance/streak', ADMIN)
    cur_month = now.strftime('%Y-%m')
    future_streak = sum(1 for r in streak_rows if (r.get('effectiveMonth') or '') > cur_month)
    check(
        'attendance 정책 표본',
        daily=len(daily_rows),
        dailyFutureScheduled=future_daily,
        streak=len(streak_rows),
        streakFutureScheduled=future_streak,
        scheduledSpecimen=(future_daily + future_streak) > 0,
    )
except Exception as e:
    check('attendance 정책 표본', ok=False, reason=reason(e))

# 5) GOLD/PLATINUM 응모권 실물 표본
try:
    rows = walk_pages('/v1/admin/ticket-histories', ADMIN)
    dist = Counter(r.get('grade') for r in rows)
    check(
        'ticket-histories 등급 분포',
        total=len(rows),
        byGrade={str(k): v for k, v in dist.items()},
        goldOrPlatinum=(dist.get('GOLD', 0) + dist.get('PLATINUM', 0)) > 0,
    )
except Exception as e:
    check('ticket-histories 등급 분포', ok=False, reason=reason(e))

# 6) 알림 목록 표본 수 — USER 역할로 조회 (관리자 헤더는 권한 밖)
try:
    payload = api_get('/v1/notifications?page=1&size=20', USER)
    rows, data = items(payload)
    types = Counter(r.get('type') for r in rows)
    check(
        'notifications 목록',
        sample=len(rows),
        total=data.get('totalElements'),
        byType={str(k): v for k, v in types.items()},
    )
except Exception as e:
    check('notifications 목록', ok=False, reason=reason(e))

print(f"\n증거 기록: {OUTPUT} ({len(evidence['checks'])} checks)")
