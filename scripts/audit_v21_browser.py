#!/usr/bin/env python3
import json,time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait,Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys

BASE='http://127.0.0.1:8123/'
PAGES=['index.html','gim.html','hiscores.html','progress.html','history.html','time-machine.html','chronicle.html']
NAV=['Overview','Collection Log','Hiscores','XP & Progress','History','Time Machine','Chronicle']
opt=Options(); opt.add_argument('--headless=new'); opt.add_argument('--no-sandbox'); opt.add_argument('--disable-gpu'); opt.add_argument('--window-size=1440,1100')
opt.set_capability('goog:loggingPrefs',{'browser':'ALL','performance':'ALL'})
d=webdriver.Chrome(options=opt); w=WebDriverWait(d,20); errors=[]

def wait(css): return w.until(EC.presence_of_element_located((By.CSS_SELECTOR,css)))
def js(code,*args): return d.execute_script(code,*args)
def severe():
    for x in d.get_log('browser'):
        m=x.get('message','')
        if x.get('level')=='SEVERE' and any(q in m for q in ('Uncaught','TypeError','ReferenceError','SyntaxError')): errors.append(m)
def selected(host): return {x.get_attribute('value') for x in d.find_elements(By.CSS_SELECTOR,f'#{host} input[type=checkbox]') if x.is_selected()}
def set_members(host,wanted):
    wanted=set(wanted)
    for _ in range(10):
        cur=selected(host)
        if cur==wanted: return
        toggle=next((k for k in cur if k not in wanted),None) or next((k for k in wanted if k not in cur),None)
        assert toggle, (host,cur,wanted)
        js(f"document.querySelector('#{host} details').open=true")
        el=d.find_element(By.CSS_SELECTOR,f'#{host} input[value="{toggle}"]')
        js('arguments[0].click()',el); time.sleep(.2)
    raise AssertionError((host,selected(host),wanted))

def nav_labels(): return js("return [...document.querySelectorAll('.main-nav .nav-link')].map(a=>a.querySelectorAll('span')[1]?.textContent.trim())")

try:
    # Every page: navigation, current location, terminology and JS errors.
    for fn in PAGES:
        d.get(BASE+fn); wait('main.wrap'); time.sleep(.45)
        assert nav_labels()==NAV,(fn,nav_labels())
        active=d.find_elements(By.CSS_SELECTOR,'.main-nav .nav-link[aria-current="page"]'); assert len(active)==1,(fn,'aria-current',len(active))
        body=d.find_element(By.TAG_NAME,'body').text
        assert 'Temple catalogue' not in body,(fn,'old terminology')
        severe()

    # Poep Aura/Lompste are not faded.
    d.get(BASE+'index.html'); wait('.side-card'); time.sleep(.3)
    cards=d.find_elements(By.CSS_SELECTOR,'.side-card'); assert len(cards)>=2
    for el in cards:
        assert float(js('return getComputedStyle(arguments[0]).opacity',el))>=.99
        assert js('return getComputedStyle(arguments[0]).filter',el)=='none'

    # XP & Progress: additive filter, all-five tables, lines/bars and selected skill/boss charts.
    d.get(BASE+'progress.html'); wait('#statsMemberPicker'); wait('#xpChart svg'); time.sleep(.4)
    assert selected('statsMemberPicker')=={'dikste','big dog aura','lijpste'}
    set_members('statsMemberPicker',{'dikste','big dog aura','lijpste','poep aura','lompste'}); time.sleep(.4)
    assert len(d.find_elements(By.CSS_SELECTOR,'#skillGainTable thead th'))==6
    assert len(d.find_elements(By.CSS_SELECTOR,'#bossGainTable thead th'))==6
    assert d.find_elements(By.CSS_SELECTOR,'#xpChart svg path') or d.find_elements(By.CSS_SELECTOR,'#xpChart svg rect')
    d.find_element(By.CSS_SELECTOR,'[data-v21-chart-view="bars"]').click(); time.sleep(.35)
    assert len(d.find_elements(By.CSS_SELECTOR,'#xpChart svg rect'))>=5
    ss=Select(d.find_element(By.ID,'skillSelect')); assert len(ss.options)>5; ss.select_by_index(2)
    bs=Select(d.find_element(By.ID,'bossSelect')); assert len(bs.options)>0; bs.select_by_index(0); time.sleep(.35)
    assert d.find_elements(By.CSS_SELECTOR,'#skillChart svg') and d.find_elements(By.CSS_SELECTOR,'#bossChart svg')
    set_members('statsMemberPicker',{'dikste','poep aura'}); time.sleep(.35)
    assert len(d.find_elements(By.CSS_SELECTOR,'#skillGainTable thead th'))==3
    assert len(d.find_elements(By.CSS_SELECTOR,'#bossGainTable thead th'))==3
    severe()

    # Hiscores: the same additive filter drives skills, bosses, activities and graph modals.
    d.get(BASE+'hiscores.html'); wait('#statsMemberPicker'); time.sleep(.4)
    set_members('statsMemberPicker',{'dikste','big dog aura','lijpste','poep aura','lompste'}); time.sleep(.4)
    assert len(d.find_elements(By.CSS_SELECTOR,'#currentSkillsTable thead th'))==6
    assert len(d.find_elements(By.CSS_SELECTOR,'#bossTable thead th'))==6
    assert len(d.find_elements(By.CSS_SELECTOR,'#activityTable thead th'))==6
    d.find_element(By.CSS_SELECTOR,'[data-v21-skill]').click(); wait('#v21MetricModal[aria-hidden="false"]'); time.sleep(.2)
    assert len(d.find_elements(By.CSS_SELECTOR,'#v21ModalMembers input'))==5
    assert d.find_elements(By.CSS_SELECTOR,'#v21ModalChart svg')
    d.find_element(By.CSS_SELECTOR,'[data-v21-modal-view="bars"]').click(); time.sleep(.3)
    assert len(d.find_elements(By.CSS_SELECTOR,'#v21ModalChart svg rect'))>=5
    d.find_element(By.CSS_SELECTOR,'#v21MetricModal .modal-close').click(); w.until(lambda x:x.find_element(By.ID,'v21MetricModal').get_attribute('aria-hidden')=='true')
    d.find_element(By.CSS_SELECTOR,'[data-v21-boss]').click(); wait('#v21MetricModal[aria-hidden="false"]'); d.find_element(By.TAG_NAME,'body').send_keys(Keys.ESCAPE); w.until(lambda x:x.find_element(By.ID,'v21MetricModal').get_attribute('aria-hidden')=='true')
    severe()

    # Collection Log: additive members drive every view. Lompste remains unknown, never zero.
    d.get(BASE+'gim.html'); wait('#clogMemberPicker'); wait('#clogItemTable tbody tr'); time.sleep(.6)
    assert selected('clogMemberPicker')=={'dikste','big dog aura','lijpste','poep aura','lompste'}
    assert len(d.find_elements(By.CSS_SELECTOR,'#clogItemTable thead th'))==9
    set_members('clogMemberPicker',{'dikste','big dog aura','lijpste','lompste'}); time.sleep(.4)
    assert 'Poep Aura' not in [x.text for x in d.find_elements(By.CSS_SELECTOR,'#clogItemTable thead th')]
    d.find_element(By.CSS_SELECTOR,'[data-gim-tab="contribution"]').click(); wait('#clogContributionPie svg'); assert d.find_elements(By.CSS_SELECTOR,'#clogContributionBars svg')
    d.find_element(By.CSS_SELECTOR,'[data-gim-tab="overlap"]').click(); wait('#clogOverlapBars svg')
    set_members('clogMemberPicker',{'dikste'}); d.find_element(By.CSS_SELECTOR,'[data-gim-tab="contribution"]').click(); time.sleep(.4); assert d.find_elements(By.CSS_SELECTOR,'#clogContributionPie svg circle')
    set_members('clogMemberPicker',{'lompste'}); time.sleep(.5); assert 'unknown' in d.find_element(By.ID,'clogItemTable').text.lower()
    # Filter surface includes category, duplicate and value sorting.
    assert d.find_element(By.ID,'clogCategory'); assert Select(d.find_element(By.ID,'clogStatus')).options[-1].get_attribute('value')=='dupes'; assert any(o.get_attribute('value')=='value' for o in Select(d.find_element(By.ID,'clogSort')).options)
    severe()

    # Time Machine uses repository snapshots only after backfill.
    d.get(BASE+'time-machine.html'); wait('#timeGo'); d.get_log('performance'); js("document.querySelector('#timeDate').value='2026-01-01'"); d.find_element(By.ID,'timeGo').click(); w.until(lambda x:'Closest WOM snapshot in time' in x.find_element(By.TAG_NAME,'body').text); time.sleep(.4)
    req=[]
    for e in d.get_log('performance'):
        try:
            m=json.loads(e['message'])['message']
            if m['method']=='Network.requestWillBeSent': req.append(m['params']['request']['url'])
        except Exception: pass
    assert not [u for u in req if 'wiseoldman.net' in u],[u for u in req if 'wiseoldman.net' in u]
    assert '01 Jan 2026' in d.find_element(By.TAG_NAME,'body').text
    severe()

    # Chronicle and History actually populate from saved data.
    d.get(BASE+'chronicle.html'); wait('#chronicle'); time.sleep(.7)
    assert d.find_element(By.ID,'chronicleRefresh').text.strip()=='Reload stats Chronicle via WOM'
    events=d.find_elements(By.CSS_SELECTOR,'.chronicle-event'); assert len(events)>=10,len(events)
    txt=' '.join(x.text for x in events); assert 'Dikste' in txt and 'Big Dog Aura' in txt
    severe()
    d.get(BASE+'history.html'); wait('#activityEras'); time.sleep(.7); assert d.find_elements(By.CSS_SELECTOR,'.era-segment'); severe()
finally:
    d.quit()
assert not errors,errors
print('FULL V21 BROWSER AUDIT PASSED')
