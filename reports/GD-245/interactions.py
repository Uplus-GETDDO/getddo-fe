import json
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent
USER = dict(id='vu-doyoon', name='아주긴사용자이름ABCDEFGHIJKLMNOPQRSTUVWXYZ', role='USER', membership='excellent', personaLabel='데일리 루틴러')
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for width in [360, 390, 768, 1280]:
        page = browser.new_page(viewport=dict(width=width, height=844))
        page.add_init_script('localStorage.setItem("getddo-session", ' + json.dumps(json.dumps(dict(state=dict(user=USER), version=0))) + ');')
        page.goto('http://127.0.0.1:5174/missions')
        page.wait_for_load_state('networkidle')
        page.evaluate("document.documentElement.dataset.textScale='large'")
        sequence = []
        count = page.locator('header').locator('a:visible, button:visible').count()
        for _ in range(count):
            page.keyboard.press('Tab')
            sequence.append(page.evaluate("({name:document.activeElement.getAttribute('aria-label') || document.activeElement.textContent, ring:getComputedStyle(document.activeElement).boxShadow, outline:getComputedStyle(document.activeElement).outlineStyle})"))
        trigger = page.get_by_role('button', name='가상 사용자 전환, 현재 사용자 ' + USER['name'])
        trigger.focus()
        page.keyboard.press('Enter')
        expect(page.get_by_role('dialog')).to_be_visible()
        page.screenshot(path=str(OUT / f'popover-{width}-long-large.png'))
        dialog = page.get_by_role('dialog').bounding_box()
        assert dialog['x'] >= 0 and dialog['x'] + dialog['width'] <= width
        page.keyboard.press('Escape')
        expect(trigger).to_be_focused()
        page.keyboard.press('Space')
        next_user = page.get_by_role('button', name='박서연 타임어택 헌터')
        next_user.focus()
        page.keyboard.press('Enter')
        expect(page.get_by_role('button', name='가상 사용자 전환, 현재 사용자 박서연')).to_be_focused()
        assert page.url.endswith('/missions')
        bell = page.get_by_role('button', name='알림,', exact=False)
        bell.focus()
        page.keyboard.press('Enter')
        expect(page.get_by_role('dialog')).to_be_visible()
        page.keyboard.press('Escape')
        expect(bell).to_be_focused()
        drawer = page.get_by_role('button', name='알림 전체 보기', exact=True)
        drawer.focus()
        page.keyboard.press('Enter')
        expect(page.get_by_role('dialog')).to_be_visible()
        page.keyboard.press('Escape')
        expect(drawer).to_be_focused()
        menu = page.get_by_role('button', name='메뉴', exact=True)
        if menu.is_visible():
            menu.focus()
            page.keyboard.press('Enter')
            expect(page.get_by_role('navigation', name='모바일 메뉴')).to_be_visible()
            page.keyboard.press('Escape')
            expect(menu).to_be_focused()
            page.keyboard.press('Enter')
            page.get_by_role('navigation', name='모바일 메뉴').get_by_role('link', name='이벤트', exact=True).click()
        else:
            page.locator('header').get_by_role('link', name='이벤트', exact=True).click()
        page.wait_for_url('**/events')
        results.append(dict(width=width, keyboard=sequence, popover=dialog, switch_focus=True, escape_focus=True, notification=True, drawer=True, menu_navigation=True))
        page.close()
    for size, scale in [(320, '120%'), (320, '200%'), (640, '200%')]:
        page = browser.new_page(viewport=dict(width=size, height=844))
        page.add_init_script('localStorage.setItem("getddo-session", ' + json.dumps(json.dumps(dict(state=dict(user=USER), version=0))) + ');')
        page.goto('http://127.0.0.1:5174/missions')
        page.wait_for_load_state('networkidle')
        page.evaluate('(size) => document.documentElement.style.fontSize=size', scale)
        overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
        header_overflow = page.locator('header').evaluate("h=>[...h.querySelectorAll('a,button')].some(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1)})")
        assert not header_overflow
        offenders = page.evaluate("[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1 && getComputedStyle(e).position!=='absolute').slice(0,10).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right}))") if overflow else []
        page.screenshot(path=str(OUT / f'accessibility-{size}-{scale.replace("%", "")}.png'))
        results.append(dict(width=size, scale=scale, overflow=overflow, header_overflow=header_overflow, offenders=offenders))
        page.close()
    browser.close()
(OUT / 'interactions.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=True))
