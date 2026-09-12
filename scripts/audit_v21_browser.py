#!/usr/bin/env python3
import json,time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait,Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
try:
    from axe_selenium_python import Axe
except Exception:
    Axe=None

BASE='http://127.0.0.1:8123/'
PAGES=['index.html','gim.html','hiscores.html','progress.html','history.html','time-machine.html','chronicle.html']
NAV=['Overview','Collection Log','Hiscores','XP & Progress','History','Time Machine','Chronicle']
ALL={'dikste','big dog aura','lijpste','poep aura','lompste'}
CORE={'dikste','big dog aura','lijpste'}
opt=Options(); opt.add_argument('--headless=new'); opt.add_argument('--no-sandbox'); opt.add_argument('--disable-gpu'); opt.add_argument('--window-size=1440,1100')
opt.set_capability('goog:loggingPrefs',{'browser':'ALL','performance':'ALL'})
d=webdriver.Chrome(options=opt); w=WebDriverWait(d,20); errors=[]

def wait(css): return w.until(EC.presence_of_element_located((By.CSS_SELECTOR,css)))
def js(code,*args): return d.execute_script(code,*args)
def activate(css):
    el=d.find_element(By.CSS_SELECTOR,css); js("arguments[0].scrollIntoView({block:'center',inline:'nearest'});arguments[0].click();",el); return el
def focus_activate(css):
    el=d.find_element(By.CSS_SELECTOR,css); js("arguments[0].scrollIntoView({block:'center',inline:'nearest'});arguments[0].focus();arguments[0].click();",el); return el
def severe():
    for x in d.get_log('browser'):
        m=x.get('message','')
        if x.get('level')=='SEVERE' and any(q in m for q in ('Uncaught','TypeError','ReferenceError','SyntaxError')): errors.append(m)
def selected(host): return {x.get_attribute('value') for x in d.find_elements(By.CSS_SELECTOR,f'#{host} input[type=checkbox]') if x.is_selected()}
def set_members(host,wanted):
    wanted=set(wanted)
    for _ in range(10):
        cur=selected(host)
        if cur==wanted:return
        # Add a desired member before removing the final undesired one. The UI intentionally refuses an empty selection.
        toggle=next((k for k in wanted if k not in cur),None) or next((k for k in cur if k not in wanted),None)
        assert toggle,(host,cur,wanted)
        el=d.find_element(By.CSS_SELECTOR,f'#{host} input[value="{toggle}"]'); js('arguments[0].click()',el); time.sleep(.15)
    raise AssertionError((host,selected(host),wanted))
def nav_labels(): return js("return [...document.querySelectorAll('.main-nav .nav-link')].map(a=>a.querySelectorAll('span')[1]?.textContent.trim())")
def assert_named_controls():
    for el in d.find_elements(By.CSS_SELECTOR,'button,input:not([type=hidden]),select,a[href]'):
        if el.is_displayed(): assert (el.accessible_name or '').strip(),('unnamed control',el.tag_name,el.get_attribute('id'),el.get_attribute('class'))
def axe_serious():
    if Axe is None:return
    axe=Axe(d); axe.inject(); result=axe.run(options={'runOnly':{'type':'tag','values':['wcag2a','wcag2aa','wcag21a','wcag21aa']}})
    bad=[v for v in result.get('violations',[]) if v.get('impact') in ('serious','critical')]
    if bad:
        raise AssertionError([(v.get('id'),v.get('impact'),v.get('help'),[(n.get('target'),n.get('html'),n.get('failureSummary')) for n in v.get('nodes',[])[:8]]) for v in bad])
def assert_page_shell(fn):
    d.get(BASE+fn); wait('main.wrap'); time.sleep(.45)
    assert nav_labels()==NAV,(fn,nav_labels())
    assert len(d.find_elements(By.CSS_SELECTOR,'.main-nav .nav-link[aria-current="page"]'))==1
    assert d.find_element(By.CSS_SELECTOR,'.main-nav').get_attribute('aria-label')=='Primary'
    assert d.find_element(By.CSS_SELECTOR,'.v21-skip-link').get_attribute('href').endswith('#main-content')
    assert d.find_element(By.CSS_SELECTOR,'main').get_attribute('id')=='main-content'
    assert d.find_element(By.CSS_SELECTOR,'meta[name="robots"]').get_attribute('content')=='index,follow'
    assert d.find_element(By.CSS_SELECTOR,'meta[name="googlebot"]').get_attribute('content')=='index,follow'
    assert 'Temple '+'catalogue' not in d.find_element(By.TAG_NAME,'body').text
    assert_named_controls(); severe(); axe_serious()

try:
    for fn in PAGES: assert_page_shell(fn)

    d.get(BASE+'index.html'); wait('.side-card'); time.sleep(.3)
    cards=d.find_elements(By.CSS_SELECTOR,'.side-card'); assert len(cards)>=2
    for el in cards:
        assert float(js('return getComputedStyle(arguments[0]).opacity',el))>=.99
        assert js('return getComputedStyle(arguments[0]).filter',el)=='none'

    d.get(BASE+'progress.html'); wait('#statsMemberPicker fieldset'); wait('#xpChart svg'); time.sleep(.4)
    assert selected('statsMemberPicker')==ALL
    labels=d.find_elements(By.CSS_SELECTOR,'#statsMemberPicker .v21-member-list label'); assert len(labels)==5 and all(x.is_displayed() for x in labels)
    poep=d.find_element(By.CSS_SELECTOR,'#statsMemberPicker input[value="poep aura"]'); js("arguments[0].scrollIntoView({block:'center'})",poep); poep.click(); time.sleep(.2); assert 'poep aura' not in selected('statsMemberPicker')
    poep.send_keys(Keys.SPACE); time.sleep(.2); assert 'poep aura' in selected('statsMemberPicker')
    set_members('statsMemberPicker',ALL); time.sleep(.4)
    assert len(d.find_elements(By.CSS_SELECTOR,'#skillGainTable thead th'))==6
    assert len(d.find_elements(By.CSS_SELECTOR,'#bossGainTable thead th'))==6
    graph=d.find_element(By.CSS_SELECTOR,'#xpChart svg'); assert 'Dikste' in (graph.get_attribute('aria-label') or '')
    assert d.find_elements(By.CSS_SELECTOR,'#xpChart svg path') or d.find_elements(By.CSS_SELECTOR,'#xpChart svg rect')
    activate('[data-v21-chart-view="bars"]'); time.sleep(.35); assert len(d.find_elements(By.CSS_SELECTOR,'#xpChart svg rect'))>=5
    ss=Select(d.find_element(By.ID,'skillSelect')); assert len(ss.options)>5; ss.select_by_index(2)
    bs=Select(d.find_element(By.ID,'bossSelect')); assert len(bs.options)>0; bs.select_by_index(0); time.sleep(.35)
    assert d.find_elements(By.CSS_SELECTOR,'#skillChart svg') and d.find_elements(By.CSS_SELECTOR,'#bossChart svg')
    set_members('statsMemberPicker',{'dikste','poep aura'}); time.sleep(.35)
    assert len(d.find_elements(By.CSS_SELECTOR,'#skillGainTable thead th'))==3 and len(d.find_elements(By.CSS_SELECTOR,'#bossGainTable thead th'))==3
    severe()

    d.get(BASE+'hiscores.html'); wait('#statsMemberPicker fieldset'); time.sleep(.4)
    set_members('statsMemberPicker',ALL); time.sleep(.4)
    assert len(d.find_elements(By.CSS_SELECTOR,'#currentSkillsTable thead th'))==6
    assert len(d.find_elements(By.CSS_SELECTOR,'#bossTable thead th'))==6
    assert len(d.find_elements(By.CSS_SELECTOR,'#activityTable thead th'))==6
    invoker=focus_activate('[data-v21-skill]'); wait('#v21MetricModal[aria-hidden="false"]'); time.sleep(.2)
    modal=d.find_element(By.ID,'v21MetricModal'); assert modal.get_attribute('role')=='dialog' and modal.get_attribute('aria-modal')=='true'
    assert 'modal-close' in (d.switch_to.active_element.get_attribute('class') or '')
    assert len(d.find_elements(By.CSS_SELECTOR,'#v21ModalMembers input'))==0 and d.find_elements(By.CSS_SELECTOR,'#v21ModalChart svg')
    assert all(name in d.find_element(By.ID,'v21ModalMembers').text for name in ['Dikste','Big Dog Aura','Lijpste','Poep Aura','Lompste'])
    activate('[data-v21-modal-view="bars"]'); time.sleep(.3); assert len(d.find_elements(By.CSS_SELECTOR,'#v21ModalChart svg rect'))>=5
    close=d.find_element(By.CSS_SELECTOR,'#v21MetricModal .modal-close'); js("arguments[0].scrollIntoView({block:'center'})",close); close.click(); w.until(lambda x:x.find_element(By.ID,'v21MetricModal').get_attribute('aria-hidden')=='true')
    assert d.switch_to.active_element.get_attribute('data-v21-skill') is not None
    focus_activate('[data-v21-boss]'); wait('#v21MetricModal[aria-hidden="false"]'); d.switch_to.active_element.send_keys(Keys.ESCAPE); w.until(lambda x:x.find_element(By.ID,'v21MetricModal').get_attribute('aria-hidden')=='true')
    severe()

    d.get(BASE+'gim.html'); wait('#clogMemberPicker fieldset'); wait('#clogItemTable tbody tr'); time.sleep(.6)
    assert selected('clogMemberPicker')==ALL
    assert len(d.find_elements(By.CSS_SELECTOR,'#clogMemberPicker .v21-member-list label'))==5
    assert len(d.find_elements(By.CSS_SELECTOR,'#clogItemTable thead th'))==9
    set_members('clogMemberPicker',{'dikste','big dog aura','lijpste','lompste'}); time.sleep(.4)
    assert 'Poep Aura' not in [x.text for x in d.find_elements(By.CSS_SELECTOR,'#clogItemTable thead th')]
    activate('[data-gim-tab="contribution"]'); wait('#clogContributionPie svg'); assert d.find_elements(By.CSS_SELECTOR,'#clogContributionBars svg')
    assert 'percent' in (d.find_element(By.CSS_SELECTOR,'#clogContributionPie svg').get_attribute('aria-label') or '')
    activate('[data-gim-tab="overlap"]'); wait('#clogOverlapBars svg')
    set_members('clogMemberPicker',{'dikste'}); activate('[data-gim-tab="contribution"]'); time.sleep(.4); assert d.find_elements(By.CSS_SELECTOR,'#clogContributionPie svg circle')
    set_members('clogMemberPicker',{'lompste'}); activate('[data-gim-tab="collection"]'); time.sleep(.5); assert 'unknown' in d.find_element(By.ID,'clogItemTable').text.lower()
    assert Select(d.find_element(By.ID,'clogStatus')).options[-1].get_attribute('value')=='dupes'
    assert any(o.get_attribute('value')=='value' for o in Select(d.find_element(By.ID,'clogSort')).options)
    assert_named_controls(); severe()

    d.get(BASE+'time-machine.html'); wait('#timeGo'); d.get_log('performance'); js("document.querySelector('#timeDate').value='2026-01-01'"); activate('#timeGo'); w.until(lambda x:'Closest WOM snapshot in time' in x.find_element(By.TAG_NAME,'body').text); time.sleep(.4)
    req=[]
    for e in d.get_log('performance'):
        try:
            m=json.loads(e['message'])['message']
            if m['method']=='Network.requestWillBeSent': req.append(m['params']['request']['url'])
        except Exception: pass
    assert not [u for u in req if 'wiseoldman.net' in u],[u for u in req if 'wiseoldman.net' in u]
    assert '01 Jan 2026' in d.find_element(By.TAG_NAME,'body').text; severe()

    d.get(BASE+'chronicle.html'); wait('#chronicle'); time.sleep(.7)
    assert d.find_element(By.ID,'chronicleRefresh').text.strip()=='Reload stats Chronicle via WOM'
    events=d.find_elements(By.CSS_SELECTOR,'.chronicle-event'); assert len(events)>600,len(events)
    assert len(d.find_elements(By.CSS_SELECTOR,'.chronicle-event[data-event-type="level"][data-level]'))>1000
    txt=' '.join(x.text for x in events); assert 'Dikste' in txt and 'Big Dog Aura' in txt; severe()
    d.get(BASE+'history.html'); wait('#activityEras'); time.sleep(.7); assert d.find_elements(By.CSS_SELECTOR,'.era-segment'); severe()
finally:
    d.quit()
assert not errors,errors
print('FULL V21 ACCESSIBILITY + INTERACTION AUDIT PASSED')
