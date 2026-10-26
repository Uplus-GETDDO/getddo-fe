import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent
PHASE = sys.argv[1]
USER = dict(id='vu-doyoon', name='김도윤', role='USER', membership='excellent', personaLabel='데일리 루틴러')

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    results = []
    for width in [360, 390, 768, 1280]:
        for long_name in [False, True]:
            for large in [False, True]:
                for admin in [False, True]:
                    user = {**USER}
                    if long_name:
                        user['name'] = '아주긴사용자이름ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                    if admin:
                        user.update(id='vu-admin', role='ADMIN', personaLabel=None)
                    page = browser.new_page(viewport=dict(width=width, height=844))
                    page.add_init_script('localStorage.setItem("getddo-session", ' + json.dumps(json.dumps(dict(state=dict(user=user), version=0))) + ');')
                    page.goto('http://127.0.0.1:5174/missions')
                    page.wait_for_load_state('networkidle')
                    page.locator('header').wait_for()
                    if large:
                        page.evaluate("document.documentElement.dataset.textScale = 'large'")
                    page.wait_for_timeout(150)
                    label = f'{width}-{"long" if long_name else "normal"}-{"large" if large else "default"}-{"admin" if admin else "user"}'
                    data = page.locator('header').evaluate('''(h, name) => ({
                        width: innerWidth, documentWidth: document.documentElement.scrollWidth,
                        controls: [...h.querySelectorAll('button, a')].filter(e => e.getBoundingClientRect().width > 0).map(e => {
                            const r=e.getBoundingClientRect(); return {text:e.getAttribute('aria-label') || e.textContent, x:r.x, right:r.right, width:r.width, height:r.height};
                        }),
                        names: [...h.querySelectorAll('span')].filter(e => e.firstChild?.nodeType===3 && e.textContent.includes(name)).map(e=>{const height=e.getBoundingClientRect().height, lh=getComputedStyle(e).lineHeight, lineHeight=parseFloat(lh); return {height, lineHeight: lh, wraps: Number.isFinite(lineHeight) && height > lineHeight * 1.5};})
                    })''', user['name'])
                    results.append(dict(scenario=label, **data))
                    if (not admin and (not long_name or large)) or (admin and long_name and large):
                        page.screenshot(path=str(OUT / f'{PHASE}-{label}.png'))
                    page.close()
    browser.close()
    (OUT / f'{PHASE}-measurements.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'{PHASE}: {len(results)} scenarios')
