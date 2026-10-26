"""GD-352: 백엔드 통합 잔여 — 배포본 읽기 전용 수집.

docs/backend-integration-status.md의 미확정·미관측 잔여를 배포 API로 재확인한다:
  - ADR-028 이름 필드: 관리자 GET 표본에서 *Name 필드의 present/null/missing 집계
  - PLATINUM: 관리자 응모권 이력 등급 분포·가상 계정별 T01 보유/T02 이력·응모 가능 가중치 이벤트
  - abuse triggerScope=EVENT·INACTIVE 사용자·추첨 FAILED 실행 표본 재확인 (GD-330 추적)
  - AP05 대상: AP01 일일 정책의 미래 effectiveFrom 예약 표본 유무
  - 미읽음 분포: 가상 USER별 N01 미읽음 수 (T2 쓰기 대상 계정 선택 근거)

전부 GET만 — 쓰기 요청은 보내지 않는다. 증거에는 이름·ID 원문·닉네임을 남기지 않고
분포·개수·필드 존재 여부만 기록한다. 결과: reports/20261026-gd352-remaining-reads.json

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
OUTPUT = Path('reports/20261026-gd352-remaining-reads.json')
REQUEST_COUNT = [0]
WRITE_COUNT = 0  # 이 스크립트는 GET만 — 쓰기 발생 시 수동 갱신 금지, 실패로 기록


def fetch(url):
    REQUEST_COUNT[0] += 1
    with urllib.request.urlopen(url, timeout=20) as res:
        return res.read().decode('utf-8')


html = fetch(BASE + '/')
env_chunk = re.search(r'/assets/(env-[^"]+\.js)', html)
entry_chunk = re.search(r'/assets/(index-[^"]+\.js)', html)
# GD-348 부트 구조에서 env 청크는 HTML이 아니라 index JS의 mapDeps 배열에 있다
if not env_chunk and entry_chunk:
    index_src = fetch(f'{BASE}/assets/{entry_chunk.group(1)}')
    env_chunk = re.search(r'assets/(env-[^"\'\],]+\.js)', index_src)
assert env_chunk, 'env 청크를 찾지 못했다'
env_src = fetch(f'{BASE}/assets/{env_chunk.group(1)}')
USERS = json.loads(re.search(r'virtualUsersJson:`(.*?)`', env_src, re.S).group(1))
ADMIN = next((u for u in USERS if u['role'] == 'ADMIN'), None)
USER_ACCOUNTS = [u for u in USERS if u['role'] == 'USER']
assert ADMIN and USER_ACCOUNTS, '배포 JSON에 ADMIN·USER 계정이 없다'

evidence = {
    'kind': 'GD-352 백엔드 통합 잔여 — 배포본 읽기 전용 수집',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'url': BASE,
    'entryChunk': entry_chunk.group(1) if entry_chunk else None,
    'requestCount': 0,
    'writeCount': WRITE_COUNT,
    'checks': [],
}


def save():
    evidence['requestCount'] = REQUEST_COUNT[0]
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
    REQUEST_COUNT[0] += 1
    headers = {'X-User-ID': user['id'], 'X-User-Role': user['role']}
    if user.get('membership') and user['role'] == 'USER':
        headers['X-User-Membership'] = user['membership']
    req = urllib.request.Request(f'{BASE}/api{path}', headers=headers)
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


def field_stats(rows, field):
    """*Name 필드의 present/null/missing 집계 — 값 원문은 기록하지 않는다."""
    stats = {'present': 0, 'null': 0, 'missing': 0}
    for r in rows:
        if field not in r:
            stats['missing'] += 1
        elif r[field] is None:
            stats['null'] += 1
        else:
            stats['present'] += 1
    return stats


# 1) ADR-028 이름 필드 — 관리자 GET 표본의 *Name 존재 여부
def name_field_check(name, rows, fields):
    out = {'sampled': len(rows)}
    for f in fields:
        out[f] = field_stats(rows, f)
    return out


try:
    rows = walk_pages('/v1/admin/entries', ADMIN)
    check('ADR-028 admin entries 이름 필드', **name_field_check('entries', rows, ['userName', 'actorName', 'createdByName']))
except Exception as e:
    check('ADR-028 admin entries 이름 필드', ok=False, reason=reason(e))

try:
    events = walk_pages('/v1/admin/events', ADMIN)
    event_ids = [e.get('id') for e in events if e.get('id')]
except Exception as e:
    event_ids = []
    check('admin events 목록', ok=False, reason=reason(e))

draw_ids = []
draw_statuses = Counter()
try:
    for eid in event_ids:
        try:
            payload = api_get(f'/v1/admin/events/{eid}/draws', ADMIN)
            rows, _ = items(payload)
            for r in rows:
                ex = r.get('execution') or {}
                draw_statuses[ex.get('status') or r.get('status') or 'UNKNOWN'] += 1
                rid = r.get('id') or r.get('drawId') or ex.get('id')
                if rid:
                    draw_ids.append(rid)
        except Exception:
            draw_statuses['REQUEST_FAILED'] += 1
    check(
        'draws 실행 상태 분포',
        events=len(event_ids),
        executions=sum(draw_statuses.values()),
        byStatus={str(k): v for k, v in draw_statuses.items()},
        failedSpecimen=(draw_statuses.get('FAILED', 0) > 0),
    )
except Exception as e:
    check('draws 실행 상태 분포', ok=False, reason=reason(e))

try:
    audit_rows = []
    for did in draw_ids[:10]:
        payload = api_get(f'/v1/admin/draws/{did}/execution-audits', ADMIN)
        rows, _ = items(payload)
        audit_rows.extend(rows)
    check('ADR-028 execution-audits 이름 필드', **name_field_check('audits', audit_rows, ['actorName', 'createdByName']))
except Exception as e:
    check('ADR-028 execution-audits 이름 필드', ok=False, reason=reason(e))

try:
    rows = walk_pages('/v1/admin/notifications', ADMIN)
    check('ADR-028 admin notifications 이름 필드', **name_field_check('notifications', rows, ['userName', 'actorName', 'createdByName']))
except Exception as e:
    check('ADR-028 admin notifications 이름 필드', ok=False, reason=reason(e))

try:
    rows = walk_pages('/v1/admin/ticket-histories', ADMIN)
    grade_dist = Counter(r.get('grade') for r in rows)
    check(
        'ticket-histories 등급 분포 + 이름 필드',
        total=len(rows),
        byGrade={str(k): v for k, v in grade_dist.items()},
        goldOrPlatinum=(grade_dist.get('GOLD', 0) + grade_dist.get('PLATINUM', 0)) > 0,
        **name_field_check('tickets', rows, ['userName', 'actorName', 'createdByName']),
    )
except Exception as e:
    check('ticket-histories 등급 분포 + 이름 필드', ok=False, reason=reason(e))

try:
    rows = walk_pages('/v1/admin/missions', ADMIN)
    check('ADR-028 admin missions 이름 필드', **name_field_check('missions', rows, ['createdByName', 'actorName', 'userName']))
except Exception as e:
    check('ADR-028 admin missions 이름 필드', ok=False, reason=reason(e))

try:
    now = datetime.now(timezone.utc)
    daily_rows = walk_pages('/v1/admin/policies/attendance/daily', ADMIN)
    streak_rows = walk_pages('/v1/admin/policies/attendance/streak', ADMIN)

    def parse_instant(value):
        if not value:
            return None
        return datetime.fromisoformat(value.replace('Z', '+00:00'))

    future_daily = sum(
        1 for r in daily_rows if (i := parse_instant(r.get('effectiveFrom'))) and i > now
    )
    cur_month = now.strftime('%Y-%m')
    future_streak = sum(1 for r in streak_rows if (r.get('effectiveMonth') or '') > cur_month)
    check(
        'attendance 정책 표본 + 이름 필드',
        daily=len(daily_rows),
        dailyFutureScheduled=future_daily,
        streak=len(streak_rows),
        streakFutureScheduled=future_streak,
        ap05DailySpecimen=future_daily > 0,
        dailyName={f: field_stats(daily_rows, f) for f in ['createdByName', 'actorName']},
        streakName={f: field_stats(streak_rows, f) for f in ['createdByName', 'actorName']},
    )
except Exception as e:
    check('attendance 정책 표본 + 이름 필드', ok=False, reason=reason(e))

# 2) abuse triggerScope 분포 (AR02 상세)
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

# 3) 사용자 상태 분포
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

# 4) PLATINUM — 가상 계정별 T01 보유·T02 이력·미읽음 수 (개수만)
try:
    platinum = {'holders': 0, 't01PlatinumTotal': 0, 't02PlatinumRows': 0}
    unread_dist = {}
    for idx, u in enumerate(USER_ACCOUNTS):
        t01 = api_get('/v1/tickets/me', u)
        d = t01.get('data', t01)
        by_grade = (d.get('countByGrade') or {})
        p_count = by_grade.get('PLATINUM', 0)
        if p_count > 0:
            platinum['holders'] += 1
            platinum['t01PlatinumTotal'] += p_count
        t02 = api_get('/v1/tickets/histories/me?size=100', u)
        t02_rows, _ = items(t02)
        platinum['t02PlatinumRows'] += sum(1 for r in t02_rows if r.get('grade') == 'PLATINUM')
        n01 = api_get('/v1/notifications/me?isRead=false&size=1', u)
        _, ndata = items(n01)
        unread_dist[f'user{idx}'] = ndata.get('totalElements')
    check(
        'PLATINUM 가상 계정 보유 + 미읽음 분포',
        userAccounts=len(USER_ACCOUNTS),
        platinumHolders=platinum['holders'],
        t01PlatinumTotal=platinum['t01PlatinumTotal'],
        t02PlatinumRows=platinum['t02PlatinumRows'],
        unreadByAccount=unread_dist,
    )
except Exception as e:
    check('PLATINUM 가상 계정 보유 + 미읽음 분포', ok=False, reason=reason(e))

# 5) 응모 가능 가중치 이벤트 탐색 (E01 + eligibility)
try:
    events_user = walk_pages('/v1/events', USER_ACCOUNTS[0])
    ticket_events = [
        e for e in events_user
        if e.get('eventType') == 'TICKET' or e.get('isTimeRaffle')
    ]
    open_events = [
        e for e in ticket_events
        if (e.get('status') or '').upper() in ('OPEN', 'IN_PROGRESS', 'ONGOING', 'ACTIVE')
    ]
    eligible_count = 0
    for e in open_events[:10]:
        try:
            payload = api_get(f"/v1/events/{e.get('id')}/eligibility", USER_ACCOUNTS[0])
            d = payload.get('data', payload)
            if d.get('eligible') or d.get('canEnter'):
                eligible_count += 1
        except Exception:
            pass
    check(
        '응모 가능 가중치 이벤트 탐색',
        ticketEvents=len(ticket_events),
        openEvents=len(open_events),
        eligibleForFirstUser=eligible_count,
        eventStatusDist={
            str(k): v for k, v in Counter(e.get('status') for e in ticket_events).items()
        },
    )
except Exception as e:
    check('응모 가능 가중치 이벤트 탐색', ok=False, reason=reason(e))

print(f"\n증거 기록: {OUTPUT} ({len(evidence['checks'])} checks, {REQUEST_COUNT[0]} requests)")
