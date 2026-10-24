# Team Gear Planner

The Experimental planner lives at `/gear-planner`. The source page is
`site/pages/gear-planner.html`; regenerate both public and legacy pages with
`python scripts/build_site.py`. Do not edit the generated HTML directly.

## Model

`gear-planner-data.js` contains the encounter methods, equipment priorities,
equipment requirements, ownership flags, aliases and recipes. Its review date is
24 October 2026. `gear-planner-model.js` is a DOM-free allocator;
`gear-planner.js` connects it to the shared Collection Log/WOM stores, member
filters, banner, URL state and browser-local stock adjustments.

The input projection counts each item ID once per account, even when several
collections repeat it. Charged/cosmetic aliases generally use the maximum count;
the separately dropped full and uncharged tridents use their sum. Tradeable
stock includes all five members, independently of the selected participants.
Untradeable gear remains per-account. A tradeable result can be crafted by a
group member who owns its personal ingredient; an untradeable result must be
crafted by its recipient.

The selected priority determines scarce-item recipients. Every player's main
weapon is reserved before phase weapons, then armour and optional specs. A
weapon and its crystal-armour dependencies are one atomic reservation. A failed
candidate leaves no consumed materials. Equipment already held by a player can
be reused in another phase; it cannot be lent to a simultaneous second player.
Conversions use a bounded minimum-waste search over unallocated donor pieces.

These are research-based priorities, not DPS calculations or a globally optimal
team allocation. Gear, spells, invocations, stat boosts, defence drains and
method execution can change the ranking. Equipment checks cover the listed
requirements; crafting skill/quest/charge conditions are displayed on items.

## Stock corrections

The Collection Log records lifetime acquisitions, not a current bank. Every
stock override is a confirmed **remaining** quantity; blank restores inference.
Zero excludes an item. Confirmed finished crafts reserve their ingredients from
inferred counters, avoiding historical base/product double counting. An
explicit ingredient override already represents the remaining bank and is not
debited again for past crafting. Missing historical ingredients generate a
warning without discarding the confirmed finished item.

Standard quest/shop equipment is disabled by default. Opting in supplies one
assumed standard item per player, with a visible badge. Infernal capes, quivers,
void sets and rare items are never granted by this switch. Currency, ammunition,
consumable charges, common crafting supplies and quest unlocks remain explicit
conditions, rather than invented confirmed ownership. Equipment-level checks
can be switched off to explore future setups.

Adjustments and priority use `ug:gear-planner:v2` in localStorage. They are not
published to other visitors. Data-refresh subscriptions retain the selected
encounter and corrections. `/gear-planner?boss=<id>` shares the encounter only.
The catalogue includes every current Collection Log/WOM boss; an unknown future
encounter is listed as unreviewed rather than silently given a generic BIS list.

## Sources

Each encounter links its OSRS Wiki strategy page. The key conversion references:

- [Masori armour](https://oldschool.runescape.wiki/w/Masori_armour):
  mask/body/chaps use 1/4/3 plates; Armadyl helmet/chestplate/chainskirt yield
  1/4/3. Fortification does not increase ranged offensive bonuses.
- [Torva armour](https://oldschool.runescape.wiki/w/Torva_armour):
  helm/body/legs use 1/2/2 Bandosian components; chestplate/tassets yield 3/2.
- [Crystal equipment](https://oldschool.runescape.wiki/w/Crystal_equipment):
  helm/body/legs use 1/3/2 armour seeds; Bowfa and Saeldor share enhanced seeds.
- [Confliction gauntlets](https://oldschool.runescape.wiki/w/Confliction_gauntlets):
  tormented bracelet + personal Mokhaiotl cloth, with demon tears as an additional
  untracked currency condition.
- [Avernic treads](https://oldschool.runescape.wiki/w/Avernic_treads):
  upgrades consume the corresponding boots; upgraded treads become personal.
- [Kree'arra](https://oldschool.runescape.wiki/w/Kree%27arra/Strategies):
  Shadow-only magic method, falling back to ranged for players without a Shadow.
- [Vorkath](https://oldschool.runescape.wiki/w/Vorkath/Strategies),
  [Zulrah](https://oldschool.runescape.wiki/w/Zulrah/Strategies),
  [Doom](https://oldschool.runescape.wiki/w/Doom_of_Mokhaiotl/Strategies),
  [Yama](https://oldschool.runescape.wiki/w/Yama/Strategies), and the three raid
  strategy pages document the encounter-specific choices and switches.

## Verification

`npm run test:gear` checks finite supplies, donor conversion, seed/zenyte
contention, atomic rollback, owner restrictions, phase reuse, priority, stock
reconciliation, requirements, all current encounter plans, empty data, real
page controls, persistence and live store updates. It runs in website CI.
`npm run test:progress` protects the restored shared banner/header alongside the
existing compact overview and comparison behavior.
