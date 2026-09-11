#!/usr/bin/env python3
from pathlib import Path
import re

DOCS=Path('docs')

p=DOCS/'assets/app.js'; s=p.read_text(encoding='utf-8')
old_catalogue='Temple '+'catalogue'
for a,b in {
    old_catalogue:'Collection Log',
    'Actual WOM snapshot':'Closest WOM snapshot in time',
    'Supporting cast':'Additional group members',
    'supporting cast':'additional group members',
    "role:'Supporting cast'":"role:'Additional group member'",
    'findNearestSnapshot(p,target,true)':'findNearestSnapshot(p,target,false)',
    'Using saved WOM snapshots first. If the saved history is not close enough, this explicit Time Machine request may ask WOM for a historical datapoint.':'Using WOM snapshot history saved in this repository. No new WOM request is made by Time Machine.',
    'Refreshing Temple…':'Refreshing Collection Log…',
    'Temple Collection Log':'Collection Log via Temple',
    'Temple recent collection':'Collection Log recent unlock via Temple'
}.items(): s=s.replace(a,b)
p.write_text(s,encoding='utf-8')

p=DOCS/'assets/v21-clog.js'; s=p.read_text(encoding='utf-8')
listener="window.addEventListener('ug:data-updated',async e=>{if(e.detail?.key!==U.TKEY)return;doc=await loadClog();model=build();ensurePicker();populate();renderAll()});\n"
if "window.addEventListener('ug:data-updated'" not in s:
    s=s.replace('async function init(){',listener+'async function init(){')
s=s.replace("renderMemberPicker(host,selected,n=>{selected=n;page=0;ensurePicker();renderAll()}","renderMemberPicker(host,selected,n=>{selected=n;page=0;renderAll()}")
p.write_text(s,encoding='utf-8')

p=DOCS/'assets/v21-progress.js'; s=p.read_text(encoding='utf-8')
s=s.replace("renderMemberPicker(host,selected,n=>{selected=n;renderStatsPicker();pageName==='progress'?refreshProgress():renderHiscores()}","renderMemberPicker(host,selected,n=>{selected=n;pageName==='progress'?refreshProgress():renderHiscores()}")
# In an open graph modal, redraw the graph without rebuilding the additive member control.
s=s.replace('function renderModal(){','function renderModal(updatePicker=true){')
s=s.replace("renderMemberPicker($('#v21ModalMembers',m),modalSelected,n=>{modalSelected=n;renderModal()},{title:","if(updatePicker)renderMemberPicker($('#v21ModalMembers',m),modalSelected,n=>{modalSelected=n;renderModal(false)},{title:")
p.write_text(s,encoding='utf-8')

pages=['index.html','gim.html','hiscores.html','progress.html','history.html','time-machine.html','chronicle.html']
labels=[('index.html','Overview','O',None),('gim.html','Collection Log','G','GIM'),('hiscores.html','Hiscores','H',None),('progress.html','XP & Progress','XP',None),('history.html','History','T',None),('time-machine.html','Time Machine','⧖',None),('chronicle.html','Chronicle','✦',None)]
for fn in pages:
    p=DOCS/fn; h=p.read_text(encoding='utf-8')
    links=[]
    for i,(href,label,rune,badge) in enumerate(labels):
        active='active' if href==fn else ''; group='nav-group-start' if i==4 else ''
        aria=' aria-current="page"' if href==fn else ''; bd=f'<span class="nav-badge" aria-hidden="true">{badge}</span>' if badge else ''
        links.append(f'<a class="nav-link {active} {group}" href="{href}"{aria}><span class="nav-rune" aria-hidden="true">{rune}</span><span>{label}</span>{bd}</a>')
    nav='<nav class="main-nav" aria-label="Primary"><div class="wrap nav-inner"><a class="nav-brand" href="index.html" aria-label="United Gimps overview"><img src="img/gim-crest.svg" alt=""></a>'+''.join(links)+'</div></nav>'
    h=re.sub(r'<nav class="main-nav"[^>]*>.*?</nav>',nav,h,count=1,flags=re.S).replace('Temple snapshot','Collection Log snapshot')
    if 'assets/v21-nav.js' not in h: h=h.replace('</body>','<script defer src="assets/v21-nav.js" data-v21-nav></script></body>')
    p.write_text(h,encoding='utf-8')

p=DOCS/'gim.html'; h=p.read_text(encoding='utf-8')
h=re.sub(r'<select id="clogMember".*?</select>','<div id="clogMemberPicker" aria-label="Collection Log member filter"></div>',h,count=1,flags=re.S)
h=h.replace('Start with the status quo. Switch between the group or any individual member, filter by category and obtained/missing/shared/dupes, then use the deeper contribution, overlap and value views when you want them. Recent unlocks stay separate.','Start with the current Collection Log. Add or remove any combination of the five usernames, then filter by category and obtained/missing/shared/dupes. The same selected members carry into contribution, overlap, value, categories and recent unlocks.')
p.write_text(h,encoding='utf-8')

p=DOCS/'chronicle.html'; p.write_text(p.read_text(encoding='utf-8').replace('Refresh stats Chronicle via WOM','Reload stats Chronicle via WOM'),encoding='utf-8')

p=DOCS/'hiscores.html'; h=p.read_text(encoding='utf-8')
for a,b in {
    'The table keeps the core-three comparison compact, but clicking any skill opens a five-player WOM history graph with every member that has data.':'Use the member filter to add or remove any of the five accounts. Clicking a skill opens its saved WOM timeline or a current bar comparison for exactly the selected members.',
    'Level + XP · core-three table, five-player graph drill-down.':'Level + XP · selected members · click a skill for timeline or bars.',
    '<strong>Boss KC</strong><span>Core-three table.</span>':'<strong>Boss KC</strong><span>Selected members · click a boss for timeline or bars.</span>',
    'Current saved WOM activity scores for the core three. This restores the old minigame/activity comparison instead of silently dropping it in the redesign.':'Current saved WOM activity scores for the selected members. The same additive member filter applies here too.',
    '<strong>Activities & minigames</strong><span>Current score · core-three comparison.</span>':'<strong>Activities & minigames</strong><span>Current score · selected members.</span>'
}.items(): h=h.replace(a,b)
p.write_text(h,encoding='utf-8')

print('v21 source finalized')
