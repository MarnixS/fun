#!/usr/bin/env python3
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
try:
    from axe_selenium_python import Axe
except Exception:
    Axe=None

BASE='http://127.0.0.1:8123/'
opt=Options(); opt.add_argument('--headless=new'); opt.add_argument('--no-sandbox'); opt.add_argument('--disable-gpu'); opt.add_argument('--window-size=1440,1200')
d=webdriver.Chrome(options=opt); w=WebDriverWait(d,20)

def wait(css): return w.until(lambda x:x.find_element(By.CSS_SELECTOR,css))
def js(code,*args): return d.execute_script(code,*args)
def selected(host): return {x.get_attribute('value') for x in d.find_elements(By.CSS_SELECTOR,f'#{host} input[type=checkbox]') if x.is_selected()}
def set_members(host,wanted):
    wanted=set(wanted)
    for _ in range(10):
        cur=selected(host)
        if cur==wanted:return
        add=next((k for k in wanted if k not in cur),None)
        rem=next((k for k in cur if k not in wanted),None)
        k=add or rem
        el=d.find_element(By.CSS_SELECTOR,f'#{host} input[value="{k}"]'); js('arguments[0].click()',el); time.sleep(.2)
    raise AssertionError((host,selected(host),wanted))
def axe_serious():
    if Axe is None:return
    axe=Axe(d); axe.inject(); r=axe.run(options={'runOnly':{'type':'tag','values':['wcag2a','wcag2aa','wcag21a','wcag21aa']}})
    bad=[v for v in r.get('violations',[]) if v.get('impact') in ('serious','critical')]
    assert not bad,[(v.get('id'),v.get('impact'),v.get('help')) for v in bad]
def table_rows(): return [r for r in d.find_elements(By.CSS_SELECTOR,'#clogItemTable tbody tr') if len(r.find_elements(By.CSS_SELECTOR,'td'))>=3]
def assert_has_missing(rows,first_has=True,second_has=True):
    assert rows,'no matching Collection Log rows'
    for r in rows[:25]:
        cells=r.find_elements(By.CSS_SELECTOR,'td'); a=cells[1].text.strip().lower(); b=cells[2].text.strip().lower()
        assert (a not in ('—','unknown','')) if first_has else a=='—',a
        assert (b not in ('—','unknown','')) if second_has else b=='—',b

try:
    d.get(BASE+'index.html'); wait('.player-card'); time.sleep(1.3)
    assert not d.find_elements(By.CSS_SELECTOR,'[data-shared-refresh]')
    assert d.find_elements(By.CSS_SELECTOR,'.footer .v22-dev-link')
    assert not d.find_elements(By.CSS_SELECTOR,'.v21-member-actions')
    cards=d.find_elements(By.CSS_SELECTOR,'.player-card,.side-card'); assert len(cards)>=5
    quick=d.find_elements(By.CSS_SELECTOR,'.v22-clog-quick'); assert len(quick)>=5
    qtext=' '.join(x.text for x in quick); assert all(x in qtext for x in ['Unlocked','Unique to group','Shared','Unknown'])
    axe_serious()

    d.get(BASE+'gim.html'); wait('#clogMemberPicker fieldset'); wait('#clogItemTable tbody tr'); time.sleep(1)
    assert not d.find_elements(By.CSS_SELECTOR,'.v21-member-actions')
    set_members('clogMemberPicker',{'dikste','big dog aura'}); time.sleep(.6)
    status=Select(d.find_element(By.ID,'clogStatus')); labels=[o.text for o in status.options]
    assert 'Obtained by all selected' in labels and 'Obtained by any selected' in labels and 'Custom ownership rules' in labels
    status.select_by_value('obtained'); js("arguments[0].dispatchEvent(new Event('change',{bubbles:true}))",d.find_element(By.ID,'clogStatus')); time.sleep(.8)
    assert_has_missing(table_rows(),True,True)

    js('arguments[0].click()',d.find_element(By.CSS_SELECTOR,'#clogOwnershipRules input[name="rule-dikste"][value="has"]')); time.sleep(.2)
    js('arguments[0].click()',d.find_element(By.CSS_SELECTOR,'#clogOwnershipRules input[name="rule-big dog aura"][value="missing"]')); time.sleep(.8)
    assert Select(d.find_element(By.ID,'clogStatus')).first_selected_option.get_attribute('value')=='custom'
    assert_has_missing(table_rows(),True,False)
    axe_serious()

    # Reload saved Collection Log must discard browser override and must not call Temple.
    js("localStorage.setItem('ug-v20-temple-cache', JSON.stringify({fetchedAt:9999999999999,players:{fake:{}}})); performance.clearResourceTimings();")
    reload_btn=d.find_element(By.CSS_SELECTOR,'[data-reload-temple]'); assert 'does not request newer data from Temple' in (reload_btn.get_attribute('title') or '')
    js('arguments[0].click()',reload_btn)
    w.until(lambda x:x.execute_script("return document.readyState")=='complete'); time.sleep(1)
    assert js("return localStorage.getItem('ug-v20-temple-cache')") is None
    temple_calls=js("return performance.getEntriesByType('resource').map(x=>x.name).filter(x=>x.includes('templeosrs.com'))")
    assert temple_calls==[],temple_calls

    d.get(BASE+'chronicle.html'); wait('#playerGoals .v22-player-goal'); time.sleep(.7)
    goals=d.find_elements(By.CSS_SELECTOR,'#playerGoals .v22-player-goal'); assert len(goals)==5
    btn=d.find_element(By.CSS_SELECTOR,'#playerGoals [data-set-goal="dikste"]'); js('arguments[0].click()',btn); time.sleep(.2)
    dialog=d.find_element(By.ID,'v22GoalDialog'); assert dialog.get_attribute('open') is not None
    player=d.find_element(By.ID,'v22GoalPlayer'); assert player.get_attribute('value')=='dikste' and player.get_attribute('disabled') is not None
    assert d.find_element(By.ID,'v22GoalText').get_attribute('maxlength')=='140'
    axe_serious(); js('arguments[0].close()',dialog)

    d.get(BASE+'developer.html'); wait('#developerRefreshLink'); time.sleep(.3)
    nav=[x.text.strip() for x in d.find_elements(By.CSS_SELECTOR,'.main-nav .nav-link')]
    assert 'Developer options' not in nav
    assert 'actions/workflows/temple-cache.yml' in d.find_element(By.ID,'developerRefreshLink').get_attribute('href')
    axe_serious()
finally:
    d.quit()
print('V22 COLLECTION LOG + GOALS BROWSER AUDIT PASSED')
