"""MSW 없는 로컬 빌드와 실제 API를 연결한다. 관리자 쓰기는 명시적인 장애/성공 응답 주입이다."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:5185'
API = 'https://dzc8oneey9mmx.cloudfront.net/api'
admin_id = os.environ['L5_ADMIN_ID']
user_id = os.environ['L5_USER_ID']
evidence = {'kind': 'MSW 없음, 로컬 preview 실제 API 프록시. 관리자 POST와 오류 상태는 주입으로 별도 표시.', 'requests': [], 'checks': [], 'errors': []}
output = Path('docs/superpowers/plans/L5-browser-evidence.json')
images = Path(os.environ['L5_IMAGE_DIR'])
images.mkdir(parents=True, exist_ok=True)

def save():
    output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900}, service_workers='block')
    user = {'id': admin_id, 'name': '시연 관리자', 'role': 'ADMIN', 'membership': 'excellent', 'personaLabel': None}
    context.add_init_script('localStorage.setItem("getddo-session",'+json.dumps(json.dumps({'state': {'user': user}, 'version': 0}))+');')
    page = context.new_page()
    page.set_default_timeout(15000)
    page.on('pageerror', lambda error: evidence['errors'].append(str(error)))
    mode = {'daily': 'live', 'mission': 'live', 'dailyRequests': 0, 'canceledEvent': None}

    def proxy(route):
        request = route.request
        path = request.url.split('/api', 1)[1]
        entry = {'method': request.method, 'path': path, 'kind': '실제 API'}
        if path == '/virtual-users':
            route.fulfill(json={'success': True, 'data': [user]})
            return
        if request.method == 'POST' and path == '/v1/admin/policies/attendance/streak':
            body = request.post_data_json
            assert [m['milestoneDays'] for m in body['milestones']] == [7, 14, 28]
            entry.update({'status': 201, 'kind': '주입: 연속 정책 예약 성공'})
            evidence['requests'].append(entry)
            route.fulfill(status=201, json={'success': True, 'data': {'id': 'l5-streak', 'effectiveMonth': '2026-11', 'milestones': [{**m, 'id': str(i)} for i, m in enumerate(body['milestones'])], 'createdBy': 'admin', 'createdAt': '2026-10-20T14:00:00Z'}})
            save()
            return
        if request.method == 'POST' and '/admin/policies/attendance/' in path:
            entry.update({'status': 409, 'kind': '주입: 중복 예약'})
            evidence['requests'].append(entry)
            route.fulfill(status=409, json={'success': False, 'code': 'ATTENDANCE-004', 'message': '이미 예약된 정책', 'data': None})
            save()
            return
        if request.method == 'GET' and path.startswith('/v1/admin/missions?') and mode['mission'] == 'empty':
            route.fulfill(json={'success': True, 'data': {'items': [], 'page': 1, 'size': 20, 'totalElements': 0}})
            evidence['requests'].append({**entry, 'kind': '주입: 빈 목록', 'status': 200})
            save()
            return
        if request.method == 'POST' and path == '/v1/admin/missions':
            body = request.post_data_json
            assert body['startsAt'] == '2026-10-20T15:00:00.000Z'
            assert body['rewardTicketCount'] == 1
            entry.update({'status': 201, 'kind': '주입: 미션 등록 성공', 'rewardTicketCount': body['rewardTicketCount'], 'questionCount': len(body['questions'])})
            body.update({'id': 'l5-mock-registration', 'status': 'ACTIVE', 'rewardPolicyId': 'policy', 'createdBy': 'admin', 'createdAt': '2026-10-20T14:00:00Z', 'updatedAt': '2026-10-20T14:00:00Z'})
            for i, question in enumerate(body['questions']):
                question['id'] = f'q{i}'
                for n, option in enumerate(question.get('options', [])):
                    option['id'] = f'o{n}'
            evidence['requests'].append(entry)
            route.fulfill(status=201, json={'success': True, 'data': body})
            save()
            return
        if '/admin/policies/attendance/daily' in path:
            mode['dailyRequests'] += 1
            if mode['daily'] in ['503', '429', '403']:
                status = int(mode['daily'])
                entry.update({'status': status, 'kind': '주입: 조회 실패'})
                evidence['requests'].append(entry)
                route.fulfill(status=status, headers={'Retry-After': '2'}, json={'success': False, 'code': 'COMMON-006' if status == 429 else 'ATTENDANCE-002' if status == 403 else 'COMMON-001', 'message': '정책 조회 실패', 'data': None})
                save()
                return
        headers = request.all_headers()
        for name in ['origin', 'host', 'referer']:
            headers.pop(name, None)
        response = route.fetch(url=API+path, headers=headers, timeout=20000)
        if mode['canceledEvent'] and path == '/v1/events/'+mode['canceledEvent']:
            body = response.json()
            body['data']['status'] = 'CANCELED'
            route.fulfill(json=body)
            evidence['requests'].append({**entry, 'status': 200, 'kind': '주입: 실제 상세의 상태만 CANCELED'})
            save()
            return
        entry['status'] = response.status
        evidence['requests'].append(entry)
        route.fulfill(response=response)
        save()

    page.route(BASE+'/api/**', proxy)
    page.goto(BASE+'/admin/attendance-policies', wait_until='networkidle')
    page.get_by_role('heading', name='출석 정책', exact=True).last.wait_for()
    page.get_by_text('브론즈 1장', exact=True).first.wait_for()
    original = page.locator('main').last.inner_text()
    evidence['checks'].append({'name': 'AP01/AP03 실제 목록', 'loaded': '적용 기준월' in original})
    page.get_by_role('button', name='일일 정책 예약', exact=True).click()
    page.get_by_text('이미 예약된 정책이 있습니다.', exact=False).wait_for()
    evidence['checks'].append({'name': 'AP02 중복 예약 UI', 'kind': '409 주입', 'shown': True})
    page.get_by_role('button', name='연속 정책 예약', exact=True).click()
    page.get_by_text('예약했습니다. 적용일·기준월은 아래 서버 정책에서 확인해 주세요.', exact=True).wait_for()
    evidence['checks'].append({'name': 'AP04 단계 예약', 'kind': '201 주입', 'submitted': True})
    mode['daily'] = '503'
    # 창 재포커스로 같은 키를 갱신한 뒤 마지막 성공 행이 유지되는지 검사한다.
    page.evaluate('window.dispatchEvent(new Event("visibilitychange"))')
    page.goto(BASE+'/admin/missions', wait_until='networkidle')
    page.get_by_role('heading', name='미션 관리', exact=True).last.wait_for()
    page.get_by_role('button', name='상세', exact=False).first.wait_for()
    buttons = page.get_by_role('button').all()
    detail = next(button for button in buttons if (button.get_attribute('aria-label') or '').endswith(' 상세'))
    detail.click()
    page.get_by_role('region', name='미션 상세').get_by_role('heading').first.wait_for()
    evidence['checks'].append({'name': 'AM01/AM02 실제 목록·상세', 'loaded': True})
    if page.get_by_label('집계 시작일').count():
        page.get_by_label('집계 시작일').fill('2026-10-01')
        page.get_by_label('집계 종료일').fill('2026-10-20')
        page.get_by_role('button', name='집계 조회', exact=True).click()
        page.get_by_text('마지막 성공 조회의 집계입니다.').wait_for()
        evidence['checks'].append({'name': 'AM04 실제 집계', 'loaded': True})
    page.get_by_role('button', name='미션 등록', exact=True).click()
    page.get_by_role('dialog').wait_for()
    page.get_by_label('미션 제목', exact=True).fill('L5 브라우저 검증 (주입)')
    page.get_by_label('설명', exact=True).fill('실제 등록하지 않는 폼 검증')
    page.get_by_label('운영 시작 (KST)', exact=True).fill('2026-10-21T00:00')
    page.get_by_label('운영 종료 (KST)', exact=True).fill('2026-10-22T00:00')
    page.get_by_label('1번 문항 내용', exact=True).fill('선호하는 선택지는?')
    page.get_by_label('1번 선택지 (한 줄에 하나, 2개 이상)', exact=True).fill('하나\n둘')
    page.get_by_role('button', name='등록', exact=True).click()
    page.get_by_role('dialog').wait_for(state='hidden')
    evidence['checks'].append({'name': 'AM03 등록 폼·1장·ACTIVE', 'kind': '201 주입', 'submitted': True})
    for width in [320, 390, 640]:
        page.set_viewport_size({'width': width, 'height': 900})
        page.emulate_media(reduced_motion='reduce', color_scheme='dark' if width == 320 else 'light')
        overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
        evidence['checks'].append({'name': '관리자 미션 반응형', 'width': width, 'horizontalOverflow': overflow})
        assert not overflow
        page.screenshot(path=str(images/f'L5-missions-{width}.png'), full_page=True)
    page.keyboard.press('Tab')
    evidence['checks'].append({'name': '키보드 포커스', 'tag': page.locator(':focus').evaluate('(el) => el.tagName')})
    mode['daily'] = 'live'
    page.goto(BASE+'/admin/attendance-policies', wait_until='networkidle')
    page.get_by_text('브론즈 1장', exact=True).first.wait_for()
    page.set_viewport_size({'width': 320, 'height': 900})
    overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
    evidence['checks'].append({'name': '출석 정책 320px', 'horizontalOverflow': overflow})
    assert not overflow
    page.screenshot(path=str(images/'L5-policies-320.png'), full_page=True)
    # 실제 성공 응답을 보관한 뒤 GET 503을 주입한다. 라우트 재진입은 기존 QueryClient를 유지한다.
    mode['daily'] = '503'
    page.set_viewport_size({'width': 1280, 'height': 900})
    page.get_by_role('button', name='일일 정책 새로 조회', exact=True).click()
    page.get_by_text('서버 오류가 발생했습니다.', exact=False).wait_for()
    evidence['checks'].append({'name': '정책 갱신 실패 마지막 성공값 보존', 'kind': '503 주입', 'retained': page.get_by_text('브론즈 1장', exact=True).count() > 0})
    mode['daily'] = '429'
    retry = page.get_by_role('button', name='다시 시도', exact=True).first
    retry.click()
    page.get_by_text('요청이 너무 많습니다.', exact=False).wait_for()
    before = mode['dailyRequests']
    retry.click()
    assert mode['dailyRequests'] == before
    evidence['checks'].append({'name': '429 즉시 재클릭 우회 차단', 'kind': 'Retry-After 2초 주입', 'blocked': True})
    mode['daily'] = 'live'
    page.wait_for_timeout(2300)
    retry.click()
    page.get_by_text('요청이 너무 많습니다.', exact=False).wait_for(state='hidden')
    evidence['checks'].append({'name': '429 이후 재연결 복구', 'kind': '대기 후 실제 API 재조회', 'restored': True})
    context.set_offline(True)
    page.get_by_role('button', name='일일 정책 새로 조회', exact=True).click()
    assert page.get_by_text('브론즈 1장', exact=True).count() > 0
    context.set_offline(False)
    page.wait_for_timeout(1200)
    evidence['checks'].append({'name': '실제 브라우저 오프라인·온라인 전환', 'retained': page.get_by_text('브론즈 1장', exact=True).count() > 0})
    mode['mission'] = 'empty'
    page.goto(BASE+'/admin/missions', wait_until='networkidle')
    page.get_by_text('등록된 미션이 없습니다.', exact=True).wait_for()
    evidence['checks'].append({'name': '미션 빈 목록', 'kind': '빈 응답 주입', 'shown': True})
    mode['mission'] = 'live'
    page.goto(BASE+'/admin/attendance-policies', wait_until='networkidle')
    evidence['checks'].append({'name': 'Worker 차단', 'registrations': page.evaluate('navigator.serviceWorker.getRegistrations().then(r=>r.length)')})
    save()
    public = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    public_user = {'id': user_id, 'name': '시연 사용자', 'role': 'USER', 'membership': 'excellent', 'personaLabel': None}
    public.add_init_script('localStorage.setItem("getddo-session",'+json.dumps(json.dumps({'state': {'user': public_user}, 'version': 0}))+');')
    public_page = public.new_page()
    public_page.route(BASE+'/api/**', proxy)
    public_page.on('pageerror', lambda error: evidence['errors'].append(str(error)))
    events_response = public.request.get(API+'/v1/events?page=1&size=20', headers={'X-User-ID': user_id, 'X-User-Role': 'USER', 'X-User-Membership': 'excellent'})
    events = events_response.json()['data']['items']
    for event_type, prefix in [('NO_TICKET', '/events/'), ('TICKET', '/time-raffle/')]:
        event = next(e for e in events if e['eventType'] == event_type)
        mode['canceledEvent'] = event['id']
        public_page.goto(BASE+prefix+event['id'], wait_until='networkidle')
        public_page.get_by_text('이벤트가 취소됐습니다.', exact=False).wait_for()
        assert public_page.get_by_role('button', name='응모하기', exact=True).count() == 0
        evidence['checks'].append({'name': event_type+' 취소 상세·응모 차단', 'kind': '상태 CANCELED 주입, 그 외 실제 API', 'path': prefix, 'shown': True})
    public.close()
    save()
    browser.close()
print(json.dumps({'checks': len(evidence['checks']), 'requests': len(evidence['requests']), 'errors': evidence['errors']}, ensure_ascii=False))
