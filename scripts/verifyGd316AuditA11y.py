"""GD-316: MSW dev 서버(5199)의 실행 감사 표를 키보드와 Chromium으로 검증한다."""
import base64
import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = 'http://localhost:5199'
EVENT_ID = '20000000-0000-4000-8000-000000000904'
PREFIX = Path('reports/20261023-gd316-audit-a11y')
REGION = '실행 감사 표 가로 스크롤'

def screenshot(page, path):
    # 네이티브 확대 시 Playwright의 CSS 좌표 클립 대신 실제 compositor 화면을 저장한다.
    session = page.context.new_cdp_session(page)
    try:
        data = session.send('Page.captureScreenshot', {
            'format': 'png', 'fromSurface': True, 'captureBeyondViewport': False,
        })['data']
        Path(path).write_bytes(base64.b64decode(data))
    finally:
        session.detach()


def focus_info(page):
    return page.evaluate("""() => {
        const el = document.activeElement, cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        let left = Math.max(0, r.left), right = Math.min(innerWidth, r.right);
        let top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
        for (let p = el.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p), b = p.getBoundingClientRect();
            if (/(auto|scroll|hidden)/.test(s.overflowY)) {
                top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom);
            }
            if (/(auto|scroll|hidden)/.test(s.overflowX)) {
                left = Math.max(left, b.left); right = Math.min(right, b.right);
            }
        }
        const x = (left + right) / 2, y = (top + bottom) / 2;
        const hit = document.elementFromPoint(x, y);
        return {
            name: el.getAttribute('aria-label') || el.innerText.trim().slice(0, 40),
            tag: el.tagName, insideDialog: !!el.closest('[role="dialog"]'),
            visible: right > left && bottom > top && !!hit && el.contains(hit)
                && (el.scrollWidth > el.clientWidth || el.getAttribute('role') === 'region'
                    || (r.top >= top - 1 && r.bottom <= bottom + 1)),
            ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0)
                || cs.boxShadow !== 'none',
        };
    }""")


def tab_to(page, locator, limit=60):
    for _ in range(limit):
        if locator.evaluate('(el) => el === document.activeElement'):
            return
        page.keyboard.press('Tab')
    raise AssertionError('키보드 Tab으로 대상에 도달하지 못했습니다.')


def prepare(page):
    page.goto(f'{BASE}/login', wait_until='networkidle')
    admin = page.locator('button', has_text='vu-admin')
    tab_to(page, admin)
    page.keyboard.press('Enter')
    page.wait_for_url(f'{BASE}/')
    page.goto(f'{BASE}/admin/draw?eventId={EVENT_ID}', wait_until='networkidle')
    expect(page.get_by_role('button', name='상세 보기').first).to_be_visible()
    # 긴 사유·요청 ID·다중 페이지는 별도 합성 MSW fixture다. 실제 서버 증거가 아니다.
    page.evaluate("""async () => {
        const { worker } = await import('/src/mocks/browser.ts');
        const { http, HttpResponse } = await import('/node_modules/.vite/deps/msw.js');
        worker.use(http.get('*/v1/admin/draws/:id/execution-audits', ({ request }) => {
            const url = new URL(request.url), page = Number(url.searchParams.get('page') || 1);
            const items = Array.from({ length: 12 }, (_, i) => ({
                id: `gd316-audit-${i}`, actorId: i % 2 ? 'vu-admin' : null,
                actorName: i % 2 ? '접근성 검증 관리자' : null,
                action: i % 2 ? 'DRAW_RESUME' : 'DRAW_EXECUTE',
                reason: i % 2 ? '실행 감사 표에서 긴 사유가 여러 줄로 표시되는지 확인합니다. '.repeat(3) : null,
                beforeData: null, afterData: null,
                requestId: i % 2 ? 'gd316-request-0123456789-abcdefghijklmnopqrstuvwxyz' : null,
                createdAt: '2026-10-23T00:00:00Z',
            }));
            return HttpResponse.json({ success: true, code: 'SUCCESS', data: {
                items: items.slice((page - 1) * 10, page * 10),
                page, size: 10, totalElements: 12,
            }});
        }));
    }""")


def open_operations(page):
    trigger = page.get_by_role('button', name='상세 보기').first
    tab_to(page, trigger)
    page.keyboard.press('Enter')
    expect(page.get_by_role('dialog')).to_be_visible()
    operations = page.get_by_role('dialog').get_by_role('button', name='운영 이력')
    tab_to(page, operations)
    page.keyboard.press('Enter')
    expect(page.get_by_role('region', name=REGION)).to_be_visible()
    expect(page.locator('#draw-audits-title').locator('..').locator('tbody tr')).to_have_count(10)
    return trigger


def keyboard_check(page, tag):
    trigger = open_operations(page)
    region = page.get_by_role('region', name=REGION)
    tab_to(page, region)
    expect(region).to_be_focused()
    screenshot(page, f'{PREFIX}-{tag}-focus.png')
    start = region.evaluate('(el) => el.scrollLeft')
    for _ in range(10):
        page.keyboard.press('ArrowRight')
    page.wait_for_function("""name => {
        const e = document.querySelector(`[aria-label="${name}"]`);
        return e.scrollWidth <= e.clientWidth + 1 || e.scrollLeft > 0;
    }""", arg=REGION)
    scroll = region.evaluate('(el) => ({left: el.scrollLeft, width: el.clientWidth, total: el.scrollWidth})')
    assert scroll['total'] <= scroll['width'] + 1 or scroll['left'] > start
    sequence = []
    # 정방향·역방향 모두 모달 안에서 포커스가 순환하는지 측정한다.
    for key in ('Tab', 'Shift+Tab'):
        for _ in range(18):
            page.keyboard.press(key)
            page.wait_for_timeout(30)
            info = focus_info(page)
            sequence.append({'key': key, **info})
    assert all(i['insideDialog'] and i['visible'] and i['ring'] for i in sequence), sequence
    audit = page.locator('#draw-audits-title').locator('..')
    tab_to(page, audit.get_by_role('button', name='2페이지', exact=True))
    page.keyboard.press('Enter')
    expect(audit.locator('tbody tr')).to_have_count(2)
    tab_to(page, audit.get_by_role('button', name='1페이지', exact=True))
    page.keyboard.press('Enter')
    expect(audit.locator('tbody tr')).to_have_count(10)
    page.keyboard.press('Escape')
    expect(page.get_by_role('dialog')).not_to_be_visible()
    expect(trigger).to_be_focused()
    return {'tabSequence': sequence, 'scroll': scroll, 'pages': [10, 2, 10], 'focusReturned': True}


def layout_check(page, tag):
    open_operations(page)
    audit = page.locator('#draw-audits-title').locator('..')
    audit.locator('h3').scroll_into_view_if_needed()
    metrics = audit.evaluate("""section => {
        const region = section.querySelector('[role="region"]');
        const cells = [...section.querySelectorAll('td')];
        const rows = [...section.querySelectorAll('tbody tr')];
        const reasons = rows.map(r => r.cells[3]);
        const overlappingRows = rows.slice(1).filter((r, i) =>
            r.getBoundingClientRect().top < rows[i].getBoundingClientRect().bottom - 1).length;
        return {
            viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
            pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
            dialogOverflow: (() => {const d = section.closest('[role="dialog"]');
                return d.scrollWidth > d.clientWidth + 1;})(),
            bodyOverflow: (() => {const d = section.closest('[role="dialog"]')
                .querySelector('.overflow-y-auto');
                return d.scrollWidth > d.clientWidth + 1;})(),
            auditSectionClipped: (() => {
                const d = section.closest('[role="dialog"]').getBoundingClientRect();
                const s = section.getBoundingClientRect();
                return s.left < d.left - 1 || s.right > d.right + 1;
            })(),
            clippedCells: cells.filter(c => c.scrollWidth > c.clientWidth + 1).length,
            overlappingRows, rowCount: rows.length,
            wrappedReasons: reasons.filter(c => c.textContent !== '—' &&
                c.clientHeight > parseFloat(getComputedStyle(c).lineHeight) * 2).length,
            scrollWidth: region.scrollWidth, clientWidth: region.clientWidth,
            zoom: getComputedStyle(document.documentElement).zoom,
        };
    }""")
    assert not metrics['pageOverflow'] and not metrics['dialogOverflow'], metrics
    assert not metrics['auditSectionClipped'], metrics
    assert metrics['clippedCells'] == 0 and metrics['overlappingRows'] == 0, metrics
    assert metrics['rowCount'] == 10 and metrics['wrappedReasons'] > 0, metrics
    screenshot(page, f'{PREFIX}-{tag}.png')
    region = page.get_by_role('region', name=REGION)
    region.evaluate('(el) => { el.scrollLeft = el.scrollWidth; }')
    screenshot(page, f'{PREFIX}-{tag}-right.png')
    page.keyboard.press('Escape')
    return metrics


def main():
    evidence = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'base': BASE, 'eventId': EVENT_ID, 'mode': 'local-dev-msw',
        'fixture': '합성 감사 12행: null·긴 사유·긴 요청 ID·페이지 이동. 서버 실측 아님.',
        'zoomMethod': '임시 Chromium 확장의 chrome.tabs.setZoom(tabId, 2)로 네이티브 페이지 확대 200%. CSS zoom·DPR 에뮬레이션 아님.',
        'baseline': f'{PREFIX}-before.json',
        'checks': {},
    }
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        evidence['browser'] = browser.version
        for tag, width, height, scale in [
            ('desktop', 1280, 900, 1), ('w320', 320, 900, 1)
        ]:
            context = browser.new_context(
                viewport={'width': width, 'height': height}, device_scale_factor=scale
            )
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            prepare(page)
            evidence['checks'][tag] = {
                'keyboard': keyboard_check(page, tag),
                'layout': layout_check(page, tag),
                'pageErrors': errors,
            }
            assert not errors, errors
            context.close()
        browser.close()
        # Headless Shell 대신 확장을 지원하는 Chromium을 임시 프로필로 실행한다.
        with tempfile.TemporaryDirectory(prefix='gd316-zoom-') as root:
            extension = Path(root) / 'extension'
            extension.mkdir()
            (extension / 'manifest.json').write_text(json.dumps({
                'manifest_version': 3, 'name': 'GD316 Local Zoom', 'version': '1.0',
                'permissions': ['tabs'], 'background': {'service_worker': 'background.js'},
            }), encoding='utf-8')
            (extension / 'background.js').write_text(
                'chrome.runtime.onInstalled.addListener(() => {});', encoding='utf-8'
            )
            context = p.chromium.launch_persistent_context(
                str(Path(root) / 'profile'), channel='chromium', headless=True,
                no_viewport=True, ignore_default_args=['--disable-extensions'],
                args=[f'--disable-extensions-except={extension}', f'--load-extension={extension}',
                      '--window-size=1280,900'],
            )
            page = context.pages[0]
            page.goto(f'{BASE}/login', wait_until='networkidle')
            workers = [w for w in context.service_workers if w.url.startswith('chrome-extension:')]
            worker = workers[0] if workers else context.wait_for_event(
                'serviceworker', predicate=lambda w: w.url.startswith('chrome-extension:')
            )
            actual_zoom = worker.evaluate("""async base => {
                const tabs = await chrome.tabs.query({});
                const tab = tabs.find(t => t.url?.startsWith(base));
                await chrome.tabs.setZoom(tab.id, 2);
                return await chrome.tabs.getZoom(tab.id);
            }""", BASE)
            assert actual_zoom == 2
            page.wait_for_function('devicePixelRatio === 2 && innerWidth <= 640')
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            prepare(page)
            evidence['checks']['zoom200'] = {
                'nativeZoom': actual_zoom,
                'viewport': page.evaluate('({width: innerWidth, height: innerHeight, dpr: devicePixelRatio})'),
                'keyboard': keyboard_check(page, 'zoom200'),
                'layout': layout_check(page, 'zoom200'),
                'pageErrors': errors,
            }
            assert not errors, errors
            context.close()
    evidence['verdict'] = 'pass'
    Path(f'{PREFIX}.json').write_text(
        json.dumps(evidence, ensure_ascii=False, indent=4) + '\n', encoding='utf-8'
    )
    print('GD-316: desktop / 320px / 네이티브 200% 확대 검증 통과')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        Path(f'{PREFIX}.json').write_text(
            json.dumps({'verdict': 'fail', 'error': str(error)}, ensure_ascii=False, indent=4) + '\n',
            encoding='utf-8',
        )
        raise
