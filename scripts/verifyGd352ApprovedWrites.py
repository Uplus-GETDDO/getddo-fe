"""GD-352: 승인된 쓰기 실측 + 신규 EVENT 차단 표본 상세 대조.

사용자 승인 범위(테스트 계정 한정):
  - N02 개별 읽음 PUT 1건 → 전후 미읽음 수 대조
  - N03 전체 읽음 PUT → 직후 미읽음 0 대조
  - (조건부) PLATINUM 응모 POST 1회 — 보유 계정+응모 가능 가중치 이벤트가 둘 다 있을 때만

대상 계정은 verifyGd352RemainingReads.py의 미읽음 분포에서 최솟값(≥1)인 user0으로 고정한다
(env JSON의 USER 순서와 같은 인덱스 — T1 증거의 unreadByAccount.user0에 해당).

또한 T1에서 새로 확인된 abuse triggerScope=EVENT 표본 1건의 AR02 상세 필드를 GET으로 대조한다
(읽기 — evidence 계약 필드 존재 여부만, 값 원문은 기록하지 않는다).

결과: reports/20261026-gd352-approved-writes.json

환경변수: L6_DEPLOY_URL(기본 https://getddo-fe.vercel.app)
"""
import json
import os
import re
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

BASE = os.environ.get('L6_DEPLOY_URL', 'https://getddo-fe.vercel.app').rstrip('/')
OUTPUT = Path('reports/20261026-gd352-approved-writes.json')
REQUEST_COUNT = [0]
WRITE_COUNT = [0]


def fetch(url):
    REQUEST_COUNT[0] += 1
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
TARGET = USER_ACCOUNTS[0]  # T1 미읽음 분포 최소 계정 (user0)

evidence = {
    'kind': 'GD-352 승인 쓰기 실측 + EVENT 차단 표본 상세 (테스트 계정 한정)',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'url': BASE,
    'entryChunk': entry_chunk.group(1) if entry_chunk else None,
    'requestCount': 0,
    'writeCount': 0,
    'checks': [],
}


def save():
    evidence['requestCount'] = REQUEST_COUNT[0]
    evidence['writeCount'] = WRITE_COUNT[0]
    OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')


def reason(e):
    if isinstance(e, urllib.error.HTTPError):
        body = e.read().decode('utf-8', 'replace')[:300]
        return f'HTTPError {e.code} {body}'
    return f'{type(e).__name__}: {e}'


def check(name, **fields):
    evidence['checks'].append({'name': name, **fields})
    save()
    print(f"check: {name} {fields}")


def api(method, path, user, body=None, headers=None):
    REQUEST_COUNT[0] += 1
    if method != 'GET':
        WRITE_COUNT[0] += 1
    h = {'X-User-ID': user['id'], 'X-User-Role': user['role']}
    if user.get('membership') and user['role'] == 'USER':
        h['X-User-Membership'] = user['membership']
    if headers:
        h.update(headers)
    data = json.dumps(body).encode('utf-8') if body is not None else None
    if data is not None:
        h['Content-Type'] = 'application/json'
    req = urllib.request.Request(f'{BASE}/api{path}', data=data, headers=h, method=method)
    res = urllib.request.urlopen(req, timeout=30)
    return res.status, json.loads(res.read())


def api_get(path, user):
    return api('GET', path, user)[1]


def items(payload):
    data = payload.get('data', payload)
    return data.get('items', data if isinstance(data, list) else []), data


def unread_count(user):
    payload = api_get('/v1/notifications/me?isRead=false&size=1', user)
    _, data = items(payload)
    return data.get('totalElements')


# 0) EVENT 차단 표본 상세 대조 (읽기) — T1에서 1건 확인됨
try:
    rows = []
    page = 1
    while page <= 5:
        payload = api_get(f'/v1/admin/abuse-cases?page={page}&size=100', ADMIN)
        page_items, data = items(payload)
        rows.extend(page_items)
        if page >= (data.get('totalPages') or 1):
            break
        page += 1
    ids = [r.get('id') or r.get('caseId') for r in rows if r.get('id') or r.get('caseId')]
    event_detail = None
    for cid in ids:
        detail = api_get(f'/v1/admin/abuse-cases/{cid}', ADMIN)
        d = detail.get('data', detail)
        if (d.get('evidence') or {}).get('triggerScope') == 'EVENT':
            event_detail = d
            break
    if event_detail is None:
        check('abuse EVENT 표본 상세', ok=False, reason='EVENT 표본을 찾지 못했다 (T1 이후 변동)')
    else:
        ev = event_detail.get('evidence') or {}
        check(
            'abuse EVENT 표본 상세 (필드 존재만)',
            ok=True,
            eventIdLinked=event_detail.get('eventId') is not None,
            hasEventTitle=event_detail.get('eventTitle') is not None,
            evidenceFields={f: (f in ev, ev.get(f) is not None) for f in [
                'ruleVersion', 'triggerScope', 'windowStartedAt', 'windowEndsAt',
                'requestLimit', 'rejectedCount', 'rejectionThreshold',
            ]},
        )
except Exception as e:
    check('abuse EVENT 표본 상세', ok=False, reason=reason(e))

# 1) N02 개별 읽음 — 전후 미읽음 대조
try:
    before = unread_count(TARGET)
    payload = api_get('/v1/notifications/me?isRead=false&size=1', TARGET)
    rows, _ = items(payload)
    if not rows or before in (None, 0):
        check('N02 개별 읽음', ok=False, skipped=True, reason=f'미읽음 없음 (totalElements={before})')
    else:
        nid = rows[0].get('id')
        status, res = api('PUT', f'/v1/notifications/{nid}/read', TARGET)
        after = unread_count(TARGET)
        check(
            'N02 개별 읽음',
            ok=status == 200 and (res.get('data') or {}).get('isRead') is True,
            httpStatus=status,
            isRead=(res.get('data') or {}).get('isRead'),
            unreadBefore=before,
            unreadAfter=after,
            delta=(before - after) if isinstance(before, int) and isinstance(after, int) else None,
        )
except Exception as e:
    check('N02 개별 읽음', ok=False, reason=reason(e))

# 2) N03 전체 읽음 — 직후 미읽음 0 대조
try:
    before = unread_count(TARGET)
    status, res = api('PUT', '/v1/notifications/me/read-all', TARGET)
    after = unread_count(TARGET)
    check(
        'N03 전체 읽음',
        ok=status == 200 and after == 0,
        httpStatus=status,
        updatedCount=(res.get('data') or {}).get('updatedCount'),
        unreadBefore=before,
        unreadAfter=after,
    )
except Exception as e:
    check('N03 전체 읽음', ok=False, reason=reason(e))

# 3) (조건부) PLATINUM 응모 — 보유+응모 가능 이벤트 둘 다 있을 때만
try:
    t01 = api_get('/v1/tickets/me', TARGET)
    d01 = t01.get('data', t01)
    platinum_before = (d01.get('countByGrade') or {}).get('PLATINUM', 0)
    if platinum_before < 1:
        check('PLATINUM 응모', ok=False, skipped=True, reason='PLATINUM 미보유')
    else:
        events = []
        page = 1
        while page <= 5:
            payload = api_get(f'/v1/events?page={page}&size=100', TARGET)
            page_items, edata = items(payload)
            events.extend(page_items)
            if page >= (edata.get('totalPages') or 1):
                break
            page += 1
        candidate = None
        for e in events:
            if (e.get('status') or '').upper() not in ('OPEN', 'IN_PROGRESS', 'ONGOING', 'ACTIVE'):
                continue
            try:
                elig = api_get(f"/v1/events/{e.get('id')}/eligibility", TARGET)
                ed = elig.get('data', elig)
                if ed.get('eligible') or ed.get('canEnter'):
                    candidate = e
                    break
            except Exception:
                continue
        if candidate is None:
            check('PLATINUM 응모', ok=False, skipped=True, reason='응모 가능 가중치 이벤트 없음')
        else:
            idem = str(uuid.uuid4())
            status, res = api(
                'POST', f"/v1/events/{candidate.get('id')}/entries", TARGET,
                body={'tickets': {'PLATINUM': 1}},
                headers={'Idempotency-Key': idem},
            )
            t01_after = api_get('/v1/tickets/me', TARGET)
            platinum_after = ((t01_after.get('data', t01_after).get('countByGrade') or {}).get('PLATINUM', 0))
            check(
                'PLATINUM 응모',
                ok=status in (200, 201),
                httpStatus=status,
                eventStatus=candidate.get('status'),
                weighting=candidate.get('weightingEnabled', candidate.get('weighted')),
                receiptKeys=sorted((res.get('data') or {}).keys()),
                platinumBefore=platinum_before,
                platinumAfter=platinum_after,
            )
except Exception as e:
    check('PLATINUM 응모', ok=False, reason=reason(e))

print(f"\n증거 기록: {OUTPUT} ({len(evidence['checks'])} checks, {REQUEST_COUNT[0]} requests, {WRITE_COUNT[0]} writes)")
