"""GD-313 요청 수 실측 — 페이지 초기 로드·전경 폴링·숨김 상태의 /api 요청을 센다.

TanStack Query observer당 refetchInterval이 따로 돌아 같은 queryKey라도 구독 수만큼
요청이 중복되는지 검증하기 위한 기준선/재측정 도구다.

사용:
    python scripts/measureQueryRequests.py                    # 사용자 홈·겟또타임 + 관리자 대시보드
    python scripts/measureQueryRequests.py --page home        # 한 페이지만
    python scripts/measureQueryRequests.py --fast             # 폴링 35s → 10s (빠른 확인용, 주기 미포함 주의)

서버는 http://localhost:5173 에 떠 있어야 한다 (npm run dev, MSW on).
"""

import argparse
import json
import re
import sys
import time
from collections import Counter

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
UUID_RE = re.compile(
    r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.I
)
API_PREFIX = '/api/v1'


def is_api(url: str) -> bool:
    return API_PREFIX in url


def norm(url: str) -> str:
    """요청 URL을 엔드포인트 패턴으로 정규화한다 (/api/v1/events/evt-001 → /v1/events/:id).

    목업 ID(evt-001·bnr-01 등)는 UUID가 아니므로 '숫자를 포함한 세그먼트'도 :id로 치환한다."""
    path = url.split('?')[0].split(API_PREFIX, 1)[-1]
    parts = [
        ':id' if seg != 'v1' and (UUID_RE.search(seg) or any(c.isdigit() for c in seg)) else seg
        for seg in path.split('/')
        if seg
    ]
    return '/' + '/'.join(parts)


def hide(page, hidden: bool):
    """document.visibilityState를 가려진/보이는 상태로 흉내 낸다 — TanStack focusManager가 읽는 값."""
    page.evaluate(
        """(hidden) => {
            Object.defineProperty(document, 'visibilityState', {
                get: () => (hidden ? 'hidden' : 'visible'), configurable: true,
            });
            document.dispatchEvent(new Event('visibilitychange'));
        }""",
        hidden,
    )


def login(page, base: str, role: str):
    page.goto(base + '/login')
    page.wait_for_selector('ul li button', timeout=15_000)
    buttons = page.locator('ul li button')
    for i in range(buttons.count()):
        text = buttons.nth(i).inner_text()
        is_admin = '관리자' in text
        if (role == 'admin') == is_admin:
            buttons.nth(i).click()
            return
    raise RuntimeError(f'{role} 가상 사용자를 찾지 못했습니다')


def measure(page, base: str, path: str, label: str, window_s: float):
    """한 페이지의 초기 로드 → 전경 폴링 → 숨김 구간 요청 수를 잰다."""
    reqs = []
    page.on('request', lambda r: reqs.append((time.time(), r.method, r.url)))

    page.goto(base + path)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3_000)
    t_load = time.time()
    initial = [(t, m, u) for t, m, u in reqs if t <= t_load]
    reqs.clear()

    page.wait_for_timeout(int(window_s * 1000))
    fg = list(reqs)
    reqs.clear()

    hide(page, True)
    page.wait_for_timeout(int(window_s * 1000))
    bg = list(reqs)
    reqs.clear()
    hide(page, False)

    api = lambda rows: Counter(norm(u) for _, _, u in rows if is_api(u))
    return {
        'page': label,
        'initial_total': len(initial),
        'initial_api': api(initial),
        'foreground_api': api(fg),
        'hidden_api': api(bg),
        'window_s': window_s,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--page', choices=['home', 'raffle', 'admin'], default=None)
    ap.add_argument('--base', default=BASE, help='dev 서버 주소')
    ap.add_argument('--fast', action='store_true', help='폴링 구간을 10초로 줄인다 (한 주기 미만)')
    ap.add_argument('--out', default=None, help='결과 JSON 저장 경로')
    args = ap.parse_args()
    window_s = 10.0 if args.fast else 38.0

    pages = [('home', '/', 'user'), ('raffle', '/time-raffle', 'user'), ('admin', '/admin', 'admin')]
    if args.page:
        pages = [p for p in pages if p[0] == args.page]

    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = ctx.new_page()
        current_role = None
        for name, path, role in pages:
            # 세션은 localStorage persist라 역할이 바뀔 때만 다시 고른다
            if role != current_role:
                login(page, args.base, role)
                page.wait_for_timeout(500)
                current_role = role
            result = measure(page, args.base, path, name, window_s)
            results.append(result)
            print(f"\n=== {name} ({path}) ===")
            print(f"초기 로드 요청 {result['initial_total']}건 (API {sum(result['initial_api'].values())}건)")
            for ep, n in result['initial_api'].most_common():
                print(f'  {n:>3}  {ep}')
            print(f"전경 {result['window_s']}s API {sum(result['foreground_api'].values())}건")
            for ep, n in result['foreground_api'].most_common():
                print(f'  {n:>3}  {ep}')
            print(f"숨김 {result['window_s']}s API {sum(result['hidden_api'].values())}건")
            for ep, n in result['hidden_api'].most_common():
                print(f'  {n:>3}  {ep}')
        browser.close()

    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2, default=dict)
    return 0


if __name__ == '__main__':
    sys.exit(main())
