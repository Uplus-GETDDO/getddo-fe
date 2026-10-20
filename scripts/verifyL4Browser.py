import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
print('browser start',flush=True)
root=Path('docs/superpowers/plans')
image_root=Path(tempfile.gettempdir())/'getddo-l4-browser'
image_root.mkdir(exist_ok=True)
user={'id':'01a14280-f678-71f8-b154-11b44c1926f2','name':'테스트사용자2','role':'USER','membership':'excellent','personaLabel':'라이트 참여형'}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,timeout=15000)
 context=browser.new_context(viewport={'width':1280,'height':900},service_workers='block')
 page=context.new_page()
 page.set_default_timeout(20000)
 page.on('requestfailed',lambda request:print('failed',request.url,request.failure,flush=True))
 page.on('console',lambda message:print('console',message.type,message.text[:150],message.location,flush=True) if message.type=='error' else None)
 context.add_init_script('localStorage.setItem("getddo-session",'+json.dumps(json.dumps({'state':{'user':user},'version':0}))+');')
 requests=[];errors=[];checks=[];lost={'done':False}
 page.on('pageerror',lambda error:errors.append(str(error)))
 def proxy(route):
  url=route.request.url.split('/api',1)[1]
  if url=='/virtual-users':route.fulfill(json={'success':True,'data':[user]});return
  headers=route.request.all_headers();headers.pop('origin',None);headers.pop('host',None);headers.pop('referer',None)
  response=route.fetch(url='https://dzc8oneey9mmx.cloudfront.net/api'+url,headers=headers,timeout=15000)
  entry={'method':route.request.method,'path':url,'status':response.status}
  if route.request.method=='PUT' and url.endswith('/result'):
   entry['validationData']=json.loads(route.request.post_data)['validationData'];entry['result']=response.json().get('data')
  requests.append(entry)
  (root/'L4-browser-evidence.json').write_text(json.dumps({'kind':'MSW 없음, 로컬 preview에서 실제 API로 전달. 사용자 선택만 fixture, 타이밍 첫 결과 응답 유실 주입.','requests':requests,'checks':checks,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
  if route.request.method=='PUT' and '/01a15714-8ece-7944-95ef-31fed5a68f81/' in url and not lost['done']:
   lost['done']=True;route.abort();return
  route.fulfill(response=response)
 page.route('http://127.0.0.1:5184/api/**',proxy)
 for code,game_id in [('COLOR_WORD','01a143a8-b6de-74af-afca-7f908caa54eb'),('TAKKO_RUN','01a14dce-e375-7801-977c-19ba1dec3635'),('TAKKO_TIMING','01a15714-8ece-7944-95ef-31fed5a68f81'),('TAKKO_ORDER','01a15714-8ece-7929-9127-273bb6db4875')]:
  page.goto('http://127.0.0.1:5184/missions/games/'+game_id,wait_until='networkidle')
  page.get_by_role('button',name='게임 시작',exact=True).click()
  if code=='TAKKO_RUN':
   page.get_by_role('group',name='타꼬런 게임').wait_for();page.keyboard.press('Space')
  else:
   page.get_by_role('button',name='나가기',exact=True).wait_for()
   page.get_by_role('button',name='게임 시작',exact=True).click()
  if code=='TAKKO_TIMING':
   button=page.get_by_role('button',name='지금 꽂기!')
   button.wait_for();page.wait_for_function("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('지금 꽂기')&&!b.disabled)")
   button.click()
   page.get_by_role('button',name='원본 기록으로 결과 다시 확인').wait_for(timeout=15000)
   page.get_by_role('button',name='원본 기록으로 결과 다시 확인').click()
  if code=='TAKKO_ORDER':
   for failure in range(3):
    page.wait_for_function("Array.from(document.querySelectorAll('button')).some(b=>b.getAttribute('aria-label')==='1번 파 내주기'&&!b.disabled)")
    for pick in range(3):
     button=page.get_by_role('button',name='1번 파 내주기')
     if button.is_disabled():break
     button.click()
  page.get_by_text('서버 확정 점수:',exact=False).wait_for(timeout=30000)
  checks.append({'code':code,'serverResult':page.get_by_text('서버 확정 점수:',exact=False).inner_text(),'localStorageHasToken':page.evaluate("Object.values(localStorage).some(v=>v.includes('playToken'))")})
  page.screenshot(path=str(image_root/('L4-browser-'+code+'.png')),full_page=True)
  print(code,'complete',flush=True)
 page.goto('http://127.0.0.1:5184/my-tickets',wait_until='networkidle')
 checks.append({'ticketScreen':page.locator('main').inner_text()[:1000]})
 page.goto('http://127.0.0.1:5184/missions/games/01a143a8-b6de-74af-afca-7f908caa54eb',wait_until='networkidle')
 page.set_viewport_size({'width':320,'height':800});page.emulate_media(reduced_motion='reduce',color_scheme='dark')
 checks.append({'viewport':320,'horizontalOverflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')})
 for _ in range(5):page.keyboard.press('Tab')
 checks.append({'keyboardFocus':page.locator(':focus').evaluate('(el)=>({tag:el.tagName,name:el.getAttribute("aria-label")||el.textContent})')})
 page.screenshot(path=str(image_root/'L4-browser-mobile.png'),full_page=True)
 (root/'L4-browser-evidence.json').write_text(json.dumps({'kind':'MSW 없음, 로컬 브라우저에서 실제 API로 전송하는 프록시. 사용자 선택 목록만 fixture. 타이밍 첫 결과 응답은 전송 후 고의 유실.','requests':requests,'checks':checks,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
 browser.close()
